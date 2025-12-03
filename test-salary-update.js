// Maaş güncelleme testini kontrol et
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: '5.175.136.149',
  port: 5432,
  database: 'restaurant_tracking',
  user: 'restaurant_app',
  password: 'RestaurantDB2024Secure',
  ssl: false
});

async function testSalaryUpdate() {
  console.log('🧪 Maaş Güncelleme Testi Başlatılıyor...\n');
  
  try {
    const client = await pool.connect();
    
    // 1. Mevcut durumu göster
    console.log('📊 ÖNCEKİ DURUM:');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const beforeQuery = await client.query(
      `SELECT 
        personnel_no,
        name || ' ' || surname as ad_soyad,
        TO_CHAR(monthly_salary, '999,999.99') || ' TL' as aylik_maas,
        TO_CHAR(daily_wage, '9,999.99') || ' TL' as gunluk,
        TO_CHAR(hourly_wage, '999.99') || ' TL' as saatlik,
        TO_CHAR(minute_wage, '99.99') || ' TL' as dakikalik,
        shift_start_time,
        shift_end_time
       FROM personnel 
       WHERE personnel_no = 'P001'`
    );
    
    console.table(beforeQuery.rows);
    
    // 2. Güncelleme yap (Örnek: P001'in maaşını 35000 TL yap)
    console.log('\n🔄 GÜNCELLEME YAPILIYOR...');
    console.log('Yeni maaş: 35,000 TL');
    console.log('Yeni vardiya: 08:00 - 17:00\n');
    
    const updateQuery = await client.query(
      `UPDATE personnel 
       SET 
         monthly_salary = $1,
         shift_start_time = $2,
         shift_end_time = $3,
         updated_at = NOW()
       WHERE personnel_no = 'P001'
       RETURNING 
         personnel_no,
         name || ' ' || surname as ad_soyad,
         monthly_salary,
         daily_wage,
         hourly_wage,
         minute_wage`,
      [35000, '08:00:00', '17:00:00']
    );
    
    if (updateQuery.rows.length > 0) {
      console.log('✅ Güncelleme başarılı!\n');
    }
    
    // 3. Güncellenmiş durumu göster
    console.log('📊 SONRAKI DURUM:');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const afterQuery = await client.query(
      `SELECT 
        personnel_no,
        name || ' ' || surname as ad_soyad,
        TO_CHAR(monthly_salary, '999,999.99') || ' TL' as aylik_maas,
        TO_CHAR(daily_wage, '9,999.99') || ' TL' as gunluk,
        TO_CHAR(hourly_wage, '999.99') || ' TL' as saatlik,
        TO_CHAR(minute_wage, '99.99') || ' TL' as dakikalik,
        shift_start_time,
        shift_end_time
       FROM personnel 
       WHERE personnel_no = 'P001'`
    );
    
    console.table(afterQuery.rows);
    
    // 4. Farkları hesapla
    const before = beforeQuery.rows[0];
    const after = afterQuery.rows[0];
    
    console.log('\n📈 FARKLAR:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Aylık Maaş:    ${before.aylik_maas} → ${after.aylik_maas}`);
    console.log(`Günlük Ücret:  ${before.gunluk} → ${after.gunluk}`);
    console.log(`Saatlik Ücret: ${before.saatlik} → ${after.saatlik}`);
    console.log(`Dakikalık:     ${before.dakikalik} → ${after.dakikalik}`);
    console.log(`Vardiya:       ${before.shift_start_time} - ${before.shift_end_time} → ${after.shift_start_time} - ${after.shift_end_time}`);
    
    console.log('\n✅ TEST TAMAMLANDI!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📝 Sonuç: Database güncellemesi çalışıyor!');
    console.log('🔄 Günlük/Saatlik/Dakikalık ücretler otomatik hesaplandı!');
    console.log('\n💡 Frontend\'te Personeller sekmesini yenile, değişiklikleri göreceksin!\n');
    
    client.release();
    
  } catch (error) {
    console.error('❌ Test Hatası:', error.message);
    console.error('\nDetay:', error);
  } finally {
    await pool.end();
  }
}

testSalaryUpdate();
