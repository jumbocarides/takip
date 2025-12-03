-- =====================================================
-- MESAİ VE HAK EDİŞ OTOMATIK HESAPLAMA SİSTEMİ
-- Migration Script
-- =====================================================

-- 1. PERSONNEL tablosuna ücret hesaplama kolonları ekle
ALTER TABLE personnel 
ADD COLUMN IF NOT EXISTS monthly_salary DECIMAL(10, 2) DEFAULT 30000.00,
ADD COLUMN IF NOT EXISTS daily_wage DECIMAL(10, 2) GENERATED ALWAYS AS (monthly_salary / 30) STORED,
ADD COLUMN IF NOT EXISTS hourly_wage DECIMAL(10, 2) GENERATED ALWAYS AS (monthly_salary / 30 / 8) STORED,
ADD COLUMN IF NOT EXISTS minute_wage DECIMAL(10, 2) GENERATED ALWAYS AS (monthly_salary / 30 / 8 / 60) STORED,
ADD COLUMN IF NOT EXISTS standard_work_hours DECIMAL(4, 2) DEFAULT 8.00,
ADD COLUMN IF NOT EXISTS shift_start_time TIME DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS shift_end_time TIME DEFAULT '18:00:00';

COMMENT ON COLUMN personnel.monthly_salary IS 'Aylık maaş (TL)';
COMMENT ON COLUMN personnel.daily_wage IS 'Günlük ücret (otomatik hesaplanır)';
COMMENT ON COLUMN personnel.hourly_wage IS 'Saatlik ücret (otomatik hesaplanır)';
COMMENT ON COLUMN personnel.minute_wage IS 'Dakikalık ücret (otomatik hesaplanır)';
COMMENT ON COLUMN personnel.standard_work_hours IS 'Standart günlük çalışma saati';
COMMENT ON COLUMN personnel.shift_start_time IS 'Vardiya başlangıç saati';
COMMENT ON COLUMN personnel.shift_end_time IS 'Vardiya bitiş saati';

-- 2. ATTENDANCE tablosuna mesai hesaplama kolonları ekle
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS expected_check_in TIME,
ADD COLUMN IF NOT EXISTS expected_check_out TIME,
ADD COLUMN IF NOT EXISTS late_arrival_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS early_leave_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS overtime_amount DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS late_penalty DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS early_leave_penalty DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS daily_earnings DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS net_earnings DECIMAL(10, 2) DEFAULT 0.00;

COMMENT ON COLUMN attendance.expected_check_in IS 'Beklenen giriş saati';
COMMENT ON COLUMN attendance.expected_check_out IS 'Beklenen çıkış saati';
COMMENT ON COLUMN attendance.late_arrival_minutes IS 'Geç kalma süresi (dakika)';
COMMENT ON COLUMN attendance.early_leave_minutes IS 'Erken çıkma süresi (dakika)';
COMMENT ON COLUMN attendance.overtime_minutes IS 'Fazla mesai süresi (dakika)';
COMMENT ON COLUMN attendance.overtime_amount IS 'Fazla mesai ücreti (1.5x)';
COMMENT ON COLUMN attendance.late_penalty IS 'Geç kalma kesintisi';
COMMENT ON COLUMN attendance.early_leave_penalty IS 'Erken çıkış kesintisi';
COMMENT ON COLUMN attendance.daily_earnings IS 'Günlük brüt kazanç';
COMMENT ON COLUMN attendance.net_earnings IS 'Net kazanç (kesintiler sonrası)';

-- 3. Mevcut personellerin maaşlarını güncelle (örnek değerler)
UPDATE personnel SET monthly_salary = 30000 WHERE personnel_no = 'P001';
UPDATE personnel SET monthly_salary = 25000 WHERE personnel_no = 'P002';
UPDATE personnel SET monthly_salary = 35000 WHERE personnel_no = 'P003';
UPDATE personnel SET monthly_salary = 28000 WHERE personnel_no = 'P004';

