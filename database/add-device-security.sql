-- ========================================
-- CİHAZ GÜVENLİK SİSTEMİ
-- Amaç: 
-- 1. Her personelin cihazını kaydet
-- 2. QR okutmayı zorunlu yap
-- 3. Farklı cihazdan giriş tespiti
-- 4. Uzaktan giriş engelleme
-- ========================================

-- 1. Personnel tablosuna device bilgileri ekle
ALTER TABLE personnel 
ADD COLUMN IF NOT EXISTS registered_device_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS device_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS device_registered_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_used_device_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_device_change_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS device_change_count INTEGER DEFAULT 0;

COMMENT ON COLUMN personnel.registered_device_id IS 'İlk kayıtlı cihaz ID (fingerprint)';
COMMENT ON COLUMN personnel.device_name IS 'Cihaz model adı (ör: iPhone 13)';
COMMENT ON COLUMN personnel.device_registered_at IS 'Cihaz ilk kayıt tarihi';
COMMENT ON COLUMN personnel.last_used_device_id IS 'Son kullanılan cihaz ID';
COMMENT ON COLUMN personnel.last_device_change_at IS 'Son cihaz değişiklik tarihi';
COMMENT ON COLUMN personnel.device_change_count IS 'Cihaz değiştirme sayısı';

-- 2. Attendance tablosuna güvenlik bilgileri ekle
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS device_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS device_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS qr_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_qr_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS device_matched BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS security_flags JSONB DEFAULT '{}';

COMMENT ON COLUMN attendance.device_id IS 'Giriş/çıkış yapan cihaz ID';
COMMENT ON COLUMN attendance.device_name IS 'Cihaz model adı';
COMMENT ON COLUMN attendance.qr_token IS 'QR kod token (zorunlu)';
COMMENT ON COLUMN attendance.is_qr_verified IS 'QR kod doğrulandı mı';
COMMENT ON COLUMN attendance.device_matched IS 'Cihaz kayıtlı cihazla eşleşti mi';
COMMENT ON COLUMN attendance.security_flags IS 'Güvenlik uyarıları (JSON)';

-- 3. Device history tablosu (cihaz değişiklik geçmişi)
CREATE TABLE IF NOT EXISTS device_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    personnel_id UUID REFERENCES personnel(id) NOT NULL,
    old_device_id VARCHAR(255),
    new_device_id VARCHAR(255) NOT NULL,
    old_device_name VARCHAR(255),
    new_device_name VARCHAR(255),
    change_reason VARCHAR(100),
    changed_at TIMESTAMP DEFAULT NOW(),
    ip_address VARCHAR(50),
    location_id UUID REFERENCES locations(id),
    admin_approved BOOLEAN DEFAULT false,
    admin_note TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_history_personnel ON device_history(personnel_id);
CREATE INDEX IF NOT EXISTS idx_device_history_date ON device_history(changed_at);

COMMENT ON TABLE device_history IS 'Personel cihaz değişiklik geçmişi';

