import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logoImg from '../assets/images/logo.png'
import logoDarkImg from '../assets/images/logo-dark.png'
import './Auth.css'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [isResetComplete, setIsResetComplete] = useState(false)
  const [error, setError] = useState('')
  const [resendNotice, setResendNotice] = useState(false)

  const handleSendCode = (e) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.')
      return
    }

    setError('')
    setSubmitted(true)
  }

  const handleResetPassword = (e) => {
    e.preventDefault()
    if (!verificationCode.trim()) {
      setError('Please enter the 6-digit verification code.')
      return
    }
    if (!newPassword) {
      setError('Please enter a new password.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.')
      return
    }

    setError('')
    setIsResetComplete(true)
  }

  const handleResend = () => {
    setResendNotice(true)
    setTimeout(() => setResendNotice(false), 3000)
  }

  const handleGoogleAuth = () => {
    navigate('/profile-setup')
  }

  return (
    <div className="auth-page">
      {/* Background Split Graphics */}
      <div className="auth-bg-split" aria-hidden="true">
        <div className="auth-bg-right" />
        <div className="auth-bg-left" />
      </div>

      <div className="auth-container">
        {/* Left Side: Brand, Angled 3D Typography, Social Login */}
        <div className="auth-left">
          <div className="auth-brand" onClick={() => navigate('/')} title="Back to HireMind Home">
            <img src={logoImg} alt="HireMind" className="auth-logo auth-logo--light-bg" />
            <img src={logoDarkImg} alt="HireMind" className="auth-logo auth-logo--dark-bg" />
          </div>

          <div className="auth-typo-container">
            <h1 className="auth-typo-title">
              RESET. REFOCUS.
              <br />
              GET BACK IN.
            </h1>
          </div>

          <div className="auth-left-bottom">
            <div className="auth-divider">
              <span>OR CONTINUE WITH</span>
            </div>

            <button
              type="button"
              className="auth-google-btn"
              onClick={handleGoogleAuth}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z" />
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15Z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" />
              </svg>
              Continue with Google
            </button>

            <p className="auth-switch-text">
              Remember your password?
              <span className="auth-switch-link" onClick={() => navigate('/login')}>
                Sign In
              </span>
            </p>
          </div>
        </div>

        {/* Right Side: Subtitle & Form Card */}
        <div className="auth-right">
          <p className="auth-right-subtitle">
            A Quick Reset Is All It Takes. Get Back To Your Interview Preparation In Just A Few Steps.
          </p>

          <div className="auth-card">
            {!submitted ? (
              <>
                <div className="auth-card-header">
                  <h2 className="auth-card-title">Forgot Password?</h2>
                  <p className="auth-card-desc">
                    Enter the email linked to your HireMind account and we'll send you a verification code.
                  </p>
                </div>

                <form className="auth-form" onSubmit={handleSendCode}>
                  {error && (
                    <div style={{ color: '#f87171', fontSize: '0.84rem', textAlign: 'center' }}>
                      {error}
                    </div>
                  )}

                  <div className="auth-form-group">
                    <label className="auth-label" htmlFor="reset-email">Email Address</label>
                    <input
                      id="reset-email"
                      type="email"
                      className="auth-input"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (error) setError('')
                      }}
                      required
                    />
                  </div>

                  <button type="submit" className="auth-submit-btn">
                    Send Verification Code <span className="auth-btn-arrow">→</span>
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <span
                      className="auth-forgot-link"
                      onClick={() => navigate('/login')}
                      style={{ fontSize: '0.85rem' }}
                    >
                      ← Back to Login
                    </span>
                  </div>
                </form>
              </>
            ) : !isResetComplete ? (
              <>
                <div className="auth-card-header">
                  <h2 className="auth-card-title">Verify & Reset</h2>
                  <p className="auth-card-desc">
                    We sent a 6-digit verification code to <strong>{email}</strong>.
                  </p>
                </div>

                <form className="auth-form" onSubmit={handleResetPassword}>
                  {error && (
                    <div style={{ color: '#f87171', fontSize: '0.84rem', textAlign: 'center' }}>
                      {error}
                    </div>
                  )}

                  {resendNotice && (
                    <div style={{ color: '#38bdf8', fontSize: '0.84rem', textAlign: 'center' }}>
                      A new verification code has been dispatched to your email.
                    </div>
                  )}

                  <div className="auth-form-group">
                    <label className="auth-label" htmlFor="verificationCode">Verification Code</label>
                    <input
                      id="verificationCode"
                      type="text"
                      className="auth-input"
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => {
                        setVerificationCode(e.target.value)
                        if (error) setError('')
                      }}
                      required
                      style={{ letterSpacing: '2px', textAlign: 'center', fontWeight: '700' }}
                    />
                  </div>

                  <div className="auth-form-group">
                    <label className="auth-label" htmlFor="newPassword">New Password</label>
                    <input
                      id="newPassword"
                      type="password"
                      className="auth-input"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value)
                        if (error) setError('')
                      }}
                      required
                    />
                  </div>

                  <div className="auth-form-group">
                    <label className="auth-label" htmlFor="confirmNewPassword">Confirm New Password</label>
                    <input
                      id="confirmNewPassword"
                      type="password"
                      className="auth-input"
                      placeholder="Confirm new password"
                      value={confirmNewPassword}
                      onChange={(e) => {
                        setConfirmNewPassword(e.target.value)
                        if (error) setError('')
                      }}
                      required
                    />
                  </div>

                  <button type="submit" className="auth-submit-btn">
                    Update Password <span className="auth-btn-arrow">→</span>
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <span
                      className="auth-forgot-link"
                      onClick={handleResend}
                      style={{ fontSize: '0.82rem' }}
                    >
                      Resend Code
                    </span>
                    <span
                      className="auth-forgot-link"
                      onClick={() => setSubmitted(false)}
                      style={{ fontSize: '0.82rem' }}
                    >
                      Change Email
                    </span>
                  </div>
                </form>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    color: '#38bdf8',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 1.25rem',
                    fontSize: '1.5rem',
                  }}
                >
                  ✓
                </div>
                <h2 className="auth-card-title">Password Reset Complete!</h2>
                <p className="auth-card-desc" style={{ marginBottom: '1.75rem' }}>
                  Your password has been successfully updated. You can now sign in with your new credentials.
                </p>
                <button
                  type="button"
                  className="auth-submit-btn"
                  onClick={() => navigate('/login')}
                >
                  Sign In Now <span className="auth-btn-arrow">→</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
