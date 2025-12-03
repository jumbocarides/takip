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
    const { token } = JSON.parse(event.body)

    if (!token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Token gerekli',
          code: 'TOKEN_MISSING'
        })
      }
    }

    await client.connect()

    // Token'ı kontrol et
    const result = await client.query(
      `SELECT * FROM qr_tokens 
       WHERE token = $1`,
      [token]
    )

    if (result.rows.length === 0) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Geçersiz QR kod',
          code: 'TOKEN_INVALID'
        })
      }
    }

    const tokenData = result.rows[0]

    // Token kullanılmış mı?
    if (tokenData.is_used) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Bu QR kod zaten kullanılmış',
          code: 'TOKEN_USED'
        })
      }
    }

    // Token süresi dolmuş mu?
    if (new Date(tokenData.expires_at) < new Date()) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'QR kod süresi dolmuş. Yeni QR kod tarayın.',
          code: 'TOKEN_EXPIRED'
        })
      }
    }

    // Token geçerli! location_id'yi döndür
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        location_id: tokenData.location_id,
        token: token
      })
    }

  } catch (error) {
    console.error('QR validate error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: error.message || 'Token doğrulanamadı',
        code: 'SERVER_ERROR'
      })
    }
  } finally {
    await client.end()
  }
}
