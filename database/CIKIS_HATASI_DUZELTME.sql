-- ========================================
-- ÇIKIŞ HATASI DÜZELTMESİ
-- Hata: function calculate_earnings_and_penalties(uuid) does not exist
-- Çözüm: Fonksiyonu UUID parametresi ile yeniden oluştur
-- ========================================

-- 1. Mevcut trigger'ı kaldır
DROP TRIGGER IF EXISTS trigger_auto_calculate_earnings ON attendance;

-- 2. Eski fonksiyonu kaldır (varsa)
DROP FUNCTION IF EXISTS calculate_earnings_and_penalties(INTEGER);
DROP FUNCTION IF EXISTS calculate_earnings_and_penalties(UUID);

-- 3. Fonksiyonu UUID ile YENİDEN OLUŞTUR
CREATE OR REPLACE FUNCTION calculate_earnings_and_penalties(
    p_attendance_id UUID
)
RETURNS TABLE (
    overtime_mins INTEGER,
    late_mins INTEGER,
    early_leave_mins INTEGER,
    overtime_pay DECIMAL(10, 2),
    late_penalty_amount DECIMAL(10, 2),
    early_penalty_amount DECIMAL(10, 2),
    daily_pay DECIMAL(10, 2),
    net_pay DECIMAL(10, 2)
) AS $$
DECLARE
    v_personnel RECORD;
    v_attendance RECORD;
    v_check_in_time TIME;
    v_check_out_time TIME;
    v_expected_in TIME;
    v_expected_out TIME;
    v_worked_minutes INTEGER;
    v_expected_minutes INTEGER;
    v_overtime_minutes INTEGER := 0;
    v_late_minutes INTEGER := 0;
    v_early_leave_minutes INTEGER := 0;
    v_overtime_amount DECIMAL(10, 2) := 0.00;
    v_late_penalty DECIMAL(10, 2) := 0.00;
    v_early_penalty DECIMAL(10, 2) := 0.00;
    v_daily_earnings DECIMAL(10, 2) := 0.00;
    v_net_earnings DECIMAL(10, 2) := 0.00;
BEGIN
    -- Attendance kaydını getir
    SELECT * INTO v_attendance 
    FROM attendance 
    WHERE id = p_attendance_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attendance record not found: %', p_attendance_id;
    END IF;
    
    -- Personnel bilgilerini getir
    SELECT * INTO v_personnel 
    FROM personnel 
    WHERE id = v_attendance.personnel_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personnel not found for attendance: %', p_attendance_id;
    END IF;
    
    -- Sadece saatleri al
    v_check_in_time := v_attendance.check_in_time::TIME;
    v_check_out_time := COALESCE(v_attendance.check_out_time::TIME, CURRENT_TIME);
    v_expected_in := COALESCE(v_personnel.shift_start_time, '09:00:00'::TIME);
    v_expected_out := COALESCE(v_personnel.shift_end_time, '18:00:00'::TIME);
    
    -- Çalışılan dakika
    v_worked_minutes := EXTRACT(EPOCH FROM (v_check_out_time - v_check_in_time))/60;
    
    -- Beklenen çalışma dakikası
    v_expected_minutes := COALESCE(v_personnel.standard_work_hours, 8) * 60;
    
    -- GEÇ KALMA hesapla (tolerans 15 dakika)
    IF v_check_in_time > v_expected_in + INTERVAL '15 minutes' THEN
        v_late_minutes := EXTRACT(EPOCH FROM (v_check_in_time - v_expected_in))/60;
        v_late_penalty := v_late_minutes * COALESCE(v_personnel.minute_wage, 0);
    END IF;
    
    -- ERKEN ÇIKMA hesapla
    IF v_check_out_time < v_expected_out THEN
        v_early_leave_minutes := EXTRACT(EPOCH FROM (v_expected_out - v_check_out_time))/60;
        v_early_penalty := v_early_leave_minutes * COALESCE(v_personnel.minute_wage, 0);
    END IF;
    
    -- FAZLA MESAİ hesapla (1.5x)
    IF v_worked_minutes > v_expected_minutes THEN
        v_overtime_minutes := v_worked_minutes - v_expected_minutes;
        v_overtime_amount := v_overtime_minutes * COALESCE(v_personnel.minute_wage, 0) * 1.5;
    END IF;
    
    -- Günlük kazanç
    v_daily_earnings := COALESCE(v_personnel.daily_wage, 0) + v_overtime_amount;
    
    -- Net kazanç (kesintiler düşülmüş)
    v_net_earnings := v_daily_earnings - v_late_penalty - v_early_penalty;
    
    -- Sonuçları döndür
    RETURN QUERY SELECT 
        v_overtime_minutes,
        v_late_minutes,
        v_early_leave_minutes,
        v_overtime_amount,
        v_late_penalty,
        v_early_penalty,
        v_daily_earnings,
        v_net_earnings;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger fonksiyonunu YENİDEN OLUŞTUR
CREATE OR REPLACE FUNCTION trigger_calculate_earnings()
RETURNS TRIGGER AS $$
DECLARE
    v_result RECORD;
BEGIN
    -- Sadece check_out yapıldığında hesapla
    IF NEW.check_out_time IS NOT NULL AND (OLD.check_out_time IS NULL OR OLD.id IS NULL) THEN
        -- Hesaplamayı yap
        SELECT * INTO v_result 
        FROM calculate_earnings_and_penalties(NEW.id);
        
        -- Sonuçları kaydet
        NEW.overtime_minutes := v_result.overtime_mins;
        NEW.late_arrival_minutes := v_result.late_mins;
        NEW.early_leave_minutes := v_result.early_leave_mins;
        NEW.overtime_amount := v_result.overtime_pay;
        NEW.late_penalty := v_result.late_penalty_amount;
        NEW.early_leave_penalty := v_result.early_penalty_amount;
        NEW.daily_earnings := v_result.daily_pay;
        NEW.net_earnings := v_result.net_pay;
        NEW.expected_check_in := (SELECT shift_start_time FROM personnel WHERE id = NEW.personnel_id);
        NEW.expected_check_out := (SELECT shift_end_time FROM personnel WHERE id = NEW.personnel_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger'ı YENİDEN EKLE
CREATE TRIGGER trigger_auto_calculate_earnings
    BEFORE UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION trigger_calculate_earnings();

-- 6. Test et - Fonksiyonun varlığını kontrol et
SELECT 
    'Fonksiyon başarıyla oluşturuldu!' as status,
    proname as function_name,
    proargtypes::regtype[] as parameter_types
FROM pg_proc
WHERE proname = 'calculate_earnings_and_penalties';

-- 7. Trigger'ın varlığını kontrol et
SELECT 
    'Trigger başarıyla oluşturuldu!' as status,
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trigger_auto_calculate_earnings';

-- TAMAMLANDI!
SELECT '✅ Çıkış hatası düzeltildi! Artık çıkış yapabilirsiniz.' as message;
