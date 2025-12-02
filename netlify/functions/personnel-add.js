// Yeni Personel Ekleme
import pg from 'pg';
import bcrypt from 'bcryptjs';
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const {
      personnel_no,
      name,
      surname,
      email,
      phone,
      position,
      department,
      location_id,
      hire_date,
      salary,
      password
    } = JSON.parse(event.body);

    const client = await pool.connect();

    try {
      // Personel no kontrolü
      const existing = await client.query(
        'SELECT id FROM personnel WHERE personnel_no = $1',
        [personnel_no]
      );

      if (existing.rows.length > 0) {
        client.release();
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Bu personel numarası zaten kullanılıyor'
          })
        };
      }

      // Şifreyi hashle
      const hashedPassword = await bcrypt.hash(password || '123456', 10);

      // Personel ekle
      const result = await client.query(
        `INSERT INTO personnel (
          personnel_no, name, surname, email, phone, 
          position, department, location_id, hire_date, 
          salary, password_hash, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
        RETURNING *`,
        [
          personnel_no,
          name,
          surname,
          email,
          phone,
          position,
          department,
          location_id,
          hire_date || new Date().toISOString().split('T')[0],
          salary,
          hashedPassword
        ]
      );

      // Log
      await client.query(
        'INSERT INTO audit_logs (action, table_name, record_id) VALUES ($1, $2, $3)',
        ['personnel_add', 'personnel', result.rows[0].id]
      );

      client.release();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          personnel: result.rows[0],
          message: 'Personel başarıyla eklendi'
        })
      };

    } catch (error) {
      client.release();
      throw error;
    }

  } catch (error) {
    console.error('Personnel add error:', error);
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
