-- TEST PERSONEL EKLEME
-- TEST001 / 1234 şifresiyle test personeli ekler

-- 1. Önce lokasyon var mı kontrol et (yoksa oluştur)
INSERT INTO locations (location_code, name, address, is_active)
VALUES ('TEST', 'Test Restaurant', 'Test Adresi', true)
ON CONFLICT (location_code) DO NOTHING;

-- 2. Test personeli ekle (şifre hash'li: 1234)
-- bcrypt hash for "1234": $2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUe/.ECR4a

INSERT INTO personnel (
    personnel_no,
    name,
    surname,
    email,
    phone,
    position,
    location_id,
    monthly_salary,
    daily_wage,
    hourly_wage,
    minute_wage,
    standard_work_hours,
    shift_start_time,
    shift_end_time,
    password_hash,
    is_active,
    hire_date
) VALUES (
    'TEST001',
    'Test',
    'Kullanıcı',
    'test@test.com',
    '5551234567',
    'Test Personel',
    (SELECT id FROM locations WHERE location_code = 'TEST' LIMIT 1),
    30000.00,
    1000.00,
    125.00,
    2.08,
    8,
    '09:00:00',
    '18:00:00',
    '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUe/.ECR4a', -- Şifre: 1234
    true,
    CURRENT_DATE
)
ON CONFLICT (personnel_no) DO UPDATE SET
    password_hash = '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUe/.ECR4a',
    is_active = true;

-- 3. Başarı mesajı
SELECT 
    'TEST001 personeli eklendi!' as message,
    personnel_no,
    name || ' ' || surname as full_name,
    'Şifre: 1234' as password_info
FROM personnel 
WHERE personnel_no = 'TEST001';

-- 4. Login bilgileri
SELECT '
===========================================
✅ TEST PERSONEL EKLENDİ!
===========================================

📋 Login Bilgileri:
   Personel No: TEST001
   Şifre: 1234

🏢 Lokasyon: Test Restaurant
💰 Maaş: 30,000 TL
⏰ Vardiya: 09:00 - 18:00

Test için QR okutup bu bilgilerle giriş yap!
===========================================
' as login_info;
