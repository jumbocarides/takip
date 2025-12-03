// Personel Bazlı Rapor
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
    const { startDate, endDate, locationId } = event.queryStringParameters || {};

    const client = await pool.connect();

    // Personel bazlı özet rapor
    let query = `
      SELECT 
        p.personnel_no,
        p.name || ' ' || p.surname as personnel_name,
        p.position,
        p.department,
        l.name as location_name,
        p.monthly_salary,
        p.daily_wage,
        p.hourly_wage,
        COUNT(a.id) as total_days_worked,
        SUM(a.work_hours) as total_hours,
        AVG(a.work_hours) as avg_hours_per_day,
        SUM(a.overtime_minutes) as total_overtime_mins,
        SUM(a.late_arrival_minutes) as total_late_mins,
        SUM(a.early_leave_minutes) as total_early_leave_mins,
        SUM(a.daily_earnings) as total_gross_earnings,
        SUM(a.overtime_amount) as total_overtime_pay,
        SUM(a.late_penalty) as total_late_penalties,
        SUM(a.early_leave_penalty) as total_early_penalties,
        SUM(a.net_earnings) as total_net_earnings,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_days,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as on_time_days,
        MAX(a.check_in_time) as last_attendance
      FROM personnel p
      LEFT JOIN locations l ON p.location_id = l.id
      LEFT JOIN attendance a ON p.id = a.personnel_id
    `;

    const params = [];
    let paramCount = 1;
    let whereClause = ' WHERE p.is_active = true';

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

    if (locationId) {
      whereClause += ` AND p.location_id = $${paramCount}`;
      params.push(locationId);
      paramCount++;
    }

    query += whereClause;
    query += `
      GROUP BY p.id, p.personnel_no, p.name, p.surname, p.position, 
               p.department, l.name, p.monthly_salary, p.daily_wage, p.hourly_wage
      ORDER BY total_net_earnings DESC NULLS LAST
    `;

    const result = await client.query(query, params);

    // Genel özet
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT p.id) as total_active_personnel,
        SUM(p.monthly_salary) as total_monthly_payroll,
        COUNT(DISTINCT a.id) as total_attendance_records,
        SUM(a.net_earnings) as total_net_paid
      FROM personnel p
      LEFT JOIN attendance a ON p.id = a.personnel_id
      WHERE p.is_active = true
      ${startDate ? `AND DATE(a.check_in_time) >= '${startDate}'` : ''}
      ${endDate ? `AND DATE(a.check_in_time) <= '${endDate}'` : ''}
      ${locationId ? `AND p.location_id = ${locationId}` : ''}
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
    console.error('Personnel report error:', error);
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
