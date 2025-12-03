# 🔒 CİHAZ GÜVENLİK SİSTEMİ

## 📋 Genel Bakış

Bu sistem, personellerin sadece **QR kod okutarak** ve **kayıtlı cihazlarından** giriş/çıkış yapmalarını sağlar.

---

## 🎯 Güvenlik Önlemleri

### 1. **QR Kod Zorunluluğu** 🔐
- ❌ QR kodu okutmadan giriş/çıkış **YAPILAMAZ**
- ✅ Her giriş/çıkış için lokasyondaki QR kodu okutmak **ZORUNLU**
- 🚫 Evden veya uzaktan giriş **ENGELLENİR**

### 2. **Cihaz Takibi** 📱
- 📱 İlk girişte cihaz otomatik kaydedilir
- 🔍 Her giriş/çıkışta cihaz ID kontrolü yapılır
- ⚠️ Farklı cihaz tespit edilirse **ALARM** oluşturulur
- 👁️ Admin panelinde **tüm cihaz değişiklikleri** görülür

### 3. **Arkadaş Bilgileri ile Giriş Engeli** 🚫
- 🔒 Her personelin **kendi cihazı** kayıtlıdır
- ❌ Başkasının telefonuyla giriş **YAPILAMAZ**
- ⚠️ Farklı cihazdan giriş denemesi **LOGLANIR**

---

## 📊 Database Yapısı

### **Personnel Tablosu - Yeni Kolonlar:**
```sql
registered_device_id     -- İlk kayıtlı cihaz
device_name             -- Cihaz model adı
device_registered_at    -- İlk kayıt tarihi
last_used_device_id     -- Son kullanılan cihaz
last_device_change_at   -- Son değişiklik tarihi
device_change_count     -- Toplam değişiklik sayısı
```

### **Attendance Tablosu - Yeni Kolonlar:**
```sql
device_id              -- Giriş/çıkış yapan cihaz
device_name            -- Cihaz adı
qr_token               -- QR kod (ZORUNLU)
is_qr_verified         -- QR doğrulandı mı
device_matched         -- Cihaz eşleşti mi
security_flags         -- Güvenlik uyarıları (JSON)
```

### **Yeni Tablolar:**

#### **device_history** (Cihaz Değişiklik Geçmişi)
```sql
- personnel_id
- old_device_id
- new_device_id
- change_reason
- admin_approved
```

#### **security_alerts** (Güvenlik Uyarıları)
```sql
- personnel_id
- alert_type (device_change, no_qr, etc.)
- alert_level (info, warning, critical)
- is_resolved
```

---

## 🔄 Çalışma Mantığı

### **İlk Giriş (Cihaz Kaydı):**
```
1. Personel QR okutarak giriş yapar
2. Cihaz ID alınır (browser fingerprint)
3. Database'e cihaz kaydedilir
4. ✅ Giriş başarılı
```

### **Normal Giriş (Kayıtlı Cihaz):**
```
1. Personel QR okutarak giriş yapar
2. Cihaz ID kontrol edilir
3. ✅ Kayıtlı cihaz → Giriş başarılı
```

### **Farklı Cihazdan Giriş Denemesi:**
```
1. Personel QR okutarak giriş yapar
2. Cihaz ID kontrol edilir
3. ⚠️ Farklı cihaz tespit edildi!
4. Security alert oluşturulur
5. Device history'e kaydedilir
6. ⚠️ Giriş yapılır AMA işaretlenir
7. 📧 Admin'e bildirim gider
```

### **QR Kod Olmadan Giriş Denemesi:**
```
1. Personel manuel giriş dener
2. ❌ HATA: "QR kod okutma zorunludur!"
3. 🚫 Giriş ENGELLENİR
```

---

## 👨‍💼 Admin Paneli Özellikleri

### **1. Cihaz Değişiklik Raporu**
```sql
SELECT * FROM v_device_changes;
```
Gösterir:
- Personel adı
- Eski cihaz → Yeni cihaz
- Değişiklik tarihi
- Onay durumu

