-- Mevcut attendance kayıtlarının work_hours ve net_earnings değerlerini güncelle

UPDATE attendance a
SET 
  work_hours = EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time)) / 3600,
  net_earnings = (EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time)) / 3600) * p.hourly_wage
FROM personnel p
WHERE 
  a.personnel_id = p.id
  AND a.check_out_time IS NOT NULL
  AND (a.work_hours IS NULL OR a.work_hours = 0 OR a.net_earnings IS NULL OR a.net_earnings = 0);

-- Kontrol için: Güncellenmiş kayıt sayısını göster
SELECT 
  COUNT(*) as updated_records,
  SUM(net_earnings) as total_earnings,
  AVG(work_hours) as avg_hours
FROM attendance
WHERE check_out_time IS NOT NULL AND net_earnings > 0;
