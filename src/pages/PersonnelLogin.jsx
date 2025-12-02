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
  const [scanning, setScanning] = useState(false)
  const [manualLogin, setManualLogin] = useState(false)
  const [personnelId, setPersonnelId] = useState('')
  const [password, setPassword] = useState('')
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

    // Önce login olmuş mu kontrol et
    const storedPersonnelId = sessionStorage.getItem('personnelId')
    if (!storedPersonnelId) {
      toast.error('Önce giriş yapmalısınız!')
      setScanning(false)
      setManualLogin(true)
      return
    }

    try {
      setLoading(true)
      const qrData = JSON.parse(scanResult[0].rawValue)
      
      // Check if QR code is expired
      if (qrData.expiresAt < Date.now()) {
        toast.error('QR kod süresi dolmuş, lütfen yenilenmesini bekleyin')
        setLoading(false)
        return
      }

      // Process check-in/out with REAL DATABASE
      const response = await fetch('/.netlify/functions/db-attendance-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrCode: qrData.code,
          locationId: qrData.locationId,
          personnelId: storedPersonnelId,
        })
      })

      const result = await response.json()
      
      if (result.success) {
        const actionType = result.action === 'check-in' ? 'Giriş' : 'Çıkış'
        const personnelName = result.personnel?.name || ''
        
        toast.success(`${actionType} başarılı! ${personnelName}`, { duration: 4000 })
        
        setLastAction({
          type: result.action,
          time: new Date().toISOString(),
          location: qrData.locationId,
          personnelName: personnelName,
          workHours: result.attendance?.work_hours
        })
        
        setScanning(false)
        
        // 3 saniye sonra ekranı temizle
        setTimeout(() => {
          setLastAction(null)
        }, 10000)
      } else {
        toast.error(result.error || 'İşlem başarısız')
      }
    } catch (error) {
      console.error('QR okuma hatası:', error)
      toast.error('QR kod okunamadı: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleManualSubmit = async (e) => {
    e.preventDefault()
    
    if (!personnelId || !password) {
      toast.error('Lütfen tüm alanları doldurun')
      return
    }

    setLoading(true)
    
    try {
      // REAL DATABASE LOGIN
      const response = await fetch('/.netlify/functions/db-auth-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: personnelId, // personnelNo olarak kullanılacak
          password: password,
          role: 'personnel'
        })
      })

      const result = await response.json()
      
      if (result.success && result.user) {
        toast.success(`Hoş geldiniz ${result.user.name}!`)
        
        // Store personnel session
        sessionStorage.setItem('personnelId', result.user.id)
        sessionStorage.setItem('personnelNo', result.user.personnel_no)
        sessionStorage.setItem('personnelName', result.user.name)
        
        setManualLogin(false)
        setScanning(true)
        setPersonnelId('')
        setPassword('')
      } else {
        toast.error('Personel no veya şifre hatalı')
      }
    } catch (error) {
      console.error('Login error:', error)
      toast.error('Giriş yapılamadı: ' + error.message)
    } finally {
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
            {/* Toggle Buttons */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => {
                  setScanning(!scanning)
                  setManualLogin(false)
                }}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  scanning 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {scanning ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                QR Kod Okut
              </button>
              
              <button
                onClick={() => {
                  setManualLogin(!manualLogin)
                  setScanning(false)
                }}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  manualLogin 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <LogIn className="w-5 h-5" />
                Manuel Giriş
              </button>
            </div>

            {/* QR Scanner */}
            {scanning && (
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
                <p className="text-center text-sm text-gray-600 mt-3">
                  QR kodu kameraya gösterin
                </p>
              </motion.div>
            )}

            {/* Manual Login Form */}
            {manualLogin && (
              <motion.form 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleManualSubmit}
                className="space-y-4"
              >
                <div>
                  <label className="label">Personel No</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={personnelId}
                      onChange={(e) => setPersonnelId(e.target.value)}
                      className="input-field pl-10"
                      placeholder="Personel numaranız"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Şifre</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-field pl-10"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full"
                >
                  {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                </button>
              </motion.form>
            )}

            {/* Instructions */}
            {!scanning && !manualLogin && (
              <div className="bg-gray-50 rounded-lg p-6 text-center">
                <p className="text-gray-600">
                  Giriş veya çıkış yapmak için yukarıdaki seçeneklerden birini kullanın
                </p>
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
