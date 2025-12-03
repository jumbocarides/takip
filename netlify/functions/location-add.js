// Yeni Lokasyon Ekleme
const { Client } = require('pg');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
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

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const { name, location_code, address, phone, city, district } = JSON.parse(event.body);

    if (!name || !location_code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Name and location code required' })
      };
    }

    await client.connect();

    try {
      // Lokasyon kodu benzersiz olmalı
      const checkQuery = await client.query(
        'SELECT id FROM locations WHERE location_code = $1',
        [location_code]
      );

      if (checkQuery.rows.length > 0) {
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

      // Log (audit_logs tablosu varsa)
      try {
        await client.query(
          'INSERT INTO audit_logs (action, table_name, record_id, details) VALUES ($1, $2, $3, $4)',
          ['location_add', 'locations', result.rows[0].id, `${name} (${location_code}) eklendi`]
        );
      } catch (logError) {
        console.log('Audit log could not be created:', logError.message);
      }

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
  } finally {
    await client.end();
  }
};
