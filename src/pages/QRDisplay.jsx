import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, MapPin, RefreshCw, Wifi } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

const QRDisplay = () => {
  const { locationId } = useParams()
  const [qrCode, setQrCode] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [countdown, setCountdown] = useState(90)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const canvasRef = useRef(null)

  // Location details (would come from API)
  const location = {
    id: locationId,
    name: locationId === 'cengelkoy' ? 'Çengelköy Şubesi' : 'Restoran',
    address: 'İstanbul, Türkiye'
  }

  // Generate new QR code - Contains URL to check-in page with unique token
  const generateNewQR = async () => {
    try {
      // Backend'den benzersiz token al
      const response = await fetch('/.netlify/functions/qr-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId })
      })
      
      const result = await response.json()
      
      if (result.success) {
        const checkInUrl = `https://takibonline.netlify.app/checkin?token=${result.token}`
        setQrCode(checkInUrl)
        
        // Generate QR code image
        const dataUrl = await QRCode.toDataURL(checkInUrl, {
          width: 400,
          margin: 2,
          color: {
            dark: '#0369a1',
            light: '#ffffff'
          }
        })
        setQrDataUrl(dataUrl)
      } else {
        console.error('Token oluşturulamadı:', result.error)
      }
    } catch (err) {
      console.error('QR kod oluşturulamadı:', err)
    }
    
    setCountdown(90)
  }

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Generate QR code on mount and every 90 seconds
  useEffect(() => {
    generateNewQR()
    const interval = setInterval(generateNewQR, 90000)
    return () => clearInterval(interval)
  }, [locationId])

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          return 90
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Check online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-8">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-5xl font-bold text-white mb-4">
            Personel Giriş / Çıkış
          </h1>
          <div className="flex items-center justify-center gap-6 text-white/90">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              <span className="text-xl">{location.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span className="text-xl">
                {format(currentTime, 'HH:mm:ss', { locale: tr })}
              </span>
            </div>
          </div>
        </motion.div>

        {/* QR Code Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-2xl p-8"
        >
          {/* Date Display */}
          <div className="text-center mb-6">
            <p className="text-2xl font-semibold text-gray-800">
              {format(currentTime, 'd MMMM yyyy EEEE', { locale: tr })}
            </p>
          </div>

          {/* QR Code */}
          <div className="relative flex justify-center mb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={qrCode}
                initial={{ opacity: 0, scale: 0.8, rotate: -180 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotate: 180 }}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl">
                  {qrDataUrl && (
                    <img 
                      src={qrDataUrl} 
                      alt="QR Code" 
                      className="w-80 h-80"
                    />
                  )}
                  
                  {/* Countdown Overlay */}
                  <div className="absolute -bottom-3 -right-3 bg-primary-600 text-white rounded-full w-16 h-16 flex items-center justify-center font-bold text-xl shadow-lg">
                    {countdown}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Refresh Timer Bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <RefreshCw className="w-4 h-4" />
                Otomatik Yenileme
              </span>
              <span className="text-sm text-gray-600">
                {countdown} saniye
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-primary-400 to-primary-600"
                animate={{ width: `${(countdown / 90) * 100}%` }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="font-semibold text-lg mb-3 text-gray-800">
              Kullanım Talimatları
            </h3>
            <ol className="space-y-2 text-gray-600">
              <li className="flex items-start">
                <span className="font-semibold mr-2">1.</span>
                Telefonunuzda personel uygulamasını açın
              </li>
              <li className="flex items-start">
                <span className="font-semibold mr-2">2.</span>
                QR okuyucuyu bu koda yöneltin
              </li>
              <li className="flex items-start">
                <span className="font-semibold mr-2">3.</span>
                Giriş veya çıkış işleminiz otomatik kaydedilecek
              </li>
            </ol>
          </div>

          {/* Status Indicator */}
          <div className="mt-6 flex items-center justify-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
              isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              <Wifi className="w-4 h-4" />
              <span className="text-sm font-medium">
                {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8 text-white/80"
        >
          <p className="text-sm">
            © 2024 Restoran Personel Takip Sistemi • v1.0.0
          </p>
        </motion.div>
      </div>
    </div>
  )
}

export default QRDisplay
