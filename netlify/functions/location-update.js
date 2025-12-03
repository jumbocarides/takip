// Lokasyon Güncelleme
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
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'PUT') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { locationId, name, address, phone, city, district } = JSON.parse(event.body);

    if (!locationId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Location ID required' })
      };
    }

    const client = await pool.connect();

    try {
      const result = await client.query(
        `UPDATE locations 
         SET 
           name = COALESCE($1, name),
           address = COALESCE($2, address),
           phone = COALESCE($3, phone),
           city = COALESCE($4, city),
           district = COALESCE($5, district),
           updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [name, address, phone, city, district, locationId]
      );

      if (result.rows.length === 0) {
        client.release();
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'Location not found' })
        };
      }

      // Log
      await client.query(
        'INSERT INTO audit_logs (action, table_name, record_id) VALUES ($1, $2, $3)',
        ['location_update', 'locations', locationId]
      );

      client.release();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          location: result.rows[0],
          message: 'Lokasyon güncellendi'
        })
      };

    } catch (error) {
      client.release();
      throw error;
    }

  } catch (error) {
    console.error('Location update error:', error);
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
