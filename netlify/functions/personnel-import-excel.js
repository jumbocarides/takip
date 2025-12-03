const { Client } = require('pg')

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    const { personnelData } = JSON.parse(event.body)

    if (!personnelData || !Array.isArray(personnelData) || personnelData.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Personnel data array gerekli' 
        })
      }
    }

    await client.connect()

    const results = {
      success: 0,
      failed: 0,
      updated: 0,
      created: 0,
      errors: []
    }

    for (const person of personnelData) {
      try {
        const {
          personnel_no,
          name,
          surname,
          email,
          phone,
          position,
          department,
          location_code,
          monthly_salary,
          monthly_leave_days,
          password
        } = person

        // Zorunlu alanları kontrol et
        if (!personnel_no || !name || !surname) {
          results.failed++
          results.errors.push({
            personnel_no: personnel_no || 'UNKNOWN',
            error: 'Personel no, ad ve soyad zorunlu'
          })
          continue
        }

        // Location ID bul
        let locationId = null
        if (location_code) {
          const locationQuery = await client.query(
            'SELECT id FROM locations WHERE location_code = $1',
            [location_code]
          )
          if (locationQuery.rows.length > 0) {
            locationId = locationQuery.rows[0].id
          }
        }

        // Personel var mı kontrol et
        const existingQuery = await client.query(
          'SELECT id FROM personnel WHERE personnel_no = $1',
          [personnel_no]
        )

        if (existingQuery.rows.length > 0) {
          // GÜNCELLE
          const personnelId = existingQuery.rows[0].id
          
          await client.query(
            `UPDATE personnel 
             SET 
               name = $1,
               surname = $2,
               email = $3,
               phone = $4,
               position = $5,
               department = $6,
               location_id = $7,
               monthly_salary = $8,
               monthly_leave_days = $9,
               updated_at = NOW()
             WHERE id = $10`,
            [
              name,
              surname,
              email || null,
              phone || null,
              position || null,
              department || null,
              locationId,
              monthly_salary || null,
              monthly_leave_days || 4,
              personnelId
            ]
          )

          results.updated++
          results.success++
        } else {
          // YENİ EKLE
          const bcrypt = require('bcryptjs')
          const hashedPassword = await bcrypt.hash(password || '123456', 10)

          await client.query(
            `INSERT INTO personnel (
              personnel_no, name, surname, email, phone,
              position, department, location_id, 
              monthly_salary, monthly_leave_days, remaining_leave_days,
              password_hash, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, true)`,
            [
              personnel_no,
              name,
              surname,
              email || null,
              phone || null,
              position || null,
              department || null,
              locationId,
              monthly_salary || null,
              monthly_leave_days || 4,
              hashedPassword
            ]
          )

          results.created++
          results.success++
        }

      } catch (error) {
        results.failed++
        results.errors.push({
          personnel_no: person.personnel_no || 'UNKNOWN',
          error: error.message
        })
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `${results.success} başarılı, ${results.failed} başarısız`,
        results: results
      })
    }

  } catch (error) {
    console.error('Excel import error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: error.message || 'Excel import hatası' 
      })
    }
  } finally {
    await client.end()
  }
}
