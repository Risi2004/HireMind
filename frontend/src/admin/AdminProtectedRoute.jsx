import { useLocation, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { XCircleIcon, LogoutIcon } from './AdminIcons'

export default function AdminProtectedRoute() {
  const { user, token, isAdmin, loading, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // If auth state is still resolving, show sleek loading indicator
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#070c18',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(56, 189, 248, 0.2)',
            borderTopColor: '#38bdf8',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ marginTop: '1rem', fontSize: '13px', fontWeight: 600 }}>
          Verifying Administrator Privileges...
        </p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Not signed in at all -> redirect to login with return path
  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Signed in, but NOT an admin -> show Access Denied card
  if (!isAdmin) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#070c18',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div
          style={{
            background: '#0b1222',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            borderRadius: '16px',
            padding: '2.5rem',
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.65)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(244, 63, 94, 0.12)',
              color: '#f43f5e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              border: '1px solid rgba(244, 63, 94, 0.3)',
            }}
          >
            <XCircleIcon size={30} />
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', margin: '0 0 8px' }}>
            Access Denied
          </h2>
          <p style={{ fontSize: '13.5px', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
            You are signed in as <strong style={{ color: '#f8fafc' }}>{user.email}</strong>, which does not have administrator privileges.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              style={{
                background: '#38bdf8',
                color: '#070c18',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 18px',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Return to Candidate Dashboard
            </button>

            <button
              type="button"
              onClick={() => {
                logout()
                navigate('/login')
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#94a3b8',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <LogoutIcon size={16} /> Sign In with Admin Account
            </button>
          </div>
        </div>
      </div>
    )
  }

  // User is authenticated and is an admin
  return <Outlet />
}
