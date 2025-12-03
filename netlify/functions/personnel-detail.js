// Personel Detay Görüntüleme
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
    const { personnelId } = event.queryStringParameters || {};

    if (!personnelId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Personnel ID required' })
      };
    }

    const client = await pool.connect();

    // Personel bilgileri
    const personnelQuery = await client.query(
      `SELECT 
        p.*,
        l.name as location_name,
        l.location_code
       FROM personnel p
       LEFT JOIN locations l ON p.location_id = l.id
       WHERE p.id = $1`,
      [personnelId]
    );

    if (personnelQuery.rows.length === 0) {
      client.release();
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Personnel not found' })
      };
    }

    const personnel = personnelQuery.rows[0];

    // BU AYKİ HAK EDİŞ HESAPLAMA (En güncel)
    const currentMonthQuery = await client.query(
      `SELECT 
        COUNT(*) as worked_days,
        SUM(COALESCE(work_hours, 0)) as total_hours,
        SUM(COALESCE(overtime_minutes, 0)) as total_overtime_mins,
        SUM(COALESCE(late_arrival_minutes, 0)) as total_late_mins,
        SUM(COALESCE(early_leave_minutes, 0)) as total_early_leave_mins,
        SUM(COALESCE(overtime_amount, 0)) as total_overtime_amount,
        SUM(COALESCE(late_penalty, 0)) as total_late_penalty,
        SUM(COALESCE(early_leave_penalty, 0)) as total_early_leave_penalty,
        SUM(COALESCE(daily_earnings, 0)) as total_earnings,
        SUM(COALESCE(net_earnings, 0)) as total_net_earnings,
        MIN(DATE(check_in_time)) as first_work_day,
        MAX(DATE(check_in_time)) as last_work_day
       FROM attendance
       WHERE personnel_id = $1
       AND DATE_TRUNC('month', check_in_time) = DATE_TRUNC('month', CURRENT_DATE)
       AND check_out_time IS NOT NULL`,
      [personnelId]
    );

    const currentMonth = currentMonthQuery.rows[0];

    // Son 30 gün attendance özeti
    const attendanceQuery = await client.query(
      `SELECT 
        COUNT(*) as total_days,
        SUM(work_hours) as total_hours,
        SUM(overtime_minutes) as total_overtime_mins,
        SUM(late_arrival_minutes) as total_late_mins,
        SUM(daily_earnings) as total_earnings,
        SUM(net_earnings) as total_net_earnings
       FROM attendance
       WHERE personnel_id = $1
       AND check_in_time >= NOW() - INTERVAL '30 days'
       AND check_out_time IS NOT NULL`,
      [personnelId]
    );

    const summary = attendanceQuery.rows[0];

    // Son 10 giriş/çıkış
    const recentQuery = await client.query(
      `SELECT 
        DATE(check_in_time) as date,
        check_in_time::TIME as check_in,
        check_out_time::TIME as check_out,
        work_hours,
        overtime_minutes,
        late_arrival_minutes,
        net_earnings,
        status
       FROM attendance
       WHERE personnel_id = $1
       ORDER BY check_in_time DESC
       LIMIT 10`,
      [personnelId]
    );

    client.release();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        personnel: personnel,
        currentMonth: currentMonth, // Bu ayki detaylı hak ediş
        summary: summary, // Son 30 gün özeti
        recentAttendance: recentQuery.rows
      })
    };

  } catch (error) {
    console.error('Personnel detail error:', error);
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
