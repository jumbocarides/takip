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

    // GET - İzin kayıtlarını getir
    if (event.httpMethod === 'GET') {
      const { personnelId } = event.queryStringParameters || {}

      let query = `
        SELECT 
          lr.*,
          p.name || ' ' || p.surname as personnel_name,
          u.email as approved_by_email
        FROM leave_records lr
        JOIN personnel p ON lr.personnel_id = p.id
        LEFT JOIN users u ON lr.approved_by = u.id
        WHERE 1=1
      `

      const params = []
      if (personnelId) {
        query += ' AND lr.personnel_id = $1'
        params.push(personnelId)
      }

      query += ' ORDER BY lr.start_date DESC'

      const result = await client.query(query, params)

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          leaves: result.rows
        })
      }
    }

    // POST - Yeni izin ekle veya düzelt
    if (event.httpMethod === 'POST') {
      const { 
        personnelId, 
        leaveType, 
        startDate, 
        endDate, 
        reason,
        approvedBy 
      } = JSON.parse(event.body)

      // Validasyon
      if (!personnelId || !leaveType || !startDate || !endDate || !approvedBy) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Tüm alanlar zorunludur'
          })
        }
      }

      // Gün sayısını hesapla
      const start = new Date(startDate)
      const end = new Date(endDate)
      const diffTime = Math.abs(end - start)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

      // İzin kaydı oluştur
      const insertResult = await client.query(
        `INSERT INTO leave_records 
         (personnel_id, leave_type, start_date, end_date, total_days, reason, status, approved_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'approved', $7)
         RETURNING *`,
        [personnelId, leaveType, startDate, endDate, diffDays, reason, approvedBy]
      )

      // Personnel tablosunu güncelle
      if (leaveType === 'annual') {
        await client.query(
          `UPDATE personnel 
           SET remaining_leave_days = GREATEST(remaining_leave_days - $1, 0)
           WHERE id = $2`,
          [diffDays, personnelId]
        )
      }

      // Audit log
      await client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          approvedBy,
          'leave_create',
          'leave_records',
          insertResult.rows[0].id,
          JSON.stringify({ days: diffDays, type: leaveType })
        ]
      )

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'İzin kaydı oluşturuldu',
          leave: insertResult.rows[0]
        })
      }
    }

    // DELETE - İzin kaydını sil (düzeltme için)
    if (event.httpMethod === 'DELETE') {
      const { leaveId, deletedBy } = JSON.parse(event.body)

      if (!leaveId || !deletedBy) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'leaveId ve deletedBy gerekli'
          })
        }
      }

      // İzin kaydını getir
      const leaveResult = await client.query(
        'SELECT * FROM leave_records WHERE id = $1',
        [leaveId]
      )

      if (leaveResult.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'İzin kaydı bulunamadı'
          })
        }
      }

      const leave = leaveResult.rows[0]

      // İzin kaydını sil
      await client.query('DELETE FROM leave_records WHERE id = $1', [leaveId])

      // Yıllık izin ise, gün sayısını geri ver
      if (leave.leave_type === 'annual') {
        await client.query(
          `UPDATE personnel 
           SET remaining_leave_days = remaining_leave_days + $1
           WHERE id = $2`,
          [leave.total_days, leave.personnel_id]
        )
      }

      // Audit log
      await client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          deletedBy,
          'leave_delete',
          'leave_records',
          leaveId,
          JSON.stringify({ days: leave.total_days, type: leave.leave_type })
        ]
      )

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'İzin kaydı silindi ve günler geri eklendi'
        })
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Leave management error:', error)
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
