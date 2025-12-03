# Netlify Environment Variables Ayarları

## 🔐 Gerekli Environment Variables

Netlify Dashboard → Site Settings → Environment Variables → Add Variable

### **DATABASE_URL** (Zorunlu!)
```
Key: DATABASE_URL
Value: postgresql://restaurant_app:RestaurantDB2024Secure@5.175.136.149:5432/restaurant_tracking
```

### Opsiyonel (Eski API'ler için)
```
Key: VITE_DB_HOST
Value: 5.175.136.149

Key: VITE_DB_PORT
Value: 5432

Key: VITE_DB_NAME
Value: restaurant_tracking

Key: VITE_DB_USER
Value: restaurant_app

Key: VITE_DB_PASSWORD
Value: RestaurantDB2024Secure
```

## 📋 Adım Adım

1. **Netlify Dashboard'a Git**
   - https://app.netlify.com
   - takibonline sitesini seç

2. **Environment Variables'a Git**
   - Site configuration
   - Environment variables

3. **DATABASE_URL Ekle**
   - Add a variable
   - Key: DATABASE_URL
   - Value: yukarıdaki connection string
   - Scope: Production + Deploy previews + Branch deploys (hepsini seç)
   - Save

4. **Redeploy**
   - Deploys → Trigger deploy
   - Deploy site

5. **Test Et**
   - 2-3 dakika bekle
   - https://takibonline.netlify.app/qr/cengelkoy
   - Console'da logları kontrol et

## ✅ Başarılı Olursa:

Console'da göreceksin:
```
🔄 QR Generate başlatıldı - Location: cengelkoy
📡 API Response status: 200
📦 API Result: {success: true, token: "abc123..."}
✅ QR URL oluşturuldu
✅ QR DataURL oluşturuldu
```

## ❌ Hala Hata Varsa:

Console'da göreceksin:
```
❌ connect ECONNREFUSED 127.0.0.1:5432
```

Bu durumda:
- Environment variable doğru girilmiş mi kontrol et
- Deploy yeni mi (en son commit'ten sonra)
- Database'e dışarıdan erişim açık mı

## 🧪 Database Bağlantı Testi:

Local'de test et:
```bash
psql -h 5.175.136.149 -U restaurant_app -d restaurant_tracking -c "SELECT 1"
```

Eğer bağlanırsa, sorun Netlify environment variable'ında.
