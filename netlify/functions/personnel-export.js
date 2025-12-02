// Excel Export - Personel Listesi
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.VITE_DB_HOST || '5.175.136.149',
  port: process.env.VITE_DB_PORT || 5432,
  database: process.env.VITE_DB_NAME || 'restaurant_tracking',
  user: process.env.VITE_DB_USER || 'restaurant_app',
  password: process.env.VITE_DB_PASSWORD || 'RestaurantDB2024Secure',
  ssl: false
});

export async function handler(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const client = await pool.connect();

    const result = await client.query(
      `SELECT 
        p.personnel_no as "Personel No",
        p.name as "Ad",
        p.surname as "Soyad",
        p.email as "Email",
        p.phone as "Telefon",
        p.position as "Pozisyon",
        p.department as "Departman",
        l.name as "Lokasyon",
        p.hire_date as "İşe Giriş Tarihi",
        p.salary as "Maaş",
        CASE WHEN p.is_active THEN 'Aktif' ELSE 'Pasif' END as "Durum"
       FROM personnel p
       LEFT JOIN locations l ON p.location_id = l.id
       ORDER BY p.personnel_no`
    );

    client.release();

    // CSV formatına çevir
    const data = result.rows;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: data,
        total: data.length
      })
    };

  } catch (error) {
    console.error('Personnel export error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
}
