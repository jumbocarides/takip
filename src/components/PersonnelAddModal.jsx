import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, Loader } from 'lucide-react'
import toast from 'react-hot-toast'

const PersonnelAddModal = ({ isOpen, onClose, onSuccess, locations }) => {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    personnel_no: '',
    name: '',
    surname: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    location_id: '',
    hire_date: new Date().toISOString().split('T')[0],
    salary: '',
    password: '123456'
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/.netlify/functions/personnel-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Personel başarıyla eklendi!')
        onSuccess()
        onClose()
        // Reset form
        setFormData({
          personnel_no: '',
          name: '',
          surname: '',
          email: '',
          phone: '',
          position: '',
          department: '',
          location_id: '',
          hire_date: new Date().toISOString().split('T')[0],
          salary: '',
          password: '123456'
        })
      } else {
        toast.error(result.error || 'Bir hata oluştu')
      }
    } catch (error) {
      console.error('Add personnel error:', error)
      toast.error('Personel eklenemedi')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-gray-900">Yeni Personel Ekle</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Personel No */}
                <div>
                  <label className="label">Personel No *</label>
                  <input
                    type="text"
                    name="personnel_no"
                    value={formData.personnel_no}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="P005"
                    required
                  />
                </div>

                {/* Ad */}
                <div>
                  <label className="label">Ad *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ahmet"
                    required
                  />
                </div>

                {/* Soyad */}
                <div>
                  <label className="label">Soyad *</label>
                  <input
                    type="text"
                    name="surname"
                    value={formData.surname}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Yılmaz"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="ahmet@example.com"
                  />
                </div>

                {/* Telefon */}
                <div>
                  <label className="label">Telefon</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0555 123 4567"
                  />
                </div>

                {/* Pozisyon */}
                <div>
                  <label className="label">Pozisyon *</label>
                  <select
                    name="position"
                    value={formData.position}
                    onChange={handleChange}
                    className="input-field"
                    required
                  >
                    <option value="">Seçiniz</option>
                    <option value="Garson">Garson</option>
                    <option value="Komi">Komi</option>
                    <option value="Aşçı">Aşçı</option>
                    <option value="Kasa">Kasa</option>
                    <option value="Müdür">Müdür</option>
                    <option value="Diğer">Diğer</option>
                  </select>
                </div>

                {/* Departman */}
                <div>
                  <label className="label">Departman</label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="input-field"
                  >
                    <option value="">Seçiniz</option>
                    <option value="Servis">Servis</option>
                    <option value="Mutfak">Mutfak</option>
                    <option value="Muhasebe">Muhasebe</option>
                    <option value="Yönetim">Yönetim</option>
                  </select>
                </div>

                {/* Lokasyon */}
                <div>
                  <label className="label">Lokasyon *</label>
                  <select
                    name="location_id"
                    value={formData.location_id}
                    onChange={handleChange}
                    className="input-field"
                    required
                  >
                    <option value="">Seçiniz</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>

                {/* İşe Giriş Tarihi */}
                <div>
                  <label className="label">İşe Giriş Tarihi</label>
                  <input
                    type="date"
                    name="hire_date"
                    value={formData.hire_date}
                    onChange={handleChange}
                    className="input-field"
                  />
                </div>

                {/* Maaş */}
                <div>
                  <label className="label">Maaş (₺)</label>
                  <input
                    type="number"
                    name="salary"
                    value={formData.salary}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="17000"
                    step="0.01"
                  />
                </div>

                {/* Şifre */}
                <div>
                  <label className="label">Şifre *</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="123456"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Varsayılan: 123456</p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary flex-1"
                  disabled={loading}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Kaydediliyor...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Kaydet
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default PersonnelAddModal
