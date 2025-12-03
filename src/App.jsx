import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import QRDisplay from './pages/QRDisplay'
import PersonnelLogin from './pages/PersonnelLogin'
import CheckIn from './pages/CheckIn'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import Reports from './pages/Reports'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

function App() {
  const { user } = useAuthStore()

  return (
    <Routes>
      {/* QR Display Route - Tablet Ekranı */}
      <Route path="/qr/:locationId" element={<QRDisplay />} />
      
      {/* Check In Route - QR'dan gelen personel buraya yönlenir */}
      <Route path="/checkin" element={<CheckIn />} />
      
      {/* Personnel Login Route - Personel Telefonu */}
      <Route path="/login" element={<PersonnelLogin />} />
      
      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route element={<Layout />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/personnel" element={<AdminDashboard section="personnel" />} />
          <Route path="/admin/locations" element={<AdminDashboard section="locations" />} />
          <Route path="/admin/attendance" element={<AdminDashboard section="attendance" />} />
          <Route path="/admin/reports" element={<Reports />} />
          <Route path="/admin/settings" element={<AdminDashboard section="settings" />} />
        </Route>
      </Route>

      {/* Default Redirect */}
      <Route path="/" element={
        user ? (
          user.role === 'admin' ? 
            <Navigate to="/admin/dashboard" replace /> : 
            <Navigate to="/login" replace />
        ) : (
          <Navigate to="/admin/login" replace />
        )
      } />
    </Routes>
  )
}

export default App