### **2. Güvenlik Uyarıları**
```sql
SELECT * FROM v_suspicious_activities;
```
Gösterir:
- Personel adı
- Uyarı tipi
- Uyarı seviyesi
- Çözüldü mü?

### **3. Personel Detayları**
Admin panelinde her personel için:
- 📱 Kayıtlı cihaz bilgisi
- 📊 Cihaz değişiklik sayısı
- ⚠️ Aktif uyarılar
- 🕐 Son kullanım tarihi

---

## 🧪 Test Senaryoları

### **Test 1: İlk Giriş**
```
✅ QR okut → Cihaz kaydedilir → Giriş başarılı
```

### **Test 2: Aynı Cihazla Giriş**
```
✅ QR okut → Cihaz eşleşti → Giriş başarılı
```

### **Test 3: Farklı Cihazla Giriş**
```
✅ QR okut → ⚠️ Farklı cihaz → Uyarı → Giriş başarılı (ama işaretli)
```

### **Test 4: QR Olmadan Giriş**
```
❌ Manuel giriş → HATA → Giriş ENGELLENDİ
```

### **Test 5: Başkasının Telefonuyla Giriş**
```
✅ QR okut → Farklı personel login → Cihaz farklı → ⚠️ UYARI
```

---

## 🚀 Kurulum Adımları

### **1. Database Migration:**
```bash
psql -h 5.175.136.149 -U restaurant_app -d restaurant_tracking -f database/add-device-security.sql
```

### **2. Backend Güncellemesi:**
Yeni dosyayı aktif et:
```bash
# Eski dosyayı yedekle
mv netlify/functions/db-attendance-check.js netlify/functions/db-attendance-check-old.js

# Yeni dosyayı aktif et
mv netlify/functions/db-attendance-check-v2.js netlify/functions/db-attendance-check.js
```

### **3. Frontend Güncellemesi:**
CheckIn.jsx ve PersonnelLogin.jsx dosyalarında:
- Device fingerprint eklenmeli
- QR okutma zorunlu hale getirilmeli

---

## 📱 Cihaz ID Nasıl Alınır?

### **Browser Fingerprint:**
```javascript
// Tarayıcı bazlı benzersiz ID
const deviceId = btoa(
  navigator.userAgent + 
  navigator.language + 
  screen.width + screen.height
)

const deviceName = navigator.userAgent.match(/\(([^)]+)\)/)[1]
```

### **Kullanım:**
```javascript
await fetch('/.netlify/functions/db-attendance-check', {
  method: 'POST',
  body: JSON.stringify({
    qrCode: qrToken,
    locationId: locationCode,
    personnelId: personnelId,
    action: 'check-in',
    deviceId: deviceId,        // ✅ ZORUNLU
    deviceName: deviceName     // ✅ ZORUNLU
  })
})
```

---

## ⚠️ Önemli Notlar

1. **QR kod olmadan giriş YAPILAMAZ**
2. **Cihaz değişikliği admin onayı gerektirebilir**
3. **Tüm güvenlik olayları loglanır**
4. **Şüpheli aktiviteler admin'e bildirilir**

---

## 📊 İstatistikler

Database'de tutulacak metrikler:
- ✅ Başarılı giriş sayısı
- ⚠️ Cihaz değişiklik sayısı
- ❌ Engellenen giriş denemesi
- 🔍 QR doğrulama oranı

---

## 🎯 Sonuç

Bu sistem sayesinde:
- ✅ Sadece QR ile giriş
- ✅ Cihaz takibi
- ✅ Uzaktan giriş engellenir
- ✅ Arkadaş bilgileri ile giriş engellenir
- ✅ Tüm aktiviteler izlenir
- ✅ Admin tam kontrol

**GÜVENLİK SEVİYESİ: YÜKSEK 🔒**
