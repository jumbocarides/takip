import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  DollarSign, Calendar, Users, TrendingUp, Download,
  Plus, Check, X, Clock, CreditCard, AlertCircle,
  FileText, Filter, Search, ChevronDown, Eye,
  Loader, BarChart3, PieChart as PieChartIcon
} from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'

const Payroll = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  
  // States
  const [loading, setLoading] = useState(true)
  const [payrolls, setPayrolls] = useState([])
  const [personnel, setPersonnel] = useState([])
  const [advances, setAdvances] = useState([])
  const [stats, setStats] = useState(null)
  
  // Filters
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedStatus, setSelectedStatus] = useState('all')
  
  // Modals
  const [showCalculateModal, setShowCalculateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showAdvanceModal, setShowAdvanceModal] = useState(false)
  const [selectedPayroll, setSelectedPayroll] = useState(null)
  
  // Calculate Form
  const [calculatePersonnelId, setCalculatePersonnelId] = useState('')
  const [calculating, setCalculating] = useState(false)
  
  // Active Tab
  const [activeTab, setActiveTab] = useState('payrolls') // 'payrolls' or 'advances'

  useEffect(() => {
    fetchData()
  }, [selectedYear, selectedMonth, selectedStatus])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Bordro listesi
      let url = `/.netlify/functions/payroll-list?`
      const params = new URLSearchParams()
      if (selectedYear !== 'all') params.append('periodYear', selectedYear)
      if (selectedMonth !== 'all') params.append('periodMonth', selectedMonth)
      if (selectedStatus !== 'all') params.append('status', selectedStatus)
      
      const response = await fetch(`/.netlify/functions/payroll-list?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setPayrolls(result.payrolls || [])
        setStats(result.stats)
      }

      // Personel listesi
      const personnelResponse = await fetch('/.netlify/functions/get-dashboard-stats')
      const personnelResult = await personnelResponse.json()
      if (personnelResult.success) {
        setPersonnel(personnelResult.personnel || [])
      }

      // Avans listesi
      if (activeTab === 'advances') {
        const advanceResponse = await fetch('/.netlify/functions/advance-manage')
        const advanceResult = await advanceResponse.json()
        if (advanceResult.success) {
          setAdvances(advanceResult.advances || [])
        }
      }

    } catch (error) {
      console.error('Fetch error:', error)
      toast.error('Veriler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  const handleCalculatePayroll = async () => {
    if (!calculatePersonnelId) {
      toast.error('Personel seçiniz')
      return
    }

    // userId'yi al
    const getUserId = () => {
      if (user?.id) return user.id
      
      const storedUserId = localStorage.getItem('userId')
      if (storedUserId) return storedUserId
      
      const adminUser = localStorage.getItem('adminUser')
      if (adminUser) {
        try {
          const parsed = JSON.parse(adminUser)
          return parsed.id
        } catch (e) {
          console.error('AdminUser parse error:', e)
        }
      }
      
      return null
    }

    const calculatedBy = getUserId()
    
    if (!calculatedBy) {
      toast.error('Kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapın.')
      navigate('/admin/login')
      return
    }

    setCalculating(true)
    try {
      const response = await fetch('/.netlify/functions/payroll-calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personnelId: calculatePersonnelId,
          periodYear: selectedYear,
          periodMonth: selectedMonth,
          calculatedBy: calculatedBy,
          autoApprove: false
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Bordro başarıyla hesaplandı')
        setShowCalculateModal(false)
        setCalculatePersonnelId('')
        fetchData()
      } else {
        toast.error(result.error || 'Hesaplama başarısız')
      }
    } catch (error) {
      console.error('Calculate error:', error)
      toast.error('Bir hata oluştu')
    } finally {
      setCalculating(false)
    }
  }

  const handleApprovePayroll = async (payrollId) => {
    if (!confirm('Bu bordroyu onaylamak istediğinize emin misiniz?')) {
      return
    }

    try {
      const response = await fetch('/.netlify/functions/payroll-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payrollId: payrollId,
          action: 'approve',
          approvedBy: user?.id || localStorage.getItem('userId')
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Bordro onaylandı')
        fetchData()
      } else {
        toast.error(result.error || 'Onaylama başarısız')
      }
    } catch (error) {
      console.error('Approve error:', error)
      toast.error('Bir hata oluştu')
    }
  }

  const handlePayPayroll = async (payrollId) => {
    if (!confirm('Bu bordroyu ödenmiş olarak işaretlemek istediğinize emin misiniz?')) {
      return
    }

    try {
      const response = await fetch('/.netlify/functions/payroll-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payrollId: payrollId,
          action: 'pay',
          approvedBy: user?.id || localStorage.getItem('userId'),
          paymentDate: new Date().toISOString(),
          paymentMethod: 'bank_transfer'
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Bordro ödendi')
        fetchData()
      } else {
        toast.error(result.error || 'İşlem başarısız')
      }
    } catch (error) {
      console.error('Pay error:', error)
      toast.error('Bir hata oluştu')
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-700',
      calculated: 'bg-blue-100 text-blue-700',
      approved: 'bg-green-100 text-green-700',
      paid: 'bg-purple-100 text-purple-700',
      cancelled: 'bg-red-100 text-red-700'
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
  }

  const getStatusText = (status) => {
    const texts = {
      draft: 'Taslak',
      calculated: 'Hesaplandı',
      approved: 'Onaylandı',
      paid: 'Ödendi',
      cancelled: 'İptal'
    }
    return texts[status] || status
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">💰 Bordro Yönetimi</h1>
              <p className="text-gray-600">Aylık maaş bordrolarını hesaplayın ve yönetin</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCalculateModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Bordro Hesapla
              </button>
            </div>
          </div>
        </div>

        {/* İstatistik Kartları */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-sm p-6"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Toplam Bordro</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_payrolls}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-xl shadow-sm p-6"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Toplam Net Maaş</p>
                  <p className="text-2xl font-bold text-green-700">
                    {stats.total_net.toLocaleString('tr-TR')} ₺
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl shadow-sm p-6"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Toplam Kesinti</p>
                  <p className="text-2xl font-bold text-red-700">
                    {stats.total_deductions.toLocaleString('tr-TR')} ₺
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-xl shadow-sm p-6"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">İşveren Maliyeti</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {stats.total_employer_cost.toLocaleString('tr-TR')} ₺
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('payrolls')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'payrolls'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FileText className="w-5 h-5 inline-block mr-2" />
            Bordrolar
          </button>
          <button
            onClick={() => { setActiveTab('advances'); fetchData(); }}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'advances'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <CreditCard className="w-5 h-5 inline-block mr-2" />
            Avanslar
          </button>
        </div>

        {/* Filtreler */}
        {activeTab === 'payrolls' && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Yıl</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                  <option value="all">Tümü</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ay</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value={1}>Ocak</option>
                  <option value={2}>Şubat</option>
                  <option value={3}>Mart</option>
                  <option value={4}>Nisan</option>
                  <option value={5}>Mayıs</option>
                  <option value={6}>Haziran</option>
                  <option value={7}>Temmuz</option>
                  <option value={8}>Ağustos</option>
                  <option value={9}>Eylül</option>
                  <option value={10}>Ekim</option>
                  <option value={11}>Kasım</option>
                  <option value={12}>Aralık</option>
                  <option value="all">Tümü</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Durum</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">Tümü</option>
                  <option value="draft">Taslak</option>
                  <option value="calculated">Hesaplandı</option>
                  <option value="approved">Onaylandı</option>
                  <option value="paid">Ödendi</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={fetchData}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Filter className="w-5 h-5 inline-block mr-2" />
                  Filtrele
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bordro Tablosu */}
        {activeTab === 'payrolls' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader className="w-8 h-8 animate-spin text-primary-600" />
              </div>
            ) : payrolls.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Bordro kaydı bulunamadı</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Personel</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dönem</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Brüt Maaş</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Kesintiler</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Maaş</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Durum</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {payrolls.map((payroll) => (
                      <tr key={payroll.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-gray-900">{payroll.personnel_name}</p>
                            <p className="text-sm text-gray-500">{payroll.personnel_no}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-900">
                            {payroll.month}/{payroll.year}
                          </p>
                          <p className="text-xs text-gray-500">{payroll.actual_work_days} / {payroll.total_work_days} gün</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-medium text-gray-900">
                            {Number(payroll.gross_salary).toLocaleString('tr-TR')} ₺
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-medium text-red-600">
                            -{Number(payroll.total_deductions).toLocaleString('tr-TR')} ₺
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-bold text-green-700 text-lg">
                            {Number(payroll.net_salary).toLocaleString('tr-TR')} ₺
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(payroll.status)}`}>
                            {getStatusText(payroll.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedPayroll(payroll)
                                setShowDetailModal(true)
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Detay"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {payroll.status === 'calculated' && (
                              <button
                                onClick={() => handleApprovePayroll(payroll.id)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Onayla"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            {payroll.status === 'approved' && (
                              <button
                                onClick={() => handlePayPayroll(payroll.id)}
                                className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Öde"
                              >
                                <CreditCard className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Avanslar Sekmesi */}
        {activeTab === 'advances' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-gray-500">Avans yönetimi geliştiriliyor...</p>
          </div>
        )}

        {/* Bordro Hesaplama Modalı */}
        {showCalculateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Bordro Hesapla</h3>
                <button
                  onClick={() => setShowCalculateModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dönem
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value={2025}>2025</option>
                      <option value={2024}>2024</option>
                    </select>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      {[...Array(12)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {format(new Date(2025, i, 1), 'MMMM', { locale: tr })}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Personel Seç
                  </label>
                  <select
                    value={calculatePersonnelId}
                    onChange={(e) => setCalculatePersonnelId(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Personel seçiniz...</option>
                    {personnel.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.surname} - {p.personnel_no}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">Bilgi</p>
                      <p>Bordro otomatik olarak hesaplanacaktır. Devamsızlık kayıtları, izinler, avanslar ve cezalar dahil edilecektir.</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowCalculateModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    disabled={calculating}
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleCalculatePayroll}
                    disabled={calculating || !calculatePersonnelId}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2 ${
                      calculating || !calculatePersonnelId
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-primary-600 hover:bg-primary-700'
                    }`}
                  >
                    {calculating ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Hesaplanıyor...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Bordroyu Hesapla
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Bordro Detay Modalı */}
        {showDetailModal && selectedPayroll && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 my-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Bordro Detayı</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Personel Bilgileri */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Personel Bilgileri</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Ad Soyad</p>
                      <p className="font-medium">{selectedPayroll.personnel_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Personel No</p>
                      <p className="font-medium">{selectedPayroll.personnel_no}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Dönem</p>
                      <p className="font-medium">{selectedPayroll.month}/{selectedPayroll.year}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Lokasyon</p>
                      <p className="font-medium">{selectedPayroll.location_name}</p>
                    </div>
                  </div>
                </div>

                {/* Çalışma İstatistikleri */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Çalışma İstatistikleri</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-600">Toplam Gün</p>
                      <p className="text-2xl font-bold text-blue-700">{selectedPayroll.total_work_days}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-green-600">Çalışılan</p>
                      <p className="text-2xl font-bold text-green-700">{selectedPayroll.actual_work_days}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-sm text-red-600">Devamsız</p>
                      <p className="text-2xl font-bold text-red-700">{selectedPayroll.absent_days}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-purple-600">İzinli</p>
                      <p className="text-2xl font-bold text-purple-700">{selectedPayroll.leave_days}</p>
                    </div>
                  </div>
                </div>

                {/* Ücret Detayı */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Ücret Detayı</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">Temel Maaş</span>
                      <span className="font-medium">{Number(selectedPayroll.base_salary).toLocaleString('tr-TR')} ₺</span>
                    </div>
                    {parseFloat(selectedPayroll.overtime_pay) > 0 && (
                      <div className="flex justify-between py-2">
                        <span className="text-gray-600">Fazla Mesai</span>
                        <span className="font-medium text-green-600">+{Number(selectedPayroll.overtime_pay).toLocaleString('tr-TR')} ₺</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 border-t">
                      <span className="font-medium">Brüt Maaş</span>
                      <span className="font-bold">{Number(selectedPayroll.gross_salary).toLocaleString('tr-TR')} ₺</span>
                    </div>
                  </div>
                </div>

                {/* Kesintiler */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Kesintiler</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">SGK İşçi (%14)</span>
                      <span className="text-red-600">-{Number(selectedPayroll.ssk_employee).toLocaleString('tr-TR')} ₺</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">İşsizlik (%1)</span>
                      <span className="text-red-600">-{Number(selectedPayroll.unemployment_insurance).toLocaleString('tr-TR')} ₺</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">Gelir Vergisi (%15)</span>
                      <span className="text-red-600">-{Number(selectedPayroll.income_tax).toLocaleString('tr-TR')} ₺</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">Damga Vergisi (%0.759)</span>
                      <span className="text-red-600">-{Number(selectedPayroll.stamp_tax).toLocaleString('tr-TR')} ₺</span>
                    </div>
                    {parseFloat(selectedPayroll.advance_deduction) > 0 && (
                      <div className="flex justify-between py-2">
                        <span className="text-gray-600">Avans Kesintisi</span>
                        <span className="text-red-600">-{Number(selectedPayroll.advance_deduction).toLocaleString('tr-TR')} ₺</span>
                      </div>
                    )}
                    {parseFloat(selectedPayroll.penalty_deduction) > 0 && (
                      <div className="flex justify-between py-2">
                        <span className="text-gray-600">Ceza Kesintisi</span>
                        <span className="text-red-600">-{Number(selectedPayroll.penalty_deduction).toLocaleString('tr-TR')} ₺</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 border-t font-medium">
                      <span>Toplam Kesinti</span>
                      <span className="text-red-700">-{Number(selectedPayroll.total_deductions).toLocaleString('tr-TR')} ₺</span>
                    </div>
                  </div>
                </div>

                {/* Net Maaş */}
                <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-semibold text-gray-900">Net Maaş</span>
                    <span className="text-3xl font-bold text-green-700">
                      {Number(selectedPayroll.net_salary).toLocaleString('tr-TR')} ₺
                    </span>
                  </div>
                </div>

                {/* İşveren Maliyeti */}
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">Toplam İşveren Maliyeti</span>
                    <span className="text-xl font-bold text-purple-700">
                      {Number(selectedPayroll.employer_total_cost).toLocaleString('tr-TR')} ₺
                    </span>
                  </div>
                </div>

                {/* Butonlar */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Kapat
                  </button>
                  <button
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    PDF İndir
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Payroll
