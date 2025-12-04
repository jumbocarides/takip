const { Client } = require('pg')

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    }
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    const { 
      periodYear, 
      periodMonth, 
      locationId, 
      status 
    } = event.queryStringParameters || {}

    await client.connect()

    let query = `
      SELECT 
        p.id,
        p.personnel_id,
        per.name || ' ' || per.surname as personnel_name,
        per.personnel_no,
        l.name as location_name,
        p.year,
        p.month,
        p.period_start,
        p.period_end,
        p.total_work_days,
        p.actual_work_days,
        p.absent_days,
        p.leave_days,
        p.total_work_hours,
        p.overtime_hours,
        p.base_salary,
        p.overtime_pay,
        p.bonus_amount,
        p.gross_salary,
        p.total_deductions,
        p.net_salary,
        p.employer_total_cost,
        p.status,
        p.payment_status,
        p.payment_date,
        p.created_at,
        p.updated_at
      FROM payroll p
      JOIN personnel per ON p.personnel_id = per.id
      LEFT JOIN locations l ON p.location_id = l.id
      WHERE 1=1
    `

    const params = []
    let paramCount = 1

    if (periodYear) {
      query += ` AND p.year = $${paramCount}`
      params.push(parseInt(periodYear))
      paramCount++
    }

    if (periodMonth) {
      query += ` AND p.month = $${paramCount}`
      params.push(parseInt(periodMonth))
      paramCount++
    }

    if (locationId) {
      query += ` AND p.location_id = $${paramCount}`
      params.push(locationId)
      paramCount++
    }

    if (status) {
      query += ` AND p.status = $${paramCount}`
      params.push(status)
      paramCount++
    }

    query += ' ORDER BY p.year DESC, p.month DESC, per.name'

    const result = await client.query(query, params)

    // İstatistikleri hesapla
    const stats = {
      total_payrolls: result.rows.length,
      total_gross: 0,
      total_net: 0,
      total_deductions: 0,
      total_employer_cost: 0,
      status_counts: {
        draft: 0,
        calculated: 0,
        approved: 0,
        paid: 0,
        cancelled: 0
      },
      payment_counts: {
        pending: 0,
        paid: 0,
        failed: 0
      }
    }

    result.rows.forEach(row => {
      stats.total_gross += parseFloat(row.gross_salary || 0)
      stats.total_net += parseFloat(row.net_salary || 0)
      stats.total_deductions += parseFloat(row.total_deductions || 0)
      stats.total_employer_cost += parseFloat(row.employer_total_cost || 0)
      
      if (row.status) stats.status_counts[row.status]++
      if (row.payment_status) stats.payment_counts[row.payment_status]++
    })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        payrolls: result.rows,
        stats: {
          ...stats,
          total_gross: parseFloat(stats.total_gross.toFixed(2)),
          total_net: parseFloat(stats.total_net.toFixed(2)),
          total_deductions: parseFloat(stats.total_deductions.toFixed(2)),
          total_employer_cost: parseFloat(stats.total_employer_cost.toFixed(2))
        }
      })
    }

  } catch (error) {
    console.error('Payroll list error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Bordro listesi getirilemedi'
      })
    }
  } finally {
    await client.end()
  }
}
