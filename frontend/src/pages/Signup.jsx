import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logoImg from '../assets/images/logo.png'
import logoDarkImg from '../assets/images/logo-dark.png'
import './Auth.css'

export default function Signup() {
  const navigate = useNavigate()
  const { register, verifyOtp, resendOtp, loading } = useAuth()

  // Steps: 'form' | 'otp'
  const [step, setStep] = useState('form')

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: true,
  })

  // Avatar Upload State
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const fileInputRef = useRef(null)

  // OTP State
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [resendCooldown, setResendCooldown] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const otpInputRefs = useRef([])

  // Feedback State
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Handle avatar selection
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, WEBP).')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Profile picture must be under 5MB.')
      return
    }

    setError('')
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleRemoveAvatar = () => {
    setAvatarFile(null)
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview)
      setAvatarPreview(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Timer countdown for OTP resend
  useEffect(() => {
    let timer
    if (step === 'otp' && resendCooldown > 0) {
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
  }, [step, resendCooldown])

  // Step 1: Handle registration submit
  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (!formData.firstName.trim()) {
      setError('Please enter your first name.')
      return
    }
    if (!formData.lastName.trim()) {
      setError('Please enter your last name.')
      return
    }
    if (!formData.email.trim()) {
      setError('Please enter your email address.')
      return
    }
    if (!formData.password) {
      setError('Please enter a password.')
      return
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!formData.agreeTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy.')
      return
    }

    try {
      const data = new FormData()
      data.append('firstName', formData.firstName.trim())
      data.append('lastName', formData.lastName.trim())
      data.append('email', formData.email.trim())
      data.append('password', formData.password)
      if (avatarFile) {
        data.append('avatar', avatarFile)
      }

      await register(data)
      setStep('otp')
      setResendCooldown(60)
      setCanResend(false)
      setSuccessMsg('Verification code sent to your email!')
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
    }
  }

  // Handle OTP input changes
  const handleOtpDigitChange = (index, value) => {
    const char = value.replace(/\D/g, '').slice(-1)
    const newDigits = [...otpDigits]
    newDigits[index] = char
    setOtpDigits(newDigits)

    // Auto-focus next input
    if (char && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return

    const newDigits = [...otpDigits]
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || ''
    }
    setOtpDigits(newDigits)
    const nextIdx = Math.min(pasted.length, 5)
    otpInputRefs.current[nextIdx]?.focus()
  }

  // Step 2: Handle OTP verification submit
  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    const fullOtp = otpDigits.join('')
    if (fullOtp.length !== 6) {
      setError('Please enter the complete 6-digit verification code.')
      return
    }

    try {
      await verifyOtp(formData.email.trim(), fullOtp)
      setSuccessMsg('Account verified successfully! Redirecting to profile setup...')
      setTimeout(() => {
        navigate('/profile-setup')
      }, 1000)
    } catch (err) {
      setError(err.message || 'Invalid or expired verification code.')
    }
  }

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (!canResend) return
    setError('')
    setSuccessMsg('')
    try {
      await resendOtp(formData.email.trim())
      setResendCooldown(60)
      setCanResend(false)
      setSuccessMsg('A new verification code has been dispatched to your email.')
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
              YOUR NEXT
              <br />
              OPPORTUNITY
              <br />
              STARTS HERE.
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
              Already have an account?
              <span className="auth-switch-link" onClick={() => navigate('/login')}>
                Sign In
              </span>
            </p>
          </div>
        </div>

        {/* Right Side: Subtitle & Form Card */}
        <div className="auth-right">
          <p className="auth-right-subtitle">
            Practice Personalized Interviews, Understand Your Strengths, Improve Your Weaknesses,
            And Walk Into Your Next Interview With Confidence.
          </p>

          <div className="auth-card">
            {step === 'form' ? (
              <>
                <div className="auth-card-header">
                  <h2 className="auth-card-title">Start Your Journey</h2>
                  <p className="auth-card-desc">
                    Create your account and take the first step toward becoming interview-ready.
                  </p>
                </div>

                <form className="auth-form" onSubmit={handleRegisterSubmit}>
                  {error && <div className="auth-alert-error">{error}</div>}
                  {successMsg && <div className="auth-alert-success">{successMsg}</div>}

                  {/* Profile Picture Upload Section (Cloudflare R2) */}
                  <div className="auth-avatar-upload">
                    <div className="auth-avatar-preview">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar Preview" className="auth-avatar-img" />
                      ) : (
                        <div className="auth-avatar-placeholder">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="auth-avatar-actions">
                      <span className="auth-avatar-label">Profile Picture</span>
                      <span className="auth-avatar-hint">Optional • Stored securely on Cloudflare</span>
                      <div className="auth-avatar-btns">
                        <button
                          type="button"
                          className="auth-avatar-btn"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {avatarFile ? 'Change Photo' : 'Upload Photo'}
                        </button>
                        {avatarFile && (
                          <button
                            type="button"
                            className="auth-avatar-btn auth-avatar-btn--remove"
                            onClick={handleRemoveAvatar}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleAvatarChange}
                      />
                    </div>
                  </div>

                  <div className="auth-form-row">
                    <div className="auth-form-group">
                      <label className="auth-label" htmlFor="firstName">First Name</label>
                      <input
                        id="firstName"
                        type="text"
                        className="auth-input"
                        placeholder="First name"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        required
                      />
                    </div>

                    <div className="auth-form-group">
                      <label className="auth-label" htmlFor="lastName">Last Name</label>
                      <input
                        id="lastName"
                        type="text"
                        className="auth-input"
                        placeholder="Last name"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        required
                      />
                    </div>
                  </div>

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

                  <div className="auth-form-row">
                    <div className="auth-form-group">
                      <label className="auth-label" htmlFor="password">Password</label>
                      <input
                        id="password"
                        type="password"
                        className="auth-input"
                        placeholder="Create password (6+ chars)"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                      />
                    </div>

                    <div className="auth-form-group">
                      <label className="auth-label" htmlFor="confirmPassword">Confirm</label>
                      <input
                        id="confirmPassword"
                        type="password"
                        className="auth-input"
                        placeholder="Confirm password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <label className="auth-checkbox-wrap">
                    <input
                      type="checkbox"
                      checked={formData.agreeTerms}
                      onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
                    />
                    <span>I agree to the Terms of Service and Privacy Policy</span>
                  </label>

                  <button type="submit" className="auth-submit-btn" disabled={loading}>
                    {loading ? 'Creating Account...' : (
                      <>Create Account <span className="auth-btn-arrow">→</span></>
                    )}
                  </button>
                </form>
              </>
            ) : (
              /* OTP VERIFICATION STEP */
              <div className="auth-otp-view">
                <div className="otp-card-header">
                  <div className="otp-icon-wrap">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <polyline points="3 7 12 13 21 7" />
                    </svg>
                  </div>
                  <h2 className="auth-card-title">Verify Your Email</h2>
                  <p className="auth-card-desc">
                    We&apos;ve sent a 6-digit verification code to
                  </p>
                  <div className="otp-email-badge">{formData.email}</div>
                </div>

                <form onSubmit={handleVerifyOtpSubmit}>
                  {error && <div className="auth-alert-error">{error}</div>}
                  {successMsg && <div className="auth-alert-success">{successMsg}</div>}

                  <div className="otp-input-container" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (otpInputRefs.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        className="otp-digit-input"
                        value={digit}
                        onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>

                  <div className="otp-actions-row">
                    <button
                      type="button"
                      className="otp-back-btn"
                      onClick={() => {
                        setStep('form')
                        setError('')
                        setSuccessMsg('')
                      }}
                    >
                      ← Edit details
                    </button>

                    <button
                      type="button"
                      className="otp-resend-btn"
                      onClick={handleResendOtp}
                      disabled={!canResend}
                    >
                      {canResend ? 'Resend Code' : `Resend in ${resendCooldown}s`}
                    </button>
                  </div>

                  <button type="submit" className="auth-submit-btn" disabled={loading}>
                    {loading ? 'Verifying...' : (
                      <>Verify & Activate Account <span className="auth-btn-arrow">→</span></>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
