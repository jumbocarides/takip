import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, Download, FileSpreadsheet, Loader, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

const PersonnelExcelModal = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)

  // Excel şablonunu indir
  const downloadTemplate = () => {
    const template = [
      {
        personnel_no: 'P001',
        name: 'Ahmet',
        surname: 'Yılmaz',
        email: 'ahmet@example.com',
        phone: '0555 123 45 67',
        position: 'Garson',
        department: 'Servis',
        location_code: 'kadikoy',
        monthly_salary: 17000,
        monthly_leave_days: 4,
        shift_start_time: '09:00',
        shift_end_time: '18:00',
        password: '123456'
      },
      {
        personnel_no: 'P002',
        name: 'Ayşe',
        surname: 'Kaya',
        email: 'ayse@example.com',
        phone: '0555 987 65 43',
        position: 'Aşçı',
        department: 'Mutfak',
        location_code: 'besiktas',
        monthly_salary: 18000,
        monthly_leave_days: 4,
        shift_start_time: '08:00',
        shift_end_time: '17:00',
        password: '123456'
      }
    ]

    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Personel Şablonu')
    
    // Kolon genişliklerini ayarla
    ws['!cols'] = [
      { wch: 12 }, // personnel_no
      { wch: 15 }, // name
      { wch: 15 }, // surname
      { wch: 25 }, // email
      { wch: 15 }, // phone
      { wch: 12 }, // position
      { wch: 12 }, // department
      { wch: 12 }, // location_code
      { wch: 15 }, // monthly_salary
      { wch: 18 }, // monthly_leave_days
      { wch: 15 }, // shift_start_time
      { wch: 15 }, // shift_end_time
      { wch: 10 }  // password
    ]

    XLSX.writeFile(wb, 'personel_sablonu.xlsx')
    toast.success('Excel şablonu indirildi!')
  }

  // Excel dosyasını yükle ve parse et
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setLoading(true)
    setUploadResult(null)

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      if (jsonData.length === 0) {
        toast.error('Excel dosyası boş!')
        setLoading(false)
        return
      }

      // Backend'e gönder
      const response = await fetch('/.netlify/functions/personnel-import-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personnelData: jsonData })
      })

      const result = await response.json()

      if (result.success) {
        setUploadResult(result.results)
        toast.success(result.message)
        if (result.results.success > 0) {
          setTimeout(() => {
            onSuccess()
            onClose()
          }, 2000)
        }
      } else {
        toast.error(result.error || 'Import başarısız')
      }
    } catch (error) {
      console.error('Excel upload error:', error)
      toast.error('Dosya yüklenirken hata oluştu')
    } finally {
      setLoading(false)
    }
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
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <FileSpreadsheet className="w-6 h-6 text-green-600" />
                Excel ile Personel Yönetimi
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Adım 1: Şablon İndir */}
              <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
                <h3 className="font-semibold text-lg mb-3 text-blue-900 flex items-center gap-2">
                  <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                  Excel Şablonunu İndir
                </h3>
                <p className="text-gray-700 mb-4">
                  Önce şablonu indirin, bilgileri doldurun ve kaydedin.
                </p>
                <button
                  onClick={downloadTemplate}
                  className="btn-primary flex items-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Şablon İndir (.xlsx)
                </button>
              </div>

              {/* Adım 2: Doldurulmuş Excel'i Yükle */}
              <div className="bg-green-50 rounded-xl p-6 border-2 border-green-200">
                <h3 className="font-semibold text-lg mb-3 text-green-900 flex items-center gap-2">
                  <span className="bg-green-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                  Doldurulmuş Excel'i Yükle
                </h3>
                <p className="text-gray-700 mb-4">
                  Doldurduğunuz Excel dosyasını yükleyin. Sistem otomatik olarak ekleyecek veya güncelleyecek.
                </p>
                
                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    disabled={loading}
                    className="hidden"
                    id="excel-upload"
                  />
                  <label
                    htmlFor="excel-upload"
                    className={`btn-success flex items-center gap-2 justify-center cursor-pointer ${
                      loading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Yükleniyor...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        Excel Dosyası Seç
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Sonuçlar */}
              {uploadResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-50 rounded-xl p-6"
                >
                  <h3 className="font-semibold text-lg mb-4">İşlem Sonuçları</h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-green-100 rounded-lg p-4 text-center">
                      <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-green-700">{uploadResult.success}</p>
                      <p className="text-sm text-green-600">Başarılı</p>
                    </div>
                    <div className="bg-red-100 rounded-lg p-4 text-center">
                      <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-red-700">{uploadResult.failed}</p>
                      <p className="text-sm text-red-600">Başarısız</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-blue-100 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-blue-700">{uploadResult.created}</p>
                      <p className="text-xs text-blue-600">Yeni Eklenen</p>
                    </div>
                    <div className="bg-yellow-100 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-yellow-700">{uploadResult.updated}</p>
                      <p className="text-xs text-yellow-600">Güncellenen</p>
                    </div>
                  </div>

                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className="bg-red-50 rounded-lg p-4">
                      <h4 className="font-semibold text-red-900 mb-2">Hatalar:</h4>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {uploadResult.errors.map((err, idx) => (
                          <div key={idx} className="text-sm text-red-700">
                            • {err.personnel_no}: {err.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Bilgilendirme */}
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <h4 className="font-semibold text-yellow-900 mb-2">ℹ️ Önemli Notlar:</h4>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>• <strong>personnel_no</strong> aynı olan kayıtlar güncellenir</li>
                  <li>• <strong>location_code</strong>: kadikoy, besiktas, cengelkoy gibi</li>
                  <li>• <strong>position</strong>: Garson, Aşçı, Kasa, Müdür vb.</li>
                  <li>• <strong>department</strong>: Servis, Mutfak, Muhasebe, Yönetim</li>
                  <li>• <strong>shift_start_time</strong>: 09:00 formatında (saat:dakika)</li>
                  <li>• <strong>shift_end_time</strong>: 18:00 formatında (saat:dakika)</li>
                  <li>• <strong>password</strong> boş bırakılırsa varsayılan: 123456</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t bg-gray-50">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
                disabled={loading}
              >
                Kapat
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default PersonnelExcelModal
