import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, Loader, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'

const LocationAddModal = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    location_code: '',
    address: '',
    phone: '',
    city: '',
    district: ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/.netlify/functions/location-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Lokasyon eklendi!')
        onSuccess()
        onClose()
        // Form temizle
        setFormData({
          name: '',
          location_code: '',
          address: '',
          phone: '',
          city: '',
          district: ''
        })
      } else {
        toast.error(result.error || 'Bir hata oluştu')
      }
    } catch (error) {
      console.error('Add location error:', error)
      toast.error('Lokasyon eklenemedi')
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
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-green-600 to-green-700 text-white rounded-t-xl">
              <div className="flex items-center gap-3">
                <MapPin className="w-6 h-6" />
                <h2 className="text-2xl font-bold">Yeni Lokasyon Ekle</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Restoran Adı */}
                  <div>
                    <label className="label">Restoran Adı *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="input-field"
                      placeholder="Örn: Çengelköy Şubesi"
                      required
                    />
                  </div>

                  {/* Lokasyon Kodu */}
                  <div>
                    <label className="label">Lokasyon Kodu *</label>
                    <input
                      type="text"
                      name="location_code"
                      value={formData.location_code}
                      onChange={handleChange}
                      className="input-field"
                      placeholder="Örn: cengelkoy"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      QR kod URL'inde kullanılacak (küçük harf, tire ile)
                    </p>
                  </div>

                  {/* Şehir */}
                  <div>
                    <label className="label">Şehir</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className="input-field"
                      placeholder="İstanbul"
                    />
                  </div>

                  {/* İlçe */}
                  <div>
                    <label className="label">İlçe</label>
                    <input
                      type="text"
                      name="district"
                      value={formData.district}
                      onChange={handleChange}
                      className="input-field"
                      placeholder="Üsküdar"
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
                      placeholder="0212 XXX XX XX"
                    />
                  </div>

                  {/* Adres */}
                  <div className="md:col-span-2">
                    <label className="label">Adres</label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      className="input-field"
                      rows="2"
                      placeholder="Tam adres"
                    />
                  </div>
                </div>

                {/* Bilgilendirme */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <strong>Not:</strong> Lokasyon eklendikten sonra:
                  </p>
                  <ul className="text-sm text-blue-800 mt-2 space-y-1 ml-4">
                    <li>• QR kod otomatik oluşturulur</li>
                    <li>• Tablet ekranından QR gösterebilirsiniz</li>
                    <li>• Personelleri bu lokasyona atayabilirsiniz</li>
                  </ul>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-6 border-t mt-6">
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
                  className="btn-primary flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Ekleniyor...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Lokasyon Ekle
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

export default LocationAddModal
