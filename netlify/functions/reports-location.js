// Lokasyon Bazlı Rapor
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
    const { startDate, endDate } = event.queryStringParameters || {};

    const client = await pool.connect();

    // Lokasyon bazlı özet
    let query = `
      SELECT 
        l.id,
        l.name as location_name,
        l.location_code,
        COUNT(DISTINCT p.id) as total_personnel,
        COUNT(DISTINCT a.id) as total_attendance,
        SUM(a.work_hours) as total_work_hours,
        AVG(a.work_hours) as avg_work_hours,
        SUM(a.overtime_minutes) / 60.0 as total_overtime_hours,
        SUM(a.late_arrival_minutes) as total_late_minutes,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_arrivals,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as on_time_arrivals,
        SUM(a.daily_earnings) as total_gross_pay,
        SUM(a.overtime_amount) as total_overtime_pay,
        SUM(a.late_penalty) as total_penalties,
        SUM(a.net_earnings) as total_net_pay,
        SUM(p.monthly_salary) as monthly_payroll_budget
      FROM locations l
      LEFT JOIN personnel p ON l.id = p.location_id AND p.is_active = true
      LEFT JOIN attendance a ON p.id = a.personnel_id
    `;

    const params = [];
    let paramCount = 1;
    let whereClause = ' WHERE 1=1';

    if (startDate) {
      whereClause += ` AND DATE(a.check_in_time) >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      whereClause += ` AND DATE(a.check_in_time) <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    query += whereClause;
    query += `
      GROUP BY l.id, l.name, l.location_code
      ORDER BY total_net_pay DESC NULLS LAST
    `;

    const result = await client.query(query, params);

    // Her lokasyon için top 5 personel
    const topPerformersQuery = `
      SELECT 
        l.name as location_name,
        p.personnel_no,
        p.name || ' ' || p.surname as personnel_name,
        COUNT(a.id) as days_worked,
        SUM(a.net_earnings) as total_earnings
      FROM locations l
      JOIN personnel p ON l.id = p.location_id
      JOIN attendance a ON p.id = a.personnel_id
      WHERE p.is_active = true
      ${startDate ? `AND DATE(a.check_in_time) >= '${startDate}'` : ''}
      ${endDate ? `AND DATE(a.check_in_time) <= '${endDate}'` : ''}
      GROUP BY l.id, l.name, p.id, p.personnel_no, p.name, p.surname
      ORDER BY l.id, total_earnings DESC
    `;

    const topPerformers = await client.query(topPerformersQuery);

    client.release();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: result.rows,
        topPerformers: topPerformers.rows,
        total: result.rows.length
      })
    };

  } catch (error) {
    console.error('Location report error:', error);
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
