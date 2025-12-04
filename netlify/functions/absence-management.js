const { Client } = require('pg')

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Content-Type': 'application/json'
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()

    // GET - Devamsızlık kayıtlarını getir
    if (event.httpMethod === 'GET') {
      const { personnelId, startDate, endDate } = event.queryStringParameters || {}

      let query = `
        SELECT 
          ar.*,
          p.name || ' ' || p.surname as personnel_name,
          p.daily_wage,
          u.email as created_by_email
        FROM absence_records ar
        JOIN personnel p ON ar.personnel_id = p.id
        LEFT JOIN users u ON ar.created_by = u.id
        WHERE 1=1
      `

      const params = []
      let paramCount = 1

      if (personnelId) {
        query += ` AND ar.personnel_id = $${paramCount}`
        params.push(personnelId)
        paramCount++
      }

      if (startDate) {
        query += ` AND ar.absence_date >= $${paramCount}`
        params.push(startDate)
        paramCount++
      }

      if (endDate) {
        query += ` AND ar.absence_date <= $${paramCount}`
        params.push(endDate)
        paramCount++
      }

      query += ' ORDER BY ar.absence_date DESC'

      const result = await client.query(query, params)

      // İstatistikler
      const stats = {
        total_absences: result.rows.length,
        excused_count: result.rows.filter(r => r.is_excused).length,
        unexcused_count: result.rows.filter(r => !r.is_excused).length,
        total_penalty: result.rows.reduce((sum, r) => sum + parseFloat(r.penalty_amount || 0), 0)
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          absences: result.rows,
          stats
        })
      }
    }

    // POST - Yeni devamsızlık ekle
    if (event.httpMethod === 'POST') {
      const { 
        personnelId, 
        absenceDate, 
        absenceType, 
        isExcused,
        penaltyAmount,
        reason,
        createdBy 
      } = JSON.parse(event.body)

      // Validasyon
      if (!personnelId || !absenceDate || !absenceType || !createdBy) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'personnelId, absenceDate, absenceType ve createdBy gerekli'
          })
        }
      }

      // Personel bilgilerini getir (günlük ücret için)
      const personnelResult = await client.query(
        'SELECT daily_wage FROM personnel WHERE id = $1',
        [personnelId]
      )

      if (personnelResult.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Personel bulunamadı'
          })
        }
      }

      const dailyWage = personnelResult.rows[0].daily_wage

      // Ceza tutarını hesapla (eğer belirtilmemişse ve mazeretli değilse)
      let finalPenalty = penaltyAmount !== undefined ? penaltyAmount : 0
      if (!isExcused && finalPenalty === 0 && absenceType === 'no_show') {
        finalPenalty = dailyWage // Mazeretsiz gelmeme = 1 günlük ücret kesintisi
      }

      // Devamsızlık kaydı oluştur
      const insertResult = await client.query(
        `INSERT INTO absence_records 
         (personnel_id, absence_date, absence_type, is_excused, penalty_amount, reason, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [personnelId, absenceDate, absenceType, isExcused || false, finalPenalty, reason, createdBy]
      )

      // Audit log
      await client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          createdBy,
          'absence_create',
          'absence_records',
          insertResult.rows[0].id,
          JSON.stringify({ 
            date: absenceDate, 
            type: absenceType, 
            penalty: finalPenalty 
          })
        ]
      )

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Devamsızlık kaydı oluşturuldu',
          absence: insertResult.rows[0]
        })
      }
    }

    // DELETE - Devamsızlık kaydını sil
    if (event.httpMethod === 'DELETE') {
      const { absenceId, deletedBy } = JSON.parse(event.body)

      if (!absenceId || !deletedBy) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'absenceId ve deletedBy gerekli'
          })
        }
      }

      // Devamsızlık kaydını getir
      const absenceResult = await client.query(
        'SELECT * FROM absence_records WHERE id = $1',
        [absenceId]
      )

      if (absenceResult.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Devamsızlık kaydı bulunamadı'
          })
        }
      }

      const absence = absenceResult.rows[0]

      // Kaydı sil
      await client.query('DELETE FROM absence_records WHERE id = $1', [absenceId])

      // Audit log
      await client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          deletedBy,
          'absence_delete',
          'absence_records',
          absenceId,
          JSON.stringify({ 
            date: absence.absence_date, 
            penalty: absence.penalty_amount 
          })
        ]
      )

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Devamsızlık kaydı silindi'
        })
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Absence management error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'İşlem başarısız'
      })
    }
  } finally {
    await client.end()
  }
}
