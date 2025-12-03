import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  FileText, Download, Calendar, Users, MapPin, 
  TrendingUp, DollarSign, Clock, Filter, Loader,
  BarChart3, PieChart as PieChartIcon, Activity
} from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { tr } from 'date-fns/locale'
import toast from 'react-hot-toast'

const Reports = () => {
  const [reportType, setReportType] = useState('attendance') // attendance, personnel, location
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState(null)
  
  // Filters
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [selectedLocation, setSelectedLocation] = useState('all')
  const [selectedPersonnel, setSelectedPersonnel] = useState('all')
  
  // Locations and Personnel for filters
  const [locations, setLocations] = useState([])
  const [personnel, setPersonnel] = useState([])

  useEffect(() => {
    fetchFiltersData()
  }, [])

  useEffect(() => {
    if (reportType) {
      fetchReportData()
    }
  }, [reportType, startDate, endDate, selectedLocation, selectedPersonnel])

  const fetchFiltersData = async () => {
    try {
      // Fetch locations
      const locResponse = await fetch('/.netlify/functions/get-dashboard-stats')
      const locResult = await locResponse.json()
      if (locResult.success) {
        setLocations(locResult.locations || [])
        setPersonnel(locResult.personnel || [])
      }
    } catch (error) {
      console.error('Filter data error:', error)
    }
  }

  const fetchReportData = async () => {
    setLoading(true)
    try {
      let endpoint = ''
      let params = new URLSearchParams({
        startDate,
        endDate
      })

      if (selectedLocation !== 'all') {
        params.append('locationId', selectedLocation)
      }

      if (selectedPersonnel !== 'all' && reportType === 'attendance') {
        params.append('personnelId', selectedPersonnel)
      }

      switch (reportType) {
        case 'attendance':
          endpoint = `/.netlify/functions/reports-attendance?${params}`
          break
        case 'personnel':
          endpoint = `/.netlify/functions/reports-personnel?${params}`
          break
        case 'location':
          endpoint = `/.netlify/functions/reports-location?${params}`
          break
        default:
          return
      }

      const response = await fetch(endpoint)
      const result = await response.json()

      if (result.success) {
        setReportData(result)
      } else {
        toast.error('Rapor yüklenemedi')
      }
    } catch (error) {
      console.error('Report fetch error:', error)
      toast.error('Bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!reportData || !reportData.data) {
      toast.error('Dışa aktarılacak veri yok')
      return
    }

    try {
      // CSV formatına çevir
      const headers = Object.keys(reportData.data[0])
      const csvContent = [
        headers.join(','),
        ...reportData.data.map(row => 
          headers.map(header => {
            const value = row[header]
            return typeof value === 'string' ? `"${value}"` : (value || '')
          }).join(',')
        )
      ].join('\n')

      // İndir
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${reportType}_raporu_${format(new Date(), 'yyyy-MM-dd')}.csv`
      link.click()

      toast.success('Rapor indirildi!')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Dışa aktarma başarısız')
    }
  }

  const quickDateRanges = [
    { label: 'Bugün', days: 0 },
    { label: 'Son 7 Gün', days: 7 },
    { label: 'Son 30 Gün', days: 30 },
    { label: 'Bu Ay', days: 'month' }
  ]

  const setQuickDate = (range) => {
    const today = new Date()
    if (range.days === 'month') {
      setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'))
      setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'))
    } else if (range.days === 0) {
      setStartDate(format(today, 'yyyy-MM-dd'))
      setEndDate(format(today, 'yyyy-MM-dd'))
    } else {
      setStartDate(format(subDays(today, range.days), 'yyyy-MM-dd'))
      setEndDate(format(today, 'yyyy-MM-dd'))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary-600" />
            Raporlar
          </h1>
          <p className="text-gray-600 mt-2">
            Detaylı istatistikler ve raporlar
          </p>
        </div>

        {/* Report Type Selection */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Rapor Türü</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setReportType('attendance')}
              className={`p-4 rounded-lg border-2 transition-all ${
                reportType === 'attendance'
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-gray-200 hover:border-primary-300'
              }`}
            >
              <Activity className="w-8 h-8 text-primary-600 mb-2" />
              <h3 className="font-bold text-gray-900">Devamsızlık Raporu</h3>
              <p className="text-sm text-gray-600 mt-1">
                Giriş/çıkış detayları ve mesai takibi
              </p>
            </button>

            <button
              onClick={() => setReportType('personnel')}
              className={`p-4 rounded-lg border-2 transition-all ${
                reportType === 'personnel'
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-gray-200 hover:border-primary-300'
              }`}
            >
              <Users className="w-8 h-8 text-blue-600 mb-2" />
              <h3 className="font-bold text-gray-900">Personel Raporu</h3>
              <p className="text-sm text-gray-600 mt-1">
                Personel bazlı performans ve kazanç
              </p>
            </button>

            <button
              onClick={() => setReportType('location')}
              className={`p-4 rounded-lg border-2 transition-all ${
                reportType === 'location'
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-gray-200 hover:border-primary-300'
              }`}
            >
              <MapPin className="w-8 h-8 text-green-600 mb-2" />
              <h3 className="font-bold text-gray-900">Lokasyon Raporu</h3>
              <p className="text-sm text-gray-600 mt-1">
                Şube bazlı analiz ve karşılaştırma
              </p>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtreler
            </h2>
            <button
              onClick={handleExport}
              disabled={!reportData || loading}
              className="btn-secondary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Excel İndir
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Başlangıç Tarihi */}
            <div>
              <label className="label">Başlangıç Tarihi</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field"
              />
            </div>

            {/* Bitiş Tarihi */}
            <div>
              <label className="label">Bitiş Tarihi</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field"
              />
            </div>

            {/* Lokasyon */}
            <div>
              <label className="label">Lokasyon</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="input-field"
                disabled={reportType === 'location'}
              >
                <option value="all">Tümü</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            {/* Personel (sadece devamsızlık raporunda) */}
            {reportType === 'attendance' && (
              <div>
                <label className="label">Personel</label>
                <select
                  value={selectedPersonnel}
                  onChange={(e) => setSelectedPersonnel(e.target.value)}
                  className="input-field"
                >
                  <option value="all">Tümü</option>
                  {personnel.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.surname}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Hızlı Tarih Seçimi */}
          <div className="flex gap-2 mt-4">
            {quickDateRanges.map(range => (
              <button
                key={range.label}
                onClick={() => setQuickDate(range)}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* Report Content */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Loader className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
            <p className="text-gray-600">Rapor hazırlanıyor...</p>
          </div>
        ) : reportData ? (
          <div className="space-y-6">
            {/* Summary Stats */}
            {reportData.summary && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {reportType === 'attendance' && (
                  <>
                    <div className="bg-white rounded-lg shadow-sm p-4">
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <Users className="w-4 h-4" />
                        <span className="text-sm">Toplam Kayıt</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        {reportData.summary.total_records || 0}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-4">
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">Toplam Saat</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-700">
                        {parseFloat(reportData.summary.total_hours || 0).toFixed(1)} sa
                      </p>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-4">
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm">Fazla Mesai</span>
                      </div>
                      <p className="text-2xl font-bold text-orange-700">
                        {(parseFloat(reportData.summary.total_overtime_mins || 0) / 60).toFixed(1)} sa
                      </p>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-4">
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-sm">Net Kazanç</span>
                      </div>
                      <p className="text-2xl font-bold text-green-700">
                        {parseFloat(reportData.summary.total_net_earnings || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </p>
                    </div>
                  </>
                )}

                {reportType === 'personnel' && (
                  <>
                    <div className="bg-white rounded-lg shadow-sm p-4">
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <Users className="w-4 h-4" />
                        <span className="text-sm">Aktif Personel</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        {reportData.summary.total_active_personnel || 0}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-4">
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-sm">Aylık Bordro</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-700">
                        {parseFloat(reportData.summary.total_monthly_payroll || 0).toLocaleString('tr-TR')} ₺
                      </p>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-4">
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <Activity className="w-4 h-4" />
                        <span className="text-sm">Toplam Kayıt</span>
                      </div>
                      <p className="text-2xl font-bold text-purple-700">
                        {reportData.summary.total_attendance_records || 0}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-4">
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-sm">Ödenen Tutar</span>
                      </div>
                      <p className="text-2xl font-bold text-green-700">
                        {parseFloat(reportData.summary.total_net_paid || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    {reportType === 'attendance' && (
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Tarih</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Personel</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Lokasyon</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Giriş</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Çıkış</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Çalışma</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Kazanç</th>
                      </tr>
                    )}
                    {reportType === 'personnel' && (
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Personel No</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Ad Soyad</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Pozisyon</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Çalışma Günü</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Toplam Saat</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Net Kazanç</th>
                      </tr>
                    )}
                    {reportType === 'location' && (
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Lokasyon</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Personel</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Toplam Kayıt</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Çalışma Saati</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Fazla Mesai</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Net Ödeme</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y">
                    {reportData.data && reportData.data.length > 0 ? (
                      reportData.data.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          {reportType === 'attendance' && (
                            <>
                              <td className="px-4 py-3">{format(new Date(row.work_date), 'dd MMM yyyy', { locale: tr })}</td>
                              <td className="px-4 py-3 font-medium">{row.personnel_name}</td>
                              <td className="px-4 py-3">{row.location_name}</td>
                              <td className="px-4 py-3">
                                {row.check_in ? 
                                  (row.check_in.includes(':') ? 
                                    row.check_in.substring(0, 5) : 
                                    format(new Date(`2000-01-01T${row.check_in}`), 'HH:mm')
                                  ) : '-'
                                }
                              </td>
                              <td className="px-4 py-3">
                                {row.check_out ? 
                                  (row.check_out.includes(':') ? 
                                    row.check_out.substring(0, 5) : 
                                    format(new Date(`2000-01-01T${row.check_out}`), 'HH:mm')
                                  ) : 
                                  <span className="text-orange-600 font-medium">Devam ediyor</span>
                                }
                              </td>
                              <td className="px-4 py-3 text-right">
                                {row.check_out ? 
                                  `${row.work_hours?.toFixed(1) || '-'} sa` :
                                  <span className="text-blue-600">-</span>
                                }
                              </td>
                              <td className="px-4 py-3 text-right font-semibold">
                                {row.check_out ? 
                                  <span className="text-green-700">{parseFloat(row.net_earnings || 0).toFixed(2)} ₺</span> :
                                  <span className="text-orange-600 text-xs">Hesaplanıyor...</span>
                                }
                              </td>
                            </>
                          )}
                          {reportType === 'personnel' && (
                            <>
                              <td className="px-4 py-3">{row.personnel_no}</td>
                              <td className="px-4 py-3 font-medium">{row.personnel_name}</td>
                              <td className="px-4 py-3">{row.position}</td>
                              <td className="px-4 py-3 text-right">{row.total_days_worked || 0}</td>
                              <td className="px-4 py-3 text-right">{parseFloat(row.total_hours || 0).toFixed(1)} sa</td>
                              <td className="px-4 py-3 text-right font-semibold text-green-700">
                                {parseFloat(row.total_net_earnings || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                              </td>
                            </>
                          )}
                          {reportType === 'location' && (
                            <>
                              <td className="px-4 py-3 font-medium">{row.location_name}</td>
                              <td className="px-4 py-3 text-right">{row.total_personnel || 0}</td>
                              <td className="px-4 py-3 text-right">{row.total_attendance || 0}</td>
                              <td className="px-4 py-3 text-right">{parseFloat(row.total_work_hours || 0).toFixed(1)} sa</td>
                              <td className="px-4 py-3 text-right">{parseFloat(row.total_overtime_hours || 0).toFixed(1)} sa</td>
                              <td className="px-4 py-3 text-right font-semibold text-green-700">
                                {parseFloat(row.total_net_pay || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                          Veri bulunamadı
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Rapor türü seçin ve filtreleyin</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Reports
