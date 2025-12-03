// UUID Trigger Fix Script
// Bu script database'deki trigger fonksiyonunu UUID parametresi ile günceller

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  host: '5.175.136.149',
  port: 5432,
  database: 'restaurant_tracking',
  user: 'restaurant_app',
  password: 'RestaurantDB2024Secure',
  ssl: false
});

async function fixTrigger() {
  console.log('🔧 Trigger fonksiyonu düzeltiliyor...\n');
  
  const client = await pool.connect();
  
  try {
    // SQL dosyasını oku
    const sqlPath = path.join(__dirname, 'database', 'fix-trigger-uuid.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 SQL dosyası okundu: fix-trigger-uuid.sql');
    console.log('🚀 Çalıştırılıyor...\n');
    
    // SQL'i çalıştır
    await client.query(sql);
    
    console.log('✅ Trigger fonksiyonu başarıyla güncellendi!');
    console.log('✅ calculate_earnings_and_penalties(UUID) fonksiyonu aktif');
    console.log('✅ trigger_auto_calculate_earnings trigger\'ı yeniden oluşturuldu\n');
    
    // Test et
    console.log('🧪 Test ediliyor...');
    const testResult = await client.query(`
      SELECT proname, proargtypes::regtype[] as arg_types
      FROM pg_proc
      WHERE proname = 'calculate_earnings_and_penalties'
    `);
    
    if (testResult.rows.length > 0) {
      console.log('✅ Fonksiyon bulundu:');
      testResult.rows.forEach(row => {
        console.log(`   - ${row.proname}(${row.arg_types})`);
      });
    }
    
    console.log('\n✅ BAŞARILI! Artık çıkış yapılabilir.');
    
  } catch (error) {
    console.error('❌ HATA:', error.message);
    console.error('\nDetay:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Çalıştır
fixTrigger()
  .then(() => {
    console.log('\n🎉 İşlem tamamlandı!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 İşlem başarısız!');
    process.exit(1);
  });
