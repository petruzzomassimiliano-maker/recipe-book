import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import DropboxCallback from './pages/DropboxCallback.jsx'
import Home from './pages/Home.jsx'
import NotFound from './pages/NotFound.jsx'
import AuthGuard from './components/auth/AuthGuard.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/dropbox-callback" element={<DropboxCallback />} />

        {/* Protected */}
        <Route path="/" element={<AuthGuard><Home /></AuthGuard>} />

        {/* Redirects */}
        <Route path="/home" element={<Navigate to="/" replace />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