-- 4. Security alerts tablosu (güvenlik uyarıları)
CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    personnel_id UUID REFERENCES personnel(id) NOT NULL,
    alert_type VARCHAR(50) NOT NULL, -- 'device_change', 'no_qr', 'suspicious_location', etc.
    alert_level VARCHAR(20) DEFAULT 'warning', -- 'info', 'warning', 'critical'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_personnel ON security_alerts(personnel_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_resolved ON security_alerts(is_resolved);

COMMENT ON TABLE security_alerts IS 'Güvenlik uyarıları ve şüpheli aktiviteler';

-- 5. Cihaz değişikliği tespit fonksiyonu
CREATE OR REPLACE FUNCTION check_device_change()
RETURNS TRIGGER AS $$
DECLARE
    v_registered_device VARCHAR(255);
    v_device_count INTEGER;
BEGIN
    -- Personelin kayıtlı cihazını al
    SELECT registered_device_id INTO v_registered_device
    FROM personnel
    WHERE id = NEW.personnel_id;
    
    -- İlk kez cihaz kaydediliyor
    IF v_registered_device IS NULL THEN
        UPDATE personnel 
        SET 
            registered_device_id = NEW.device_id,
            device_name = NEW.device_name,
            device_registered_at = NOW(),
            last_used_device_id = NEW.device_id
        WHERE id = NEW.personnel_id;
        
        NEW.device_matched := true;
        NEW.security_flags := jsonb_build_object(
            'first_device', true,
            'message', 'İlk cihaz kaydı'
        );
        
    -- Cihaz değişmiş
    ELSIF v_registered_device != NEW.device_id THEN
        -- Device history'e kaydet
        INSERT INTO device_history (
            personnel_id, 
            old_device_id, 
            new_device_id,
            old_device_name,
            new_device_name,
            change_reason,
            location_id,
            ip_address
        ) VALUES (
            NEW.personnel_id,
            v_registered_device,
            NEW.device_id,
            (SELECT device_name FROM personnel WHERE id = NEW.personnel_id),
            NEW.device_name,
            'automatic_detection',
            NEW.location_id,
            NEW.ip_address
        );
        
        -- Security alert oluştur
        INSERT INTO security_alerts (
            personnel_id,
            alert_type,
            alert_level,
            title,
            description,
            metadata
        ) VALUES (
            NEW.personnel_id,
            'device_change',
            'warning',
            'Yeni Cihaz Tespit Edildi',
            'Personel farklı bir cihazdan giriş yaptı',
            jsonb_build_object(
                'old_device', v_registered_device,
                'new_device', NEW.device_id,
                'location', NEW.location_id,
                'time', NOW()
            )
        );
        
        -- Personnel kaydını güncelle
        UPDATE personnel 
        SET 
            last_used_device_id = NEW.device_id,
            last_device_change_at = NOW(),
            device_change_count = device_change_count + 1
        WHERE id = NEW.personnel_id;
        
        NEW.device_matched := false;
        NEW.security_flags := jsonb_build_object(
            'device_changed', true,
            'alert_created', true,
            'message', 'Farklı cihaz tespit edildi'
        );
        
    -- Cihaz aynı
    ELSE
        UPDATE personnel 
        SET last_used_device_id = NEW.device_id
        WHERE id = NEW.personnel_id;
        
        NEW.device_matched := true;
        NEW.security_flags := jsonb_build_object(
            'device_verified', true
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger ekle
DROP TRIGGER IF EXISTS trigger_check_device_change ON attendance;
CREATE TRIGGER trigger_check_device_change
    BEFORE INSERT ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION check_device_change();

-- 7. QR doğrulama fonksiyonu
CREATE OR REPLACE FUNCTION validate_qr_token(
    p_qr_token VARCHAR(255),
    p_location_code VARCHAR(50)
)
RETURNS TABLE (
    is_valid BOOLEAN,
    location_id UUID,
    message TEXT
) AS $$
DECLARE
    v_location_id UUID;
    v_qr_created_at TIMESTAMP;
    v_qr_location_code VARCHAR(50);
BEGIN
    -- QR code tablosundan token'ı bul
    SELECT 
        qc.location_id,
        qc.created_at,
        l.location_code
    INTO 
        v_location_id,
        v_qr_created_at,
        v_qr_location_code
    FROM qr_codes qc
    JOIN locations l ON qc.location_id = l.id
    WHERE qc.qr_code = p_qr_token
    AND qc.is_active = true
    LIMIT 1;
    
    -- QR bulunamadı
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, 'Geçersiz QR kod';
        RETURN;
    END IF;
    
    -- Lokasyon eşleşmiyor
    IF v_qr_location_code != p_location_code THEN
        RETURN QUERY SELECT false, NULL::UUID, 'QR kod farklı lokasyona ait';
        RETURN;
    END IF;
    
    -- QR çok eski (24 saatten eski)
    IF v_qr_created_at < NOW() - INTERVAL '24 hours' THEN
        RETURN QUERY SELECT false, NULL::UUID, 'QR kod süresi dolmuş';
        RETURN;
    END IF;
    
    -- Başarılı
    RETURN QUERY SELECT true, v_location_id, 'QR kod doğrulandı';
END;
$$ LANGUAGE plpgsql;

-- 8. View: Şüpheli aktiviteler
CREATE OR REPLACE VIEW v_suspicious_activities AS
SELECT 
    p.name || ' ' || p.surname as personnel_name,
    p.personnel_no,
    sa.alert_type,
    sa.alert_level,
    sa.title,
    sa.description,
    sa.is_resolved,
    sa.created_at,
    l.name as location_name
FROM security_alerts sa
JOIN personnel p ON sa.personnel_id = p.id
LEFT JOIN device_history dh ON sa.personnel_id = dh.personnel_id 
    AND sa.created_at::date = dh.changed_at::date
LEFT JOIN locations l ON dh.location_id = l.id
WHERE sa.is_resolved = false
ORDER BY sa.created_at DESC;

-- 9. View: Cihaz değişiklik raporu
CREATE OR REPLACE VIEW v_device_changes AS
SELECT 
    p.name || ' ' || p.surname as personnel_name,
    p.personnel_no,
    dh.old_device_id,
    dh.new_device_id,
    dh.old_device_name,
    dh.new_device_name,
    dh.changed_at,
    l.name as location_name,
    dh.admin_approved,
    dh.admin_note
FROM device_history dh
JOIN personnel p ON dh.personnel_id = p.id
LEFT JOIN locations l ON dh.location_id = l.id
ORDER BY dh.changed_at DESC;

-- TAMAMLANDI!
SELECT '✅ Cihaz güvenlik sistemi kuruldu!' as message;
SELECT '✅ QR doğrulama aktif!' as message;
SELECT '✅ Cihaz değişikliği takibi aktif!' as message;
