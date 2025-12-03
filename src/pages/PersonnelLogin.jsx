import { useState, useEffect } from 'react'
import { QrScanner } from '@yudiel/react-qr-scanner'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Camera, CameraOff, LogIn, User, Key, CheckCircle, XCircle, Clock, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

const PersonnelLogin = () => {
  const navigate = useNavigate()
  const [scanning, setScanning] = useState(true) // Direkt açık başlasın
  const [loading, setLoading] = useState(false)
  const [lastAction, setLastAction] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleScan = async (scanResult) => {
    if (!scanResult || !scanResult[0]?.rawValue) return
    if (loading) return // Çift okumayı önle

    try {
      setLoading(true)
      const qrData = JSON.parse(scanResult[0].rawValue)
      
      // Check if QR code is expired
      if (qrData.expiresAt < Date.now()) {
        toast.error('QR kod süresi dolmuş, lütfen yenilenmesini bekleyin')
        setLoading(false)
        return
      }

      // QR okutuldu - kameradan personnel_id çıkaracağız (QR'da olacak)
      // Veya QR'da sadece location var, backend personnel'i algılayacak
      
      // Process check-in/out with REAL DATABASE
      const response = await fetch('/.netlify/functions/db-attendance-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrCode: qrData.code,
          locationId: qrData.locationId,
          personnelId: qrData.personnelId || 'auto', // QR'dan gelecek veya auto-detect
        })
      })

      const result = await response.json()
      
      if (result.success) {
        const actionType = result.action === 'check-in' ? 'Giriş' : 'Çıkış'
        const personnelName = result.personnel?.name || ''
        
        toast.success(`${actionType} başarılı! ${personnelName}`, { duration: 4000 })
        
        // Eğer erken çıkış uyarısı varsa göster
        if (result.warning) {
          setTimeout(() => {
            toast.error(result.warning, {
              duration: 6000,
              style: {
                background: '#FEF3C7',
                color: '#92400E',
                fontWeight: 'bold'
              }
            })
          }, 500)
        }
        
        setLastAction({
          type: result.action,
          time: new Date().toISOString(),
          location: qrData.locationId,
          personnelName: personnelName,
          workHours: result.attendance?.work_hours
        })
        
        // 5 saniye bekle, sonra tekrar QR okumaya hazır ol
        setTimeout(() => {
          setLastAction(null)
          setLoading(false)
        }, 5000)
      } else {
        toast.error(result.error || 'İşlem başarısız')
        setLoading(false)
      }
    } catch (error) {
      console.error('QR okuma hatası:', error)
      toast.error('QR kod okunamadı: ' + error.message)
      setLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Personel Giriş/Çıkış
          </h1>
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>{format(currentTime, 'd MMMM yyyy', { locale: tr })}</span>
            <Clock className="w-4 h-4 ml-2" />
            <span>{format(currentTime, 'HH:mm:ss')}</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Last Action Status */}
          {lastAction && (
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              className={`px-6 py-4 ${
                lastAction.type === 'check-in' 
                  ? 'bg-green-50 border-b-2 border-green-200' 
                  : 'bg-blue-50 border-b-2 border-blue-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {lastAction.type === 'check-in' ? (
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  ) : (
                    <CheckCircle className="w-8 h-8 text-blue-600" />
                  )}
                  <div>
                    <p className="font-bold text-lg text-gray-800">
                      {lastAction.type === 'check-in' ? '✓ Giriş Yapıldı' : '✓ Çıkış Yapıldı'}
                    </p>
                    <p className="text-sm text-gray-700 font-medium">
                      {lastAction.personnelName}
                    </p>
                    <p className="text-sm text-gray-600">
                      {format(new Date(lastAction.time), 'HH:mm:ss')} - {lastAction.location}
                    </p>
                    {lastAction.type === 'check-out' && lastAction.workHours && (
                      <p className="text-sm font-semibold text-green-700 mt-1">
                        Çalışma Süresi: {lastAction.workHours.toFixed(1)} saat
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div className="p-6">
            {/* QR Scanner - Sürekli Açık */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6"
            >
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <QrScanner
                  onDecode={handleScan}
                  onError={(error) => console.log(error?.message)}
                  containerStyle={{ width: '100%' }}
                  videoStyle={{ width: '100%' }}
                />
              </div>
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-center text-sm text-blue-900 font-medium">
                  📱 QR kodu tablet ekranından okutun
                </p>
                <p className="text-center text-xs text-blue-700 mt-1">
                  İlk okutma: Giriş • İkinci okutma: Çıkış
                </p>
              </div>
            </motion.div>

            {/* Loading State */}
            {loading && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <p className="text-yellow-800 font-medium">⏳ İşleniyor...</p>
              </div>
            )}
          </div>
        </div>

        {/* Admin Link */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/admin/login')}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            Yönetici Girişi →
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default PersonnelLogin
