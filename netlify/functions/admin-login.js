const { Client } = require('pg')
const bcrypt = require('bcryptjs')

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
    const { email, password } = JSON.parse(event.body)

    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Email ve şifre gerekli' 
        })
      }
    }

    await client.connect()

    // Kullanıcıyı bul
    const result = await client.query(
      `SELECT id, email, password_hash, name, role, is_active, full_name 
       FROM users 
       WHERE email = $1 AND role = 'admin'`,
      [email]
    )

    if (result.rows.length === 0) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Geçersiz email veya şifre'
        })
      }
    }

    const user = result.rows[0]

    // Aktif mi kontrol et
    if (!user.is_active) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Hesabınız aktif değil'
        })
      }
    }

    // Şifre kontrolü
    const isPasswordValid = await bcrypt.compare(password, user.password_hash)

    if (!isPasswordValid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Geçersiz email veya şifre'
        })
      }
    }

    // Başarılı giriş - log ekle
    try {
      await client.query(
        `INSERT INTO audit_logs (action, table_name, record_id, details, created_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        ['admin_login', 'users', user.id, `Admin girişi: ${user.email}`, user.id]
      )
    } catch (logError) {
      console.log('Audit log oluşturulamadı:', logError.message)
    }

    // Token oluştur (basit bir token, production'da JWT kullanılmalı)
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64')

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.full_name || user.name,
          role: user.role
        },
        token: token,
        message: 'Giriş başarılı'
      })
    }

  } catch (error) {
    console.error('Admin login error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: error.message || 'Giriş yapılamadı'
      })
    }
  } finally {
    await client.end()
  }
}
