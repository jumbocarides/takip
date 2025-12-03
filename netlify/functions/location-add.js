// Yeni Lokasyon Ekleme
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
    const { name, location_code, address, phone, city, district } = JSON.parse(event.body);

    if (!name || !location_code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Name and location code required' })
      };
    }

    const client = await pool.connect();

    try {
      // Lokasyon kodu benzersiz olmalı
      const checkQuery = await client.query(
        'SELECT id FROM locations WHERE location_code = $1',
        [location_code]
      );

      if (checkQuery.rows.length > 0) {
        client.release();
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Location code already exists' })
        };
      }

      // Yeni lokasyon ekle
      const result = await client.query(
        `INSERT INTO locations (
          name, 
          location_code, 
          address, 
          phone, 
          city, 
          district,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING *`,
        [name, location_code, address || null, phone || null, city || null, district || null]
      );

      // Log
      await client.query(
        'INSERT INTO audit_logs (action, table_name, record_id, details) VALUES ($1, $2, $3, $4)',
        ['location_add', 'locations', result.rows[0].id, `${name} (${location_code}) eklendi`]
      );

      client.release();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          location: result.rows[0],
          message: 'Lokasyon başarıyla eklendi'
        })
      };

    } catch (error) {
      client.release();
      throw error;
    }

  } catch (error) {
    console.error('Location add error:', error);
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
