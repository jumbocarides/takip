// Real Database Attendance Check-in/Check-out
import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  host: process.env.VITE_DB_HOST || '5.175.136.149',
  port: process.env.VITE_DB_PORT || 5432,
  database: process.env.VITE_DB_NAME || 'restaurant_tracking',
  user: process.env.VITE_DB_USER || 'restaurant_app',
  password: process.env.VITE_DB_PASSWORD || 'RestaurantDB2024Secure',
  ssl: false
})

export async function handler(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

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

  try {
    const { qrCode, personnelId, locationId, action } = JSON.parse(event.body)
    
    const client = await pool.connect()
    
    try {
      // Start transaction
      await client.query('BEGIN')
      
      // 1. Simple validation - QR code is just for tracking now
      if (!personnelId || !locationId) {
        throw new Error('Eksik bilgi')
      }
      
      // Get location ID
      const locationQuery = await client.query(
        'SELECT id FROM locations WHERE location_code = $1',
        [locationId]
      )
      
      if (locationQuery.rows.length === 0) {
        throw new Error('Geçersiz lokasyon')
      }
      
      const locationDbId = locationQuery.rows[0].id
      
      // 2. Check if personnel has open attendance
      const openAttendanceQuery = await client.query(
        `SELECT * FROM attendance 
         WHERE personnel_id = $1 
         AND check_out_time IS NULL 
         AND DATE(check_in_time) = CURRENT_DATE
         ORDER BY check_in_time DESC 
         LIMIT 1`,
        [personnelId]
      )
      
      const hasOpenAttendance = openAttendanceQuery.rows.length > 0
      let attendanceRecord
      let workHours = 0
      let earlyLeaveWarning = null
      
      // Force action based on parameter
      if (action === 'check-out' && hasOpenAttendance) {
        // Check-out operation
        const attendance = openAttendanceQuery.rows[0]
        
        // Calculate work hours for response
        const checkOutTime = new Date()
        const checkInTime = new Date(attendance.check_in_time)
        workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60) // Convert to hours
        
        // Erken çıkma kontrolü (sadece uyarı, engelleme yok)
        if (workHours < 8) {
          const remainingHours = 8 - workHours
          earlyLeaveWarning = `⚠️ Standart mesai süresini (8 saat) doldurmadınız. Kalan: ${remainingHours.toFixed(1)} saat. Erken çıkış cezası uygulanacaktır.`
        }
        
        // Update attendance record - Trigger otomatik hesaplama yapacak
        const updateQuery = await client.query(
          `UPDATE attendance 
           SET 
             check_out_time = NOW(), 
             check_out_method = 'qr',
             updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [attendance.id]
        )
        
        attendanceRecord = updateQuery.rows[0]
        
        // Eğer erken çıkma varsa, notification ekle
        if (earlyLeaveWarning) {
          await client.query(
            `INSERT INTO notifications (
              recipient_id, 
              recipient_type, 
              title, 
              message, 
              type
            ) VALUES ($1, 'personnel', $2, $3, 'warning')`,
            [
              personnelId,
              'Erken Çıkış Uyarısı',
              earlyLeaveWarning
            ]
          )
        }
        
        // Log the action
        await client.query(
          'INSERT INTO audit_logs (personnel_id, action, table_name, record_id) VALUES ($1, $2, $3, $4)',
          [personnelId, 'check_out', 'attendance', attendance.id]
        )
        
      } else if (action === 'check-in' && !hasOpenAttendance) {
        // Check-in operation
        
        // Get work schedule if exists
        const scheduleQuery = await client.query(
          'SELECT * FROM work_schedules WHERE personnel_id = $1 AND date = CURRENT_DATE',
          [personnelId]
        )
        
        let status = 'present'
        if (scheduleQuery.rows.length > 0) {
          const schedule = scheduleQuery.rows[0]
          const now = new Date()
          const scheduledStart = new Date()
          const [hours, minutes] = schedule.shift_start.split(':')
          scheduledStart.setHours(hours, minutes, 0)
          
          // Check if late (more than 15 minutes)
          const diffMinutes = (now - scheduledStart) / (1000 * 60)
          if (diffMinutes > 15) {
            status = 'late'
          }
        }
        
        // Create new attendance record
        const insertQuery = await client.query(
          `INSERT INTO attendance (
            personnel_id, 
            location_id, 
            check_in_time, 
            check_in_method,
            status,
            ip_address,
            device_info
          ) VALUES ($1, $2, NOW(), 'qr', $3, $4, $5)
          RETURNING *`,
          [
            personnelId, 
            locationDbId,
            status,
            event.headers['x-forwarded-for'] || event.headers['client-ip'],
            event.headers['user-agent']
          ]
        )
        
        attendanceRecord = insertQuery.rows[0]
        
        // Log the action
        await client.query(
          'INSERT INTO audit_logs (personnel_id, action, table_name, record_id) VALUES ($1, $2, $3, $4)',
          [personnelId, 'check_in', 'attendance', attendanceRecord.id]
        )
      } else {
        // Invalid action or state
        throw new Error(
          action === 'check-in' && hasOpenAttendance 
            ? 'Zaten açık bir giriş kaydınız var' 
            : 'Açık giriş kaydınız bulunmuyor'
        )
      }
      
      // 4. Get personnel info for response
      const personnelQuery = await client.query(
        'SELECT name, surname, position FROM personnel WHERE id = $1',
        [personnelId]
      )
      
      const personnel = personnelQuery.rows[0]
      
      // 5. Create notification
      await client.query(
        `INSERT INTO notifications (
          recipient_id, 
          recipient_type, 
          title, 
          message, 
          type
        ) VALUES ($1, 'personnel', $2, $3, 'success')`,
        [
          personnelId,
          hasOpenAttendance ? 'Çıkış Yapıldı' : 'Giriş Yapıldı',
          hasOpenAttendance 
            ? `Çıkış saatiniz: ${new Date().toLocaleTimeString('tr-TR')}`
            : `Giriş saatiniz: ${new Date().toLocaleTimeString('tr-TR')}`
        ]
      )
      
      // Commit transaction
      await client.query('COMMIT')
      client.release()
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          action: action,
          attendance: attendanceRecord,
          personnel,
          workHours: workHours.toFixed(2),
          message: `${action === 'check-in' ? 'Giriş' : 'Çıkış'} başarıyla kaydedildi`,
          warning: earlyLeaveWarning // Erken çıkış uyarısı varsa
        })
      }
      
    } catch (error) {
      // Rollback transaction
      await client.query('ROLLBACK')
      client.release()
      throw error
    }
    
  } catch (error) {
    console.error('Attendance check error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'İşlem başarısız'
      })
    }
  }
}
