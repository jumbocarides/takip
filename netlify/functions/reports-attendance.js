// Devamsızlık Raporları
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
    const { startDate, endDate, locationId, personnelId } = event.queryStringParameters || {};

    const client = await pool.connect();

    // Detaylı devamsızlık raporu
    let query = `
      SELECT 
        p.personnel_no,
        p.name || ' ' || p.surname as personnel_name,
        p.position,
        l.name as location_name,
        DATE(a.check_in_time) as work_date,
        a.check_in_time::TIME as check_in,
        a.check_out_time::TIME as check_out,
        a.work_hours,
        a.late_arrival_minutes,
        a.early_leave_minutes,
        a.overtime_minutes,
        a.status,
        a.daily_earnings,
        a.overtime_amount,
        a.late_penalty,
        a.early_leave_penalty,
        a.net_earnings
      FROM attendance a
      JOIN personnel p ON a.personnel_id = p.id
      JOIN locations l ON a.location_id = l.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (startDate) {
      query += ` AND DATE(a.check_in_time) >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND DATE(a.check_in_time) <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    if (locationId) {
      query += ` AND a.location_id = $${paramCount}`;
      params.push(locationId);
      paramCount++;
    }

    if (personnelId) {
      query += ` AND a.personnel_id = $${paramCount}`;
      params.push(personnelId);
      paramCount++;
    }

    query += ` ORDER BY a.check_in_time DESC`;

    const result = await client.query(query, params);

    // Özet istatistikler
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT a.personnel_id) as total_personnel,
        COUNT(*) as total_records,
        SUM(a.work_hours) as total_hours,
        AVG(a.work_hours) as avg_hours,
        SUM(a.overtime_minutes) as total_overtime_mins,
        SUM(a.late_arrival_minutes) as total_late_mins,
        SUM(a.early_leave_minutes) as total_early_leave_mins,
        SUM(a.daily_earnings) as total_earnings,
        SUM(a.net_earnings) as total_net_earnings,
        SUM(a.late_penalty) as total_penalties,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count
      FROM attendance a
      WHERE 1=1
      ${startDate ? `AND DATE(a.check_in_time) >= '${startDate}'` : ''}
      ${endDate ? `AND DATE(a.check_in_time) <= '${endDate}'` : ''}
      ${locationId ? `AND a.location_id = ${locationId}` : ''}
      ${personnelId ? `AND a.personnel_id = ${personnelId}` : ''}
    `;

    const summaryResult = await client.query(summaryQuery);

    client.release();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: result.rows,
        summary: summaryResult.rows[0],
        total: result.rows.length
      })
    };

  } catch (error) {
    console.error('Attendance report error:', error);
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
