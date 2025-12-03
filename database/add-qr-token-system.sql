-- =====================================================
-- QR TOKEN GÜVENLİK SİSTEMİ
-- Benzersiz, süreli, tek kullanımlık QR tokenları
-- =====================================================

-- 1. QR Tokens Tablosu
CREATE TABLE IF NOT EXISTS qr_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token VARCHAR(64) UNIQUE NOT NULL,
    location_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    used_by UUID REFERENCES personnel(id),
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- İndexler
CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_expires ON qr_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_used ON qr_tokens(is_used);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_location ON qr_tokens(location_id);

COMMENT ON TABLE qr_tokens IS 'QR kod güvenlik tokenları - 5 dakika geçerli, tek kullanımlık';
COMMENT ON COLUMN qr_tokens.token IS 'Benzersiz token (32 karakter hex)';
COMMENT ON COLUMN qr_tokens.expires_at IS 'Token son kullanma tarihi (5 dakika)';
COMMENT ON COLUMN qr_tokens.is_used IS 'Token kullanıldı mı?';

-- 2. Otomatik temizleme fonksiyonu (eski tokenları sil)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    -- 1 saatten eski tokenları sil
    DELETE FROM qr_tokens 
    WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- 3. Token kullanımı işaretleme fonksiyonu
CREATE OR REPLACE FUNCTION mark_token_as_used(
    p_token VARCHAR(64),
    p_personnel_id UUID DEFAULT NULL,
    p_ip VARCHAR(45) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    UPDATE qr_tokens
    SET 
        is_used = TRUE,
        used_at = NOW(),
        used_by = p_personnel_id,
        ip_address = p_ip,
        user_agent = p_user_agent
    WHERE token = p_token
      AND is_used = FALSE;
    
    IF FOUND THEN
        RETURN json_build_object(
            'success', true,
            'message', 'Token kullanıldı olarak işaretlendi'
        );
    ELSE
        RETURN json_build_object(
            'success', false,
            'error', 'Token bulunamadı veya zaten kullanılmış'
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. Token istatistikleri view
CREATE OR REPLACE VIEW v_token_stats AS
SELECT 
    DATE(created_at) as date,
    location_id,
    COUNT(*) as total_generated,
    COUNT(CASE WHEN is_used THEN 1 END) as total_used,
    COUNT(CASE WHEN expires_at < NOW() AND NOT is_used THEN 1 END) as expired_unused,
    ROUND(
        COUNT(CASE WHEN is_used THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(*), 0) * 100, 
        2
    ) as usage_rate
FROM qr_tokens
GROUP BY DATE(created_at), location_id
ORDER BY date DESC, location_id;

COMMENT ON VIEW v_token_stats IS 'QR token kullanım istatistikleri';

-- 5. Otomatik temizleme için scheduled job önerisi
-- NOT: PostgreSQL'de pg_cron extension gerekiyor
-- Manuel olarak cronjob ile çağrılabilir:
-- SELECT cleanup_expired_tokens();

-- =====================================================
-- BAŞARI MESAJI
-- =====================================================
SELECT '
╔════════════════════════════════════════════╗
║   ✅ QR TOKEN SİSTEMİ KURULDU!            ║
╠════════════════════════════════════════════╣
║                                            ║
║  🔒 Güvenlik Özellikleri:                  ║
║    • Benzersiz 32 karakter token           ║
║    • 5 dakika geçerlilik süresi            ║
║    • Tek kullanımlık (is_used flag)        ║
║    • Lokasyon bazlı                        ║
║    • IP ve user agent kaydı                ║
║                                            ║
║  📊 İstatistikler:                         ║
║    SELECT * FROM v_token_stats;            ║
║                                            ║
║  🧹 Temizleme:                             ║
║    SELECT cleanup_expired_tokens();        ║
║                                            ║
║  ⚙️ Kullanım:                              ║
║    1. QR Display → Token üret              ║
║    2. Personel tarar → Token validate      ║
║    3. Check-in → Token kullanıldı işaretle ║
║                                            ║
╚════════════════════════════════════════════╝
' AS "✅ QR TOKEN SİSTEMİ HAZIR";
