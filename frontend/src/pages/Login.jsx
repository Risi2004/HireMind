import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logoImg from '../assets/images/logo.png'
import logoDarkImg from '../assets/images/logo-dark.png'
import './Auth.css'

export default function Login() {
  const navigate = useNavigate()
  const { login, verify2FALogin, loading } = useAuth()

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: true,
  })

  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [needsVerificationEmail, setNeedsVerificationEmail] = useState(null)

  // 2FA State
  const [requires2FA, setRequires2FA] = useState(false)
  const [tempToken, setTempToken] = useState(null)
  const [twoFactorFrequency, setTwoFactorFrequency] = useState('always')
  const [twoFactorDigits, setTwoFactorDigits] = useState(['', '', '', '', '', ''])
  const twoFactorInputRefs = useRef([])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setNeedsVerificationEmail(null)

    if (!formData.email.trim()) {
      setError('Please enter your email address.')
      return
    }
    if (!formData.password) {
      setError('Please enter your password.')
      return
    }

    try {
      const data = await login(formData.email.trim(), formData.password, formData.rememberMe)
      if (data?.requires2FA) {
        setRequires2FA(true)
        setTempToken(data.tempToken)
        setTwoFactorFrequency(data.frequency || 'always')
        return
      }

      if (data?.user?.role === 'admin' || data?.user?.email === 'admin@gmail.com') {
        navigate('/admin/dashboard')
      } else if (data?.user?.isProfileSetupCompleted) {
        navigate('/dashboard')
      } else {
        navigate('/profile-setup')
      }
    } catch (err) {
      if (err.needsVerification) {
        setNeedsVerificationEmail(err.email || formData.email.trim())
        setError(err.message || 'Please verify your email before logging in.')
      } else {
        setError(err.message || 'Invalid email or password.')
      }
    }
  }

  // 2FA digit input handlers
  const handleDigitChange = (index, value) => {
    const char = value.replace(/\D/g, '').slice(-1)
    const newDigits = [...twoFactorDigits]
    newDigits[index] = char
    setTwoFactorDigits(newDigits)
    if (char && index < 5) {
      twoFactorInputRefs.current[index + 1]?.focus()
    }
  }

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !twoFactorDigits[index] && index > 0) {
      twoFactorInputRefs.current[index - 1]?.focus()
    }
  }

  const handleDigitPaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const newDigits = [...twoFactorDigits]
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || ''
    }
    setTwoFactorDigits(newDigits)
    const nextIdx = Math.min(pasted.length, 5)
    twoFactorInputRefs.current[nextIdx]?.focus()
  }

  const handleVerify2FASubmit = async (e) => {
    e.preventDefault()
    setError('')
    const code = twoFactorDigits.join('')
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code from your authenticator app.')
      return
    }

    try {
      const data = await verify2FALogin(tempToken, code)
      if (data?.user?.role === 'admin' || data?.user?.email === 'admin@gmail.com') {
        navigate('/admin/dashboard')
      } else if (data?.user?.isProfileSetupCompleted) {
        navigate('/dashboard')
      } else {
        navigate('/profile-setup')
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired authenticator code. Please try again.')
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
              MASTER YOUR
              <br />
              NEXT INTERVIEW.
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
              Don&apos;t have an account?
              <span className="auth-switch-link" onClick={() => navigate('/signup')}>
                Sign Up
              </span>
            </p>
          </div>
        </div>

        {/* Right Side: Subtitle & Form Card */}
        <div className="auth-right">
          <p className="auth-right-subtitle">
            Access Your Personalized Insights, Review Past Performances, And Continue Refining Your
            Pitch With AI-Driven Feedback.
          </p>

          <div className="auth-card">
            {requires2FA ? (
              <div className="auth-mfa-view">
                <div className="otp-card-header">
                  <div className="auth-mfa-shield-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                  </div>
                  <h2 className="auth-card-title">Two-Factor Authentication</h2>
                  <p className="auth-card-desc">
                    Enter the 6-digit verification code from your authenticator app (Google Authenticator, Microsoft Authenticator, Apple Passwords).
                  </p>
                  <div className="otp-email-badge">{formData.email}</div>
                  {twoFactorFrequency === 'every_two_weeks' && (
                    <div className="auth-mfa-device-hint">
                      ✨ Signing in will remember this device for the next 14 days.
                    </div>
                  )}
                </div>

                <form onSubmit={handleVerify2FASubmit}>
                  {error && <div className="auth-alert-error">{error}</div>}

                  <div className="otp-input-container" onPaste={handleDigitPaste}>
                    {twoFactorDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (twoFactorInputRefs.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        className="otp-digit-input"
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>

                  <div className="otp-actions-row">
                    <button
                      type="button"
                      className="otp-back-btn"
                      onClick={() => {
                        setRequires2FA(false)
                        setTempToken(null)
                        setError('')
                      }}
                    >
                      ← Back to Login
                    </button>
                  </div>

                  <button type="submit" className="auth-submit-btn" disabled={loading}>
                    {loading ? 'Verifying Code...' : (
                      <>Verify & Sign In <span className="auth-btn-arrow">→</span></>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <>
                <div className="auth-card-header">
                  <h2 className="auth-card-title">Welcome Back</h2>
                  <p className="auth-card-desc">
                    Sign in to continue your preparation.
                  </p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                  {error && <div className="auth-alert-error">{error}</div>}

                  {needsVerificationEmail && (
                    <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                      <button
                        type="button"
                        className="otp-resend-btn"
                        onClick={() => navigate('/signup')}
                      >
                        Go to Verification &rarr;
                      </button>
                    </div>
                  )}

                  <div className="auth-form-group">
                    <label className="auth-label" htmlFor="email">Email Address</label>
                    <input
                      id="email"
                      type="email"
                      className="auth-input"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="auth-form-group">
                    <label className="auth-label" htmlFor="password">Password</label>
                    <div className="auth-input-password-wrap">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        className="auth-input"
                        placeholder="Enter password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                      />
                      <button
                        type="button"
                        className="auth-password-toggle-btn"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
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

                  <div className="auth-options-row">
                    <label className="auth-checkbox-wrap">
                      <input
                        type="checkbox"
                        checked={formData.rememberMe}
                        onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                      />
                      <span>Remember me for 30 days</span>
                    </label>

                    <span
                      className="auth-forgot-link"
                      onClick={() => navigate('/forgot-password')}
                    >
                      Forgot Password?
                    </span>
                  </div>

                  <button type="submit" className="auth-submit-btn" disabled={loading}>
                    {loading ? 'Signing In...' : (
                      <>Login Account <span className="auth-btn-arrow">→</span></>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
