// Dashboard İstatistikleri - Gerçek Veritabanından
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

    // 1. Toplam Personel Sayısı
    const totalPersonnel = await client.query(
      'SELECT COUNT(*) as count FROM personnel WHERE is_active = true'
    );

    // 2. Aktif Lokasyon Sayısı
    const totalLocations = await client.query(
      'SELECT COUNT(*) as count FROM locations WHERE is_active = true'
    );

    // 3. Bugün Giriş Yapan Personel
    const todayCheckIns = await client.query(
      `SELECT COUNT(DISTINCT personnel_id) as count 
       FROM attendance 
       WHERE DATE(check_in_time) = CURRENT_DATE`
    );

    // 4. Ortalama Çalışma Saati (Bu ay)
    const avgWorkHours = await client.query(
      `SELECT COALESCE(AVG(work_hours), 0) as avg_hours 
       FROM attendance 
       WHERE DATE_PART('month', check_in_time) = DATE_PART('month', CURRENT_DATE)
       AND DATE_PART('year', check_in_time) = DATE_PART('year', CURRENT_DATE)
       AND work_hours IS NOT NULL AND work_hours > 0`
    );

    // 5. Bugünkü Giriş/Çıkışlar (Son 10)
    const todayAttendance = await client.query(
      `SELECT 
        a.id,
        a.check_in_time,
        a.check_out_time,
        a.work_hours,
        a.status,
        p.name || ' ' || p.surname as personnel_name,
        p.position,
        l.name as location_name,
        l.location_code
       FROM attendance a
       JOIN personnel p ON a.personnel_id = p.id
       JOIN locations l ON a.location_id = l.id
       WHERE DATE(a.check_in_time) = CURRENT_DATE
       ORDER BY a.check_in_time DESC
       LIMIT 10`
    );

    // 6. Tüm Personeller
    const allPersonnel = await client.query(
      `SELECT 
        p.id,
        p.personnel_no,
        p.name,
        p.surname,
        p.position,
        p.department,
        p.is_active,
        l.name as location_name,
        l.location_code
       FROM personnel p
       LEFT JOIN locations l ON p.location_id = l.id
       WHERE p.is_active = true
       ORDER BY p.name`
    );

    // 7. Tüm Lokasyonlar
    const allLocations = await client.query(
      `SELECT 
        l.id,
        l.location_code,
        l.name,
        l.address,
        l.phone,
        COUNT(DISTINCT p.id) as personnel_count,
        COUNT(DISTINCT CASE 
          WHEN DATE(a.check_in_time) = CURRENT_DATE AND a.check_out_time IS NULL 
          THEN p.id 
        END) as active_today
       FROM locations l
       LEFT JOIN personnel p ON l.id = p.location_id AND p.is_active = true
       LEFT JOIN attendance a ON p.id = a.personnel_id
       WHERE l.is_active = true
       GROUP BY l.id, l.location_code, l.name, l.address, l.phone
       ORDER BY l.name`
    );

    // 8. Haftalık istatistikler
    const weeklyStats = await client.query(
      `SELECT 
        DATE(check_in_time) as date,
        COUNT(DISTINCT personnel_id) as personnel_count,
        COUNT(*) as total_entries,
        AVG(work_hours) as avg_hours
       FROM attendance
       WHERE check_in_time >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY DATE(check_in_time)
       ORDER BY DATE(check_in_time) DESC`
    );

    client.release();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        stats: {
          totalPersonnel: parseInt(totalPersonnel.rows[0].count),
          totalLocations: parseInt(totalLocations.rows[0].count),
          todayCheckIns: parseInt(todayCheckIns.rows[0].count),
          avgWorkHours: parseFloat(avgWorkHours.rows[0].avg_hours).toFixed(1)
        },
        todayAttendance: todayAttendance.rows,
        personnel: allPersonnel.rows,
        locations: allLocations.rows,
        weeklyStats: weeklyStats.rows
      })
    };

  } catch (error) {
    console.error('Dashboard stats error:', error);
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
