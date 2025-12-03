-- FIX: UUID parametresi için fonksiyonu güncelle
-- Bu script migration-mesai-hesaplama.sql'deki fonksiyonu düzeltir

-- 1. Eski trigger'ı kaldır
DROP TRIGGER IF EXISTS trigger_auto_calculate_earnings ON attendance;

-- 2. Fonksiyonu UUID ile yeniden oluştur
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
        RAISE EXCEPTION 'Attendance record not found';
    END IF;
    
    -- Personnel bilgilerini getir
    SELECT * INTO v_personnel 
    FROM personnel 
    WHERE id = v_attendance.personnel_id;
    
    -- Sadece saatleri al
    v_check_in_time := v_attendance.check_in_time::TIME;
    v_check_out_time := COALESCE(v_attendance.check_out_time::TIME, CURRENT_TIME);
    v_expected_in := v_personnel.shift_start_time;
    v_expected_out := v_personnel.shift_end_time;
    
    -- Çalışılan dakika
    v_worked_minutes := EXTRACT(EPOCH FROM (v_check_out_time - v_check_in_time))/60;
    
    -- Beklenen çalışma dakikası
    v_expected_minutes := v_personnel.standard_work_hours * 60;
    
    -- GEÇ KALMA hesapla (tolerans 15 dakika)
    IF v_check_in_time > v_expected_in + INTERVAL '15 minutes' THEN
        v_late_minutes := EXTRACT(EPOCH FROM (v_check_in_time - v_expected_in))/60;
        v_late_penalty := v_late_minutes * v_personnel.minute_wage;
    END IF;
    
    -- ERKEN ÇIKMA hesapla
    IF v_check_out_time < v_expected_out THEN
        v_early_leave_minutes := EXTRACT(EPOCH FROM (v_expected_out - v_check_out_time))/60;
        v_early_penalty := v_early_leave_minutes * v_personnel.minute_wage;
    END IF;
    
    -- FAZLA MESAİ hesapla (1.5x)
    IF v_worked_minutes > v_expected_minutes THEN
        v_overtime_minutes := v_worked_minutes - v_expected_minutes;
        v_overtime_amount := v_overtime_minutes * v_personnel.minute_wage * 1.5;
    END IF;
    
    -- Günlük kazanç
    v_daily_earnings := v_personnel.daily_wage + v_overtime_amount;
    
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

-- 3. Trigger fonksiyonunu yeniden oluştur
CREATE OR REPLACE FUNCTION trigger_calculate_earnings()
RETURNS TRIGGER AS $$
DECLARE
    v_result RECORD;
BEGIN
    -- Sadece check_out yapıldığında hesapla
    IF NEW.check_out_time IS NOT NULL AND OLD.check_out_time IS NULL THEN
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

-- 4. Trigger'ı yeniden ekle
CREATE TRIGGER trigger_auto_calculate_earnings
    BEFORE UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION trigger_calculate_earnings();

-- 5. Test et
SELECT 'Migration completed successfully!' as status;
