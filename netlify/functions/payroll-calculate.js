const { Client } = require('pg')

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

// Vergi ve SGK oranlarını getir
async function getTaxRates(client) {
  const result = await client.query(
    `SELECT rate_type, rate_percentage 
     FROM tax_rates 
     WHERE is_active = true 
     AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
     ORDER BY effective_from DESC`
  )
  
  const rates = {}
  result.rows.forEach(row => {
    rates[row.rate_type] = parseFloat(row.rate_percentage) / 100
  })
  
  return rates
}

// Bordro hesaplama
function calculatePayroll(data, taxRates) {
  const {
    baseSalary,
    totalWorkDays,
    actualWorkDays,
    overtimeHours,
    bonusAmount,
    allowances,
    advanceDeduction,
    penaltyDeduction
  } = data

  // Fazla mesai ücreti (saatlik ücret × 1.5 × saat)
  const hourlyWage = baseSalary / 26 / 8 // 26 iş günü, 8 saat
  const overtimePay = overtimeHours * hourlyWage * 1.5

  // Brüt maaş
  const grossSalary = baseSalary + overtimePay + (bonusAmount || 0) + (allowances || 0)

  // Kesintiler
  const sskEmployee = grossSalary * (taxRates.ssk_employee || 0.14)
  const unemploymentInsurance = grossSalary * (taxRates.unemployment || 0.01)
  const incomeTax = grossSalary * (taxRates.income_tax || 0.15)
  const stampTax = grossSalary * (taxRates.stamp_tax || 0.00759)

  const totalDeductions = sskEmployee + unemploymentInsurance + incomeTax + stampTax + 
                         (advanceDeduction || 0) + (penaltyDeduction || 0)

  // Net maaş
  const netSalary = grossSalary - totalDeductions

  // İşveren maliyeti
  const sskEmployer = grossSalary * (taxRates.ssk_employer || 0.205)
  const sgkTotal = sskEmployee + sskEmployer
  const employerTotalCost = grossSalary + sskEmployer

  return {
    grossSalary: parseFloat(grossSalary.toFixed(2)),
    overtimePay: parseFloat(overtimePay.toFixed(2)),
    
    // Kesintiler
    sskEmployee: parseFloat(sskEmployee.toFixed(2)),
    unemploymentInsurance: parseFloat(unemploymentInsurance.toFixed(2)),
    incomeTax: parseFloat(incomeTax.toFixed(2)),
    stampTax: parseFloat(stampTax.toFixed(2)),
    advanceDeduction: parseFloat(advanceDeduction || 0),
    penaltyDeduction: parseFloat(penaltyDeduction || 0),
    totalDeductions: parseFloat(totalDeductions.toFixed(2)),
    
    // Net ve İşveren
    netSalary: parseFloat(netSalary.toFixed(2)),
    sskEmployer: parseFloat(sskEmployer.toFixed(2)),
    sgkTotal: parseFloat(sgkTotal.toFixed(2)),
    employerTotalCost: parseFloat(employerTotalCost.toFixed(2))
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    }
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    const { 
      personnelId, 
      periodYear, 
      periodMonth,
      calculatedBy,
      autoApprove = false
    } = JSON.parse(event.body)

    if (!personnelId || !periodYear || !periodMonth || !calculatedBy) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'personnelId, periodYear, periodMonth ve calculatedBy gerekli'
        })
      }
    }

    await client.connect()

    // Personel bilgilerini getir
    const personnelResult = await client.query(
      `SELECT id, name, surname, personnel_no, monthly_salary, daily_wage, hourly_wage, location_id
       FROM personnel WHERE id = $1`,
      [personnelId]
    )

    if (personnelResult.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Personel bulunamadı' })
      }
    }

    const personnel = personnelResult.rows[0]

    // Dönem tarihleri
    const periodStart = new Date(periodYear, periodMonth - 1, 1)
    const periodEnd = new Date(periodYear, periodMonth, 0)

    // Çalışma günlerini hesapla
    const attendanceResult = await client.query(
      `SELECT 
        COUNT(*) as total_days,
        SUM(CASE WHEN check_out_time IS NOT NULL THEN 1 ELSE 0 END) as completed_days,
        COALESCE(SUM(work_hours), 0) as total_hours,
        COALESCE(SUM(CASE WHEN work_hours > 8 THEN work_hours - 8 ELSE 0 END), 0) as overtime_hours,
        COALESCE(SUM(net_earnings), 0) as total_earnings
       FROM attendance
       WHERE personnel_id = $1 
       AND DATE(check_in_time) >= $2 
       AND DATE(check_in_time) <= $3`,
      [personnelId, periodStart, periodEnd]
    )

    const attendance = attendanceResult.rows[0]

    // İzin günlerini hesapla
    const leaveResult = await client.query(
      `SELECT COALESCE(SUM(total_days), 0) as leave_days
       FROM leave_records
       WHERE personnel_id = $1
       AND start_date <= $2
       AND end_date >= $3
       AND status = 'approved'`,
      [personnelId, periodEnd, periodStart]
    )

    const leaveDays = parseInt(leaveResult.rows[0].leave_days || 0)

    // Avans kesintileri
    const advanceResult = await client.query(
      `SELECT COALESCE(SUM(amount), 0) as total_advance
       FROM advance_payments
       WHERE personnel_id = $1
       AND status = 'paid'
       AND deduction_status = 'pending'`,
      [personnelId]
    )

    const advanceAmount = parseFloat(advanceResult.rows[0].total_advance || 0)

    // Ceza kesintileri (salary_adjustments tablosundan)
    const penaltyResult = await client.query(
      `SELECT COALESCE(SUM(amount), 0) as total_penalty
       FROM salary_adjustments
       WHERE personnel_id = $1
       AND adjustment_type = 'penalty'
       AND status = 'approved'
       AND created_at >= $2
       AND created_at <= $3`,
      [personnelId, periodStart, periodEnd]
    )

    const penaltyAmount = parseFloat(penaltyResult.rows[0].total_penalty || 0)

    // İş günü hesabı (ayın iş günü sayısı)
    const totalWorkDays = periodEnd.getDate() - 4 // Yaklaşık iş günü (hafta sonları hariç)
    const actualWorkDays = parseInt(attendance.completed_days || 0)
    const absentDays = totalWorkDays - actualWorkDays - leaveDays

    // Vergi oranlarını getir
    const taxRates = await getTaxRates(client)

    // Bordroyu hesapla
    const calculation = calculatePayroll({
      baseSalary: parseFloat(personnel.monthly_salary || 0),
      totalWorkDays: totalWorkDays,
      actualWorkDays: actualWorkDays,
      overtimeHours: parseFloat(attendance.overtime_hours || 0),
      bonusAmount: 0,
      allowances: 0,
      advanceDeduction: advanceAmount,
      penaltyDeduction: penaltyAmount
    }, taxRates)

    // Mevcut kayıt var mı kontrol et
    const existingPayroll = await client.query(
      `SELECT id FROM payroll 
       WHERE personnel_id = $1 AND year = $2 AND month = $3`,
      [personnelId, periodYear, periodMonth]
    )

    let payrollId
    const status = autoApprove ? 'approved' : 'calculated'

    if (existingPayroll.rows.length > 0) {
      // Güncelle
      payrollId = existingPayroll.rows[0].id
      
      await client.query(
        `UPDATE payroll SET
          total_work_days = $1,
          actual_work_days = $2,
          absent_days = $3,
          leave_days = $4,
          total_work_hours = $5,
          overtime_hours = $6,
          base_salary = $7,
          overtime_pay = $8,
          gross_salary = $9,
          ssk_employee = $10,
          unemployment_insurance = $11,
          income_tax = $12,
          stamp_tax = $13,
          advance_deduction = $14,
          penalty_deduction = $15,
          total_deductions = $16,
          net_salary = $17,
          ssk_employer = $18,
          sgk_total = $19,
          employer_total_cost = $20,
          status = $21,
          calculated_by = $22,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $23`,
        [
          totalWorkDays, actualWorkDays, absentDays, leaveDays,
          attendance.total_hours, attendance.overtime_hours,
          personnel.monthly_salary, calculation.overtimePay,
          calculation.grossSalary, calculation.sskEmployee,
          calculation.unemploymentInsurance, calculation.incomeTax,
          calculation.stampTax, calculation.advanceDeduction,
          calculation.penaltyDeduction, calculation.totalDeductions,
          calculation.netSalary, calculation.sskEmployer,
          calculation.sgkTotal, calculation.employerTotalCost,
          status, calculatedBy, payrollId
        ]
      )
    } else {
      // Yeni kayıt
      const insertResult = await client.query(
        `INSERT INTO payroll (
          personnel_id, location_id, year, month,
          period_start, period_end, total_work_days, actual_work_days,
          absent_days, leave_days, total_work_hours, overtime_hours,
          base_salary, overtime_pay, gross_salary,
          ssk_employee, unemployment_insurance, income_tax, stamp_tax,
          advance_deduction, penalty_deduction, total_deductions,
          net_salary, ssk_employer, sgk_total, employer_total_cost,
          status, calculated_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
        ) RETURNING id`,
        [
          personnelId, personnel.location_id, periodYear, periodMonth,
          periodStart, periodEnd, totalWorkDays, actualWorkDays,
          absentDays, leaveDays, attendance.total_hours, attendance.overtime_hours,
          personnel.monthly_salary, calculation.overtimePay, calculation.grossSalary,
          calculation.sskEmployee, calculation.unemploymentInsurance,
          calculation.incomeTax, calculation.stampTax,
          calculation.advanceDeduction, calculation.penaltyDeduction,
          calculation.totalDeductions, calculation.netSalary,
          calculation.sskEmployer, calculation.sgkTotal,
          calculation.employerTotalCost, status, calculatedBy
        ]
      )
      
      payrollId = insertResult.rows[0].id
    }

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, table_name, record_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        calculatedBy,
        'payroll_calculate',
        'payroll',
        payrollId,
        JSON.stringify({ 
          period: `${periodYear}-${periodMonth}`,
          net_salary: calculation.netSalary
        })
      ]
    )

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Bordro hesaplandı',
        payrollId: payrollId,
        calculation: {
          ...calculation,
          totalWorkDays,
          actualWorkDays,
          absentDays,
          leaveDays,
          totalWorkHours: parseFloat(attendance.total_hours || 0),
          personnelName: `${personnel.name} ${personnel.surname}`
        }
      })
    }

  } catch (error) {
    console.error('Payroll calculate error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Bordro hesaplanamadı'
      })
    }
  } finally {
    await client.end()
  }
}
