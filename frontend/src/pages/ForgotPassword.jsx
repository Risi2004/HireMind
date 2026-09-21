import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logoImg from '../assets/images/logo.png'
import logoDarkImg from '../assets/images/logo-dark.png'
import './Auth.css'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const { forgotPassword, resetPassword, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)
  const [isResetComplete, setIsResetComplete] = useState(false)
  const [error, setError] = useState('')
  const [resendNotice, setResendNotice] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(60)
  const [canResend, setCanResend] = useState(false)

  // Resend cooldown timer
  useEffect(() => {
    let timer
    if (submitted && !isResetComplete && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            setCanResend(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [submitted, isResetComplete, resendCooldown])

  const handleSendCode = async (e) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.')
      return
    }

    try {
      await forgotPassword(email.trim())
      setSubmitted(true)
      setResendCooldown(60)
      setCanResend(false)
    } catch (err) {
      setError(err.message || 'Failed to send verification code.')
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')

    if (!verificationCode.trim()) {
      setError('Please enter the 6-digit verification code.')
      return
    }
    if (!newPassword) {
      setError('Please enter a new password.')
      return
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      await resetPassword(email.trim(), verificationCode.trim(), newPassword)
      setIsResetComplete(true)
    } catch (err) {
      setError(err.message || 'Failed to reset password.')
    }
  }

  const handleResend = async () => {
    if (!canResend) return
    setError('')
    try {
      await forgotPassword(email.trim())
      setResendCooldown(60)
      setCanResend(false)
      setResendNotice(true)
      setTimeout(() => setResendNotice(false), 4000)
    } catch (err) {
      setError(err.message || 'Failed to resend code.')
    }
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
              onClick={() => navigate('/profile-setup')}
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
                    Enter the email linked to your HireMind account and we&apos;ll send you a 6-digit verification code.
                  </p>
                </div>

                <form className="auth-form" onSubmit={handleSendCode}>
                  {error && <div className="auth-alert-error">{error}</div>}

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

                  <button type="submit" className="auth-submit-btn" disabled={loading}>
                    {loading ? 'Sending Code...' : (
                      <>Send Verification Code <span className="auth-btn-arrow">→</span></>
                    )}
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
                  {error && <div className="auth-alert-error">{error}</div>}

                  {resendNotice && (
                    <div className="auth-alert-success">
                      A new verification code has been dispatched to your email.
                    </div>
                  )}

                  <div className="auth-form-group">
                    <label className="auth-label" htmlFor="verificationCode">Verification Code</label>
                    <input
                      id="verificationCode"
                      type="text"
                      inputMode="numeric"
                      className="auth-input auth-code-input"
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => {
                        setVerificationCode(e.target.value.replace(/\D/g, ''))
                        if (error) setError('')
                      }}
                      required
                    />
                  </div>


                  <div className="auth-form-group">
                    <label className="auth-label" htmlFor="newPassword">New Password</label>
                    <div className="auth-input-password-wrap">
                      <input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        className="auth-input"
                        placeholder="Enter new password (6+ chars)"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value)
                          if (error) setError('')
                        }}
                        required
                      />
                      <button
                        type="button"
                        className="auth-password-toggle-btn"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                        title={showNewPassword ? 'Hide password' : 'Show password'}
                      >
                        {showNewPassword ? (
                          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="auth-form-group">
                    <label className="auth-label" htmlFor="confirmNewPassword">Confirm New Password</label>
                    <div className="auth-input-password-wrap">
                      <input
                        id="confirmNewPassword"
                        type={showConfirmNewPassword ? 'text' : 'password'}
                        className="auth-input"
                        placeholder="Confirm new password"
                        value={confirmNewPassword}
                        onChange={(e) => {
                          setConfirmNewPassword(e.target.value)
                          if (error) setError('')
                        }}
                        required
                      />
                      <button
                        type="button"
                        className="auth-password-toggle-btn"
                        onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                        aria-label={showConfirmNewPassword ? 'Hide password' : 'Show password'}
                        title={showConfirmNewPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmNewPassword ? (
                          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>


                  <button type="submit" className="auth-submit-btn" disabled={loading}>
                    {loading ? 'Updating Password...' : (
                      <>Update Password <span className="auth-btn-arrow">→</span></>
                    )}
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      className="otp-resend-btn"
                      onClick={handleResend}
                      disabled={!canResend || loading}
                    >
                      {canResend ? 'Resend Code' : `Resend in ${resendCooldown}s`}
                    </button>
                    <button
                      type="button"
                      className="otp-back-btn"
                      onClick={() => {
                        setSubmitted(false)
                        setError('')
                      }}
                    >
                      Change Email
                    </button>
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