-- 4. Mesai hesaplama fonksiyonu
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
    
    -- ERKEN ÇIKIŞ hesapla
    IF v_attendance.check_out_time IS NOT NULL AND v_check_out_time < v_expected_out THEN
        v_early_leave_minutes := EXTRACT(EPOCH FROM (v_expected_out - v_check_out_time))/60;
        v_early_penalty := v_early_leave_minutes * v_personnel.minute_wage;
    END IF;
    
    -- FAZLA MESAİ hesapla (1.5x ücret)
    IF v_worked_minutes > v_expected_minutes THEN
        v_overtime_minutes := v_worked_minutes - v_expected_minutes;
        v_overtime_amount := v_overtime_minutes * v_personnel.minute_wage * 1.5;
    END IF;
    
    -- GÜNLÜK KAZANÇ (tam gün çalıştıysa)
    IF v_worked_minutes >= v_expected_minutes THEN
        v_daily_earnings := v_personnel.daily_wage;
    ELSE
        -- Eksik çalıştıysa oranla
        v_daily_earnings := (v_worked_minutes::DECIMAL / v_expected_minutes) * v_personnel.daily_wage;
    END IF;
    
    -- NET KAZANÇ hesapla
    v_net_earnings := v_daily_earnings + v_overtime_amount - v_late_penalty - v_early_penalty;
    
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

-- 5. Otomatik hesaplama için trigger
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
        NEW.overtime_minutes := v_result.overtime_pay;
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

-- Trigger'ı ekle
DROP TRIGGER IF EXISTS trigger_auto_calculate_earnings ON attendance;
CREATE TRIGGER trigger_auto_calculate_earnings
    BEFORE UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION trigger_calculate_earnings();

-- 6. Aylık özet tablosu
CREATE TABLE IF NOT EXISTS monthly_earnings (
    id SERIAL PRIMARY KEY,
    personnel_id INTEGER REFERENCES personnel(id),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    total_days_worked INTEGER DEFAULT 0,
    total_work_hours DECIMAL(10, 2) DEFAULT 0.00,
    total_overtime_hours DECIMAL(10, 2) DEFAULT 0.00,
    total_late_minutes INTEGER DEFAULT 0,
    base_salary DECIMAL(10, 2) DEFAULT 0.00,
    overtime_earnings DECIMAL(10, 2) DEFAULT 0.00,
    total_penalties DECIMAL(10, 2) DEFAULT 0.00,
    net_salary DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(personnel_id, year, month)
);

COMMENT ON TABLE monthly_earnings IS 'Aylık kazanç özeti';

-- 7. Test için örnek hesaplama view
CREATE OR REPLACE VIEW v_daily_earnings_summary AS
SELECT 
    p.personnel_no,
    p.name || ' ' || p.surname as personnel_name,
    p.monthly_salary,
    p.daily_wage,
    p.hourly_wage,
    p.minute_wage,
    DATE(a.check_in_time) as work_date,
    a.check_in_time::TIME as actual_check_in,
    a.check_out_time::TIME as actual_check_out,
    a.expected_check_in,
    a.expected_check_out,
    a.work_hours,
    a.late_arrival_minutes,
    a.early_leave_minutes,
    a.overtime_minutes,
    a.daily_earnings,
    a.overtime_amount,
    a.late_penalty,
    a.early_leave_penalty,
    a.net_earnings
FROM attendance a
JOIN personnel p ON a.personnel_id = p.id
WHERE a.check_out_time IS NOT NULL
ORDER BY a.check_in_time DESC;

-- =====================================================
-- BAŞARILI!
-- =====================================================
-- Artık sistem:
-- 1. Her personel için aylık maaştan otomatik günlük/saatlik/dakikalık ücret hesaplar
-- 2. Giriş/çıkış yapıldığında geç kalma, erken çıkma, fazla mesai hesaplar
-- 3. Net kazancı otomatik belirler
-- 4. v_daily_earnings_summary view'dan günlük detayları görebilirsiniz
-- =====================================================
