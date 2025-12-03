import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Users, MapPin, FileText, Settings, LogOut, Home,
  Clock, Calendar, TrendingUp, Activity, Download,
  Plus, Edit, Trash2, Eye, Filter, Search,
  ChevronLeft, ChevronRight, BarChart3, PieChart
} from 'lucide-react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'
import PersonnelAddModal from '../components/PersonnelAddModal'
import PersonnelShiftModal from '../components/PersonnelShiftModal'
import PersonnelDetailModal from '../components/PersonnelDetailModal'
import PersonnelEditModal from '../components/PersonnelEditModal'

const AdminDashboard = ({ section = 'dashboard' }) => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, logout } = useAuthStore()
  const [activeSection, setActiveSection] = useState(section)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('today')
  const [locationFilter, setLocationFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedPersonnel, setSelectedPersonnel] = useState(null)
  const [selectedPersonnelId, setSelectedPersonnelId] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  
  // API Data States
  const [dashboardData, setDashboardData] = useState(null)
  const [personnel, setPersonnel] = useState([])
  const [attendance, setAttendance] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch dashboard data from API
  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/.netlify/functions/get-dashboard-stats')
      const data = await response.json()
      
      if (data.success) {
        setDashboardData(data.stats)
        setPersonnel(data.personnel)
        setAttendance(data.todayAttendance)
        setLocations(data.locations)
      } else {
        toast.error('Veriler yüklenemedi')
      }
    } catch (error) {
      console.error('Dashboard data error:', error)
      toast.error('Bağlantı hatası')
    } finally {
      setLoading(false)
    }
  }

  // Update section based on prop or URL
  useEffect(() => {
    const sectionParam = searchParams.get('section')
    if (sectionParam) {
      setActiveSection(sectionParam)
    } else if (section !== 'dashboard') {
      setActiveSection(section)
    }
  }, [section, searchParams])

  const menuItems = [
    { id: 'dashboard', label: 'Ana Sayfa', icon: Home },
    { id: 'personnel', label: 'Personeller', icon: Users },
    { id: 'locations', label: 'Lokasyonlar', icon: MapPin },
    { id: 'reports', label: 'Raporlar', icon: FileText },
    { id: 'settings', label: 'Ayarlar', icon: Settings },
  ]

  const stats = dashboardData ? [
    { label: 'Toplam Personel', value: dashboardData.totalPersonnel.toString(), change: '+12%', icon: Users, color: 'blue' },
    { label: 'Aktif Lokasyon', value: dashboardData.totalLocations.toString(), change: '0%', icon: MapPin, color: 'green' },
    { label: 'Bugün Giriş', value: dashboardData.todayCheckIns.toString(), change: '+5%', icon: Activity, color: 'purple' },
    { label: 'Ortalama Çalışma', value: `${dashboardData.avgWorkHours} saat`, change: '-2%', icon: Clock, color: 'orange' },
  ] : []

  const handleSectionChange = (sectionId) => {
    setActiveSection(sectionId)
    if (sectionId === 'reports') {
      navigate('/admin/reports')
    } else {
      navigate(`/admin/${sectionId === 'dashboard' ? 'dashboard' : sectionId}`)
    }
  }

  // Delete personnel
  const handleDeletePersonnel = async (personnelId, personnelName) => {
    if (!confirm(`${personnelName} personelini pasifleştirmek istediğinize emin misiniz?`)) {
      return
    }

    try {
      const response = await fetch('/.netlify/functions/personnel-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personnelId })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Personel pasifleştirildi')
        fetchDashboardData()
      } else {
        toast.error(result.error || 'Silme işlemi başarısız')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Bir hata oluştu')
    }
  }

  // Excel Export
  const handleExcelExport = async () => {
    try {
      toast.loading('Excel hazırlanıyor...')
      
      const response = await fetch('/.netlify/functions/personnel-export')
      const result = await response.json()
      
      if (result.success && result.data) {
        // CSV formatına çevir
        const headers = Object.keys(result.data[0])
        const csvContent = [
          headers.join(','),
          ...result.data.map(row => 
            headers.map(header => `"${row[header] || ''}"`).join(',')
          )
        ].join('\n')
        
        // İndir
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `personel_listesi_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
        
        toast.dismiss()
        toast.success(`${result.total} personel Excel'e aktarıldı!`)
      } else {
        toast.dismiss()
        toast.error('Excel oluşturulamadı')
      }
    } catch (error) {
      console.error('Export error:', error)
      toast.dismiss()
      toast.error('Bir hata oluştu')
    }
  }

  const renderDashboard = () => (
    <div>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg bg-${stat.color}-100`}>
                <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
              </div>
              <span className={`text-sm font-medium ${
                stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
              }`}>
                {stat.change}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
            <p className="text-sm text-gray-600 mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Attendance */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Bugünkü Giriş/Çıkışlar</h2>
            <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              Tümünü Gör →
            </button>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
            ) : attendance.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Bugün henüz giriş yapılmamış</div>
            ) : (
              attendance.slice(0, 5).map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{record.personnel_name}</p>
                    <p className="text-sm text-gray-600">{record.location_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      <span className="text-green-600">
                        {format(new Date(record.check_in_time), 'HH:mm')}
                      </span>
                      {record.check_out_time && (
                        <>
                          {' - '}
                          <span className="text-red-600">
                            {format(new Date(record.check_out_time), 'HH:mm')}
                          </span>
                        </>
                      )}
                    </p>
                    {record.check_out_time ? (
                      <p className="text-xs text-gray-500">{record.work_hours?.toFixed(1)} saat</p>
                    ) : (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Çalışıyor</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="card"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Hızlı İşlemler</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setShowModal(true)}
              className="p-4 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
            >
              <Plus className="w-6 h-6 text-primary-600 mb-2" />
              <p className="text-sm font-medium text-gray-900">Personel Ekle</p>
            </button>
            <button className="p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
              <MapPin className="w-6 h-6 text-green-600 mb-2" />
              <p className="text-sm font-medium text-gray-900">Lokasyon Ekle</p>
            </button>
            <button className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
              <BarChart3 className="w-6 h-6 text-purple-600 mb-2" />
              <p className="text-sm font-medium text-gray-900">Rapor Oluştur</p>
            </button>
            <button className="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors">
              <Download className="w-6 h-6 text-orange-600 mb-2" />
              <p className="text-sm font-medium text-gray-900">Excel İndir</p>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )

  const renderPersonnel = () => (
    <div>
      {/* Header with Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Personel Yönetimi</h2>
        <div className="flex gap-3">
          <button 
            onClick={handleExcelExport}
            className="btn-secondary flex items-center gap-2"
            disabled={loading}
          >
            <Download className="w-4 h-4" />
            Excel İndir
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Yeni Personel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Personel ara..."
                className="input-field pl-10"
              />
            </div>
          </div>
          <select 
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="input-field w-full md:w-48"
            disabled={loading}
          >
            <option value="all">Tüm Lokasyonlar</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.location_code}>{loc.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Personnel Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Personel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pozisyon
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lokasyon
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aylık Maaş
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Günlük Ücret
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vardiya
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                    Yükleniyor...
                  </td>
                </tr>
              ) : personnel.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                    Henüz personel eklenmemiş
                  </td>
                </tr>
              ) : (
                personnel
                  .filter(p => searchTerm ? 
                    (p.name + ' ' + p.surname).toLowerCase().includes(searchTerm.toLowerCase()) : true)
                  .filter(p => locationFilter === 'all' || p.location_code === locationFilter)
                  .map((person) => (
                    <tr key={person.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <span className="text-primary-700 font-semibold">
                              {person.name[0]}{person.surname[0]}
                            </span>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">
                              {person.name} {person.surname}
                            </p>
                            <p className="text-sm text-gray-500">ID: {person.personnel_no}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{person.position || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{person.location_name || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-bold text-green-700">
                          {person.monthly_salary ? `${parseFloat(person.monthly_salary).toLocaleString('tr-TR')} ₺` : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm text-gray-900">
                          {person.daily_wage ? `${parseFloat(person.daily_wage).toFixed(2)} ₺` : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs text-gray-600">
                          {person.shift_start_time && person.shift_end_time 
                            ? `${person.shift_start_time.substring(0, 5)} - ${person.shift_end_time.substring(0, 5)}`
                            : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          person.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {person.is_active ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => {
                              setSelectedPersonnelId(person.id)
                              setShowDetailModal(true)
                            }}
                            className="text-primary-600 hover:text-primary-900 transition-colors"
                            title="Detay Görüntüle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedPersonnel(person)
                              setShowEditModal(true)
                            }}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                            title="Düzenle"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedPersonnel(person)
                              setShowShiftModal(true)
                            }}
                            className="text-purple-600 hover:text-purple-900 transition-colors"
                            title="Mesai Ayarları"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeletePersonnel(person.id, `${person.name} ${person.surname}`)}
                            className="text-red-600 hover:text-red-900 transition-colors"
                            title="Pasifleştir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return renderDashboard()
      case 'personnel':
        return renderPersonnel()
      case 'locations':
        return (
          <div className="card">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Lokasyon Yönetimi</h2>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {locations.map((location) => (
                  <div key={location.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">{location.name}</h3>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {location.location_code}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">{location.address}</p>
                    <div className="flex items-center justify-between border-t pt-3">
                      <div>
                        <p className="text-xs text-gray-500">Toplam Personel</p>
                        <p className="text-lg font-semibold text-gray-900">{location.personnel_count}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Bugün Aktif</p>
                        <p className="text-lg font-semibold text-green-600">{location.active_today || 0}</p>
                      </div>
                      <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                        Detaylar →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      case 'reports':
        return (
          <div className="card">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Raporlar</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-gray-200 rounded-lg p-6">
                <PieChart className="w-8 h-8 text-primary-600 mb-4" />
                <h3 className="font-semibold mb-2">Aylık Puantaj Raporu</h3>
                <p className="text-gray-600 text-sm mb-4">Personel çalışma saatleri ve puantaj detayları</p>
                <button className="btn-primary w-full">Rapor Oluştur</button>
              </div>
              <div className="border border-gray-200 rounded-lg p-6">
                <BarChart3 className="w-8 h-8 text-green-600 mb-4" />
                <h3 className="font-semibold mb-2">Lokasyon Bazlı Rapor</h3>
                <p className="text-gray-600 text-sm mb-4">Şube bazında personel ve çalışma analizi</p>
                <button className="btn-primary w-full">Rapor Oluştur</button>
              </div>
            </div>
          </div>
        )
      case 'settings':
        return (
          <div className="card">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Sistem Ayarları</h2>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3">QR Kod Ayarları</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">QR Kod Yenileme Süresi</span>
                    <select className="input-field w-32">
                      <option>90 saniye</option>
                      <option>60 saniye</option>
                      <option>120 saniye</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      default:
        return renderDashboard()
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <motion.aside 
        initial={{ x: -250 }}
        animate={{ x: 0 }}
        className="w-64 bg-white border-r border-gray-200"
      >
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-600 mt-1">{user?.name || 'Admin'}</p>
        </div>
        
        <nav className="p-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSectionChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-1 ${
                activeSection === item.id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Çıkış Yap</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {renderContent()}
        </div>
      </main>

      {/* Personel Ekle Modal */}
      <PersonnelAddModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchDashboardData}
        locations={locations}
      />

      {/* Mesai Ayarları Modal */}
      <PersonnelShiftModal
        isOpen={showShiftModal}
        onClose={() => {
          setShowShiftModal(false)
          setSelectedPersonnel(null)
        }}
        onSuccess={fetchDashboardData}
        personnel={selectedPersonnel}
      />

      {/* Personel Detay Modal */}
      <PersonnelDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedPersonnelId(null)
        }}
        personnelId={selectedPersonnelId}
      />

      {/* Personel Düzenle Modal */}
      <PersonnelEditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedPersonnel(null)
        }}
        onSuccess={fetchDashboardData}
        personnel={selectedPersonnel}
        locations={locations}
      />
    </div>
  )
}

export default AdminDashboard
