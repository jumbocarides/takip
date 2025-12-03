// Lokasyon Silme (Soft Delete)
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
    'Access-Control-Allow-Methods': 'DELETE, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'DELETE' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { locationId } = JSON.parse(event.body);

    if (!locationId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Location ID required' })
      };
    }

    const client = await pool.connect();

    try {
      // Lokasyona bağlı personel var mı kontrol et
      const personnelCheck = await client.query(
        'SELECT COUNT(*) as count FROM personnel WHERE location_id = $1 AND is_active = true',
        [locationId]
      );

      if (parseInt(personnelCheck.rows[0].count) > 0) {
        client.release();
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Bu lokasyona bağlı aktif personel var. Önce personelleri başka lokasyona taşıyın.' 
          })
        };
      }

      // Soft delete - is_active = false
      const result = await client.query(
        `UPDATE locations 
         SET 
           is_active = false,
           updated_at = NOW()
         WHERE id = $1
         RETURNING id, name, location_code`,
        [locationId]
      );

      if (result.rows.length === 0) {
        client.release();
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'Location not found' })
        };
      }

      const location = result.rows[0];

      // Log
      await client.query(
        'INSERT INTO audit_logs (action, table_name, record_id, details) VALUES ($1, $2, $3, $4)',
        [
          'location_deactivate', 
          'locations', 
          locationId,
          `${location.name} (${location.location_code}) pasifleştirildi`
        ]
      );

      client.release();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Lokasyon pasifleştirildi',
          location: location
        })
      };

    } catch (error) {
      client.release();
      throw error;
    }

  } catch (error) {
    console.error('Location delete error:', error);
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
