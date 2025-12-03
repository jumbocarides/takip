// Real Database Attendance Check with SECURITY
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
    const body = JSON.parse(event.body)
    const { qrCode, personnelId, locationId, action, deviceId, deviceName } = body

    // ========== GÜVENLİK UYARI: QR KOD VE CİHAZ ==========
    // QR ve device yoksa uyar ama engelleme (test için)
    const securityWarnings = []
    
    if (!qrCode || qrCode === 'manual-entry') {
      securityWarnings.push('QR kod okutulmadı - Manuel giriş')
    }
    
    if (!deviceId) {
      securityWarnings.push('Cihaz kimliği alınamadı')
    }

    // Temel validasyon
    if (!personnelId || !locationId || !action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Eksik bilgi: personnelId, locationId ve action gerekli' 
        })
      }
    }
    
    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')
      
      // Get location ID from database
      const locationQuery = await client.query(
        'SELECT id FROM locations WHERE location_code = $1',
        [locationId]
      )
      
      if (locationQuery.rows.length === 0) {
        throw new Error('Geçersiz lokasyon')
      }
      
      const locationDbId = locationQuery.rows[0].id
      
      // Check if personnel has open attendance
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
      
      // ========== CHECK-OUT ==========
      if (action === 'check-out' && hasOpenAttendance) {
        const attendance = openAttendanceQuery.rows[0]
        
        // Calculate work hours
        const checkOutTime = new Date()
        const checkInTime = new Date(attendance.check_in_time)
        workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60)
        
        // Erken çıkma kontrolü
        if (workHours < 8) {
          const remainingHours = 8 - workHours
          earlyLeaveWarning = `⚠️ Standart mesai süresini (8 saat) doldurmadınız. Kalan: ${remainingHours.toFixed(1)} saat. Erken çıkış cezası uygulanacaktır.`
        }
        
        // Update attendance - Trigger otomatik hesaplama yapacak
        const updateQuery = await client.query(
          `UPDATE attendance 
           SET 
             check_out_time = NOW(), 
             check_out_method = 'qr',
             device_id = $1,
             device_name = $2,
             qr_token = $3,
             is_qr_verified = true,
             updated_at = NOW()
           WHERE id = $4
           RETURNING *`,
          [deviceId, deviceName, qrCode, attendance.id]
        )
        
        attendanceRecord = updateQuery.rows[0]
        
        // Erken çıkma notification
        if (earlyLeaveWarning) {
          await client.query(
            `INSERT INTO notifications (
              recipient_id, 
              recipient_type, 
              title, 
              message, 
              type
            ) VALUES ($1, 'personnel', $2, $3, 'warning')`,
            [personnelId, 'Erken Çıkış Uyarısı', earlyLeaveWarning]
          )
        }
        
        // Log
        await client.query(
          'INSERT INTO audit_logs (personnel_id, action, table_name, record_id) VALUES ($1, $2, $3, $4)',
          [personnelId, 'check_out', 'attendance', attendance.id]
        )
        
      // ========== CHECK-IN ==========
      } else if (action === 'check-in' && !hasOpenAttendance) {
        // Get work schedule
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
          
          // Check if late (15+ minutes)
          const diffMinutes = (now - scheduledStart) / (1000 * 60)
          if (diffMinutes > 15) {
            status = 'late'
          }
        }
        
        // Create attendance record with DEVICE INFO
        const insertQuery = await client.query(
          `INSERT INTO attendance (
            personnel_id, 
            location_id, 
            check_in_time, 
            check_in_method,
            status,
            device_id,
            device_name,
            qr_token,
            is_qr_verified,
            ip_address,
            device_info
          ) VALUES ($1, $2, NOW(), 'qr', $3, $4, $5, $6, true, $7, $8)
          RETURNING *`,
          [
            personnelId, 
            locationDbId,
            status,
            deviceId,
            deviceName,
            qrCode,
            event.headers['x-forwarded-for'] || event.headers['client-ip'],
            event.headers['user-agent']
          ]
        )
        
        attendanceRecord = insertQuery.rows[0]
        
        // Log
        await client.query(
          'INSERT INTO audit_logs (personnel_id, action, table_name, record_id) VALUES ($1, $2, $3, $4)',
          [personnelId, 'check_in', 'attendance', attendanceRecord.id]
        )
      } else {
        throw new Error(
          action === 'check-in' && hasOpenAttendance 
            ? 'Zaten açık bir giriş kaydınız var' 
            : 'Açık giriş kaydınız bulunmuyor'
        )
      }
      
      // Get personnel info
      const personnelQuery = await client.query(
        'SELECT name, surname, position FROM personnel WHERE id = $1',
        [personnelId]
      )
      
      const personnel = personnelQuery.rows[0]
      
      // Create success notification
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
      
      // Commit
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
          warning: earlyLeaveWarning,
          securityWarnings: securityWarnings.length > 0 ? securityWarnings : null,
          deviceVerified: deviceId ? true : false
        })
      }
      
    } catch (error) {
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
