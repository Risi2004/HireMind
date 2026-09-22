import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logoImg from '../assets/images/logo.png'
import logoDarkImg from '../assets/images/logo-dark.png'
import logoIconBlack from '../assets/images/logo-icon.png'
import './Auth.css'

// Comprehensive Regex Patterns for Validation
export const REGEX_PATTERNS = {
  nameHasNumbers: /\d/,
  nameValid: /^[a-zA-Z\s'-]{2,50}$/,
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  imageExt: /\.(jpe?g|png)$/i,
  imageMime: /^image\/(jpeg|png)$/i,
  password: {
    minLength: /.{8,}/,
    hasUpper: /[A-Z]/,
    hasLower: /[a-z]/,
    hasNumber: /\d/,
    hasSymbol: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/,
    noSpaces: /^\S+$/,
    noRepeatedChars: /(.)\1{2,}/,
    // Horizontal, vertical, numerical, and alphabetical keyboard sequences (4+ length)
    keyboardWalks:
      /(?:qwer|wert|erty|rtyu|tyui|yuio|uiop|asdf|sdfg|dfgh|fghj|ghjk|hjkl|zxcv|xcvb|cvbn|vbnm|1234|2345|3456|4567|5678|6789|7890|abcd|bcde|cdef|defg|efgh|fghi|ghij|hijk|ijkl|jklm|klmn|lmno|mnop|nopq|opqr|pqrs|qrst|rstu|stuv|tuvw|uvwx|vwxy|wxyz|rewq|trew|ytre|iuyt|oiuy|poiu|lkjh|kjhg|jhgf|hgfd|gfed|fdsa|mnbv|nbvc|bvcx|vcxz|4321|5432|6543|7654|8765|9876|0987|dcba|edcb|fedc|gfed|hgfe|ihgf|jihg|kjih|lkji|mlkj|nmlk|onml|ponm|qpon|rqpo|srqp|tsrq|utsr|vuts|wvut|xwvu|yxwv|zyxw)/i,
  },
}

export default function Signup() {
  const navigate = useNavigate()
  const { register, verifyOtp, resendOtp, setup2FA, enable2FA, loading } = useAuth()

  // Steps: 'form' | 'otp' | 'mfa-prompt' | 'mfa-setup'
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

  // Password Visibility State
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Avatar Upload State
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const fileInputRef = useRef(null)

  // OTP State
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [resendCooldown, setResendCooldown] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const otpInputRefs = useRef([])

  // MFA Setup State
  const [mfaData, setMfaData] = useState(null) // { secret, qrCodeUrl, manualEntryKey, otpauthUrl }
  const [mfaFrequency, setMfaFrequency] = useState('every_two_weeks') // 'always' | 'every_two_weeks'
  const [mfaCodeDigits, setMfaCodeDigits] = useState(['', '', '', '', '', ''])
  const [mfaLoading, setMfaLoading] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)
  const mfaInputRefs = useRef([])

  // Feedback State
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Live password validation checks
  const passwordChecks = useMemo(() => {
    const pwd = formData.password || ''
    return {
      length: REGEX_PATTERNS.password.minLength.test(pwd),
      upper: REGEX_PATTERNS.password.hasUpper.test(pwd),
      lower: REGEX_PATTERNS.password.hasLower.test(pwd),
      number: REGEX_PATTERNS.password.hasNumber.test(pwd),
      symbol: REGEX_PATTERNS.password.hasSymbol.test(pwd),
      noSpaces: REGEX_PATTERNS.password.noSpaces.test(pwd) && pwd.length > 0,
      noRepeats: !REGEX_PATTERNS.password.noRepeatedChars.test(pwd),
      noWalks: !REGEX_PATTERNS.password.keyboardWalks.test(pwd),
    }
  }, [formData.password])

  // Password Strength Score (0 to 4)
  const passwordStrength = useMemo(() => {
    if (!formData.password) return { score: 0, label: 'None', class: '' }
    let metCount = 0
    if (passwordChecks.length) metCount++
    if (passwordChecks.upper && passwordChecks.lower) metCount++
    if (passwordChecks.number) metCount++
    if (passwordChecks.symbol) metCount++
    if (passwordChecks.noRepeats && passwordChecks.noWalks && passwordChecks.noSpaces) metCount++

    if (metCount <= 2) return { score: 1, label: 'Weak', class: 'is-weak' }
    if (metCount === 3) return { score: 2, label: 'Fair', class: 'is-fair' }
    if (metCount === 4) return { score: 3, label: 'Good', class: 'is-good' }
    return { score: 4, label: 'Strong', class: 'is-strong' }
  }, [formData.password, passwordChecks])

  // Handle avatar selection with strict regex & size limits
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file extension and MIME type using regex (JPG, JPEG, PNG only)
    const isJpgPng =
      REGEX_PATTERNS.imageExt.test(file.name) &&
      REGEX_PATTERNS.imageMime.test(file.type)

    if (!isJpgPng) {
      setError('Profile picture must be a JPG, JPEG, or PNG image under 5MB.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Size limit: strictly less than 5MB
    if (file.size > 5 * 1024 * 1024) {
      setError('Profile picture must be less than 5MB.')
      if (fileInputRef.current) fileInputRef.current.value = ''
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

  // Step 1: Handle registration submit with regex validations
  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    const cleanFirst = formData.firstName.trim()
    const cleanLast = formData.lastName.trim()
    const cleanEmail = formData.email.trim()

    // 1. First Name Validation
    if (!cleanFirst) {
      setError('Please enter your first name.')
      return
    }
    if (REGEX_PATTERNS.nameHasNumbers.test(cleanFirst)) {
      setError('First name cannot contain numbers.')
      return
    }
    if (!REGEX_PATTERNS.nameValid.test(cleanFirst)) {
      setError('First name must contain only letters (at least 2 characters).')
      return
    }

    // 2. Last Name Validation
    if (!cleanLast) {
      setError('Please enter your last name.')
      return
    }
    if (REGEX_PATTERNS.nameHasNumbers.test(cleanLast)) {
      setError('Last name cannot contain numbers.')
      return
    }
    if (!REGEX_PATTERNS.nameValid.test(cleanLast)) {
      setError('Last name must contain only letters (at least 2 characters).')
      return
    }

    // 3. Email Format Validation
    if (!cleanEmail) {
      setError('Please enter your email address.')
      return
    }
    if (!REGEX_PATTERNS.email.test(cleanEmail)) {
      setError('Please enter a valid email address (e.g. name@domain.com).')
      return
    }

    // 4. Password Rules Validation
    if (!formData.password) {
      setError('Please enter a password.')
      return
    }
    if (!passwordChecks.length) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (!passwordChecks.upper) {
      setError('Password must contain at least one uppercase letter (A-Z).')
      return
    }
    if (!passwordChecks.lower) {
      setError('Password must contain at least one lowercase letter (a-z).')
      return
    }
    if (!passwordChecks.number) {
      setError('Password must contain at least one number (0-9).')
      return
    }
    if (!passwordChecks.symbol) {
      setError('Password must contain at least one symbol (!@#$%^&*).')
      return
    }
    if (!passwordChecks.noSpaces) {
      setError('Password cannot contain spaces.')
      return
    }
    if (!passwordChecks.noRepeats) {
      setError('Password cannot contain 3 or more repeated characters in a row (e.g. "aaa", "111").')
      return
    }
    if (!passwordChecks.noWalks) {
      setError('Password cannot contain keyboard walks or sequential patterns (e.g. "qwerty", "1234", "abcd").')
      return
    }

    // 5. Confirm Password Match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    // 6. Terms of Service
    if (!formData.agreeTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy.')
      return
    }

    // 7. Avatar (if chosen)
    if (avatarFile) {
      const isJpgPng =
        REGEX_PATTERNS.imageExt.test(avatarFile.name) &&
        REGEX_PATTERNS.imageMime.test(avatarFile.type)
      if (!isJpgPng) {
        setError('Profile picture must be a JPG, JPEG, or PNG image under 5MB.')
        return
      }
      if (avatarFile.size > 5 * 1024 * 1024) {
        setError('Profile picture must be less than 5MB.')
        return
      }
    }

    try {
      const data = new FormData()
      data.append('firstName', cleanFirst)
      data.append('lastName', cleanLast)
      data.append('email', cleanEmail)
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
      // Transition to optional MFA setup prompt
      setStep('mfa-prompt')
      setSuccessMsg('Account verified successfully! Enhance your account security below.')
    } catch (err) {
      setError(err.message || 'Invalid or expired verification code.')
    }
  }

  // MFA 6-digit input handlers
  const handleMfaDigitChange = (index, value) => {
    const char = value.replace(/\D/g, '').slice(-1)
    const newDigits = [...mfaCodeDigits]
    newDigits[index] = char
    setMfaCodeDigits(newDigits)

    if (char && index < 5) {
      mfaInputRefs.current[index + 1]?.focus()
    }
  }

  const handleMfaKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !mfaCodeDigits[index] && index > 0) {
      mfaInputRefs.current[index - 1]?.focus()
    }
  }

  const handleMfaPaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return

    const newDigits = [...mfaCodeDigits]
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || ''
    }
    setMfaCodeDigits(newDigits)
    const nextIdx = Math.min(pasted.length, 5)
    mfaInputRefs.current[nextIdx]?.focus()
  }

  const handleCopySecret = () => {
    if (mfaData?.manualEntryKey) {
      navigator.clipboard.writeText(mfaData.manualEntryKey)
      setCopiedSecret(true)
      setTimeout(() => setCopiedSecret(false), 2500)
    }
  }

  // Start MFA setup (fetch QR Code & secret)
  const handleStartMfaSetup = async () => {
    setError('')
    setSuccessMsg('')
    setMfaLoading(true)
    try {
      const data = await setup2FA()
      setMfaData(data)
      setStep('mfa-setup')
    } catch (err) {
      setError(err.message || 'Failed to initialize authenticator setup.')
    } finally {
      setMfaLoading(false)
    }
  }

  // Skip MFA step (navigates directly to profile onboarding)
  const handleSkipMfa = () => {
    navigate('/profile-setup')
  }

  // Enable MFA submission
  const handleEnableMfaSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    const code = mfaCodeDigits.join('')
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code displayed in your authenticator app.')
      return
    }

    setMfaLoading(true)
    try {
      await enable2FA(mfaData.secret, code, mfaFrequency)
      setSuccessMsg('Two-factor authentication enabled successfully! Redirecting to profile setup...')
      setTimeout(() => {
        navigate('/profile-setup')
      }, 1200)
    } catch (err) {
      setError(err.message || 'Invalid verification code. Please check your authenticator app and try again.')
    } finally {
      setMfaLoading(false)
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
              {step.startsWith('mfa') ? (
                <>
                  FORTIFY
                  <br />
                  YOUR ACCOUNT
                  <br />
                  SECURITY.
                </>
              ) : (
                <>
                  YOUR NEXT
                  <br />
                  OPPORTUNITY
                  <br />
                  STARTS HERE.
                </>
              )}
            </h1>
          </div>

          {!step.startsWith('mfa') && (
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
          )}
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
                      <span className="auth-avatar-hint">Optional • Stored securely</span>
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
                      {REGEX_PATTERNS.nameHasNumbers.test(formData.firstName) && (
                        <span className="auth-field-warning">⚠️ Numbers are not allowed</span>
                      )}
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
                      {REGEX_PATTERNS.nameHasNumbers.test(formData.lastName) && (
                        <span className="auth-field-warning">⚠️ Numbers are not allowed</span>
                      )}
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
                    {formData.email && !REGEX_PATTERNS.email.test(formData.email.trim()) && (
                      <span className="auth-field-warning">⚠️ Please enter a valid email format</span>
                    )}
                  </div>

                  <div className="auth-form-row">
                    <div className="auth-form-group">
                      <label className="auth-label" htmlFor="password">Password</label>
                      <div className="auth-input-password-wrap">
                        <input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          className="auth-input"
                          placeholder="Create password (8+ chars)"
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

                    <div className="auth-form-group">
                      <label className="auth-label" htmlFor="confirmPassword">Confirm</label>
                      <div className="auth-input-password-wrap">
                        <input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          className="auth-input"
                          placeholder="Confirm password"
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                          required
                        />
                        <button
                          type="button"
                          className="auth-password-toggle-btn"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                          title={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? (
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
                      {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                        <span className="auth-field-warning">⚠️ Passwords do not match</span>
                      )}
                    </div>
                  </div>

                  {/* Real-time Password Rules & Strength Checklist */}
                  {formData.password && (
                    <div className="auth-password-rules-box">
                      <div className="auth-password-rules-header">
                        <span>Password Strength</span>
                        <span className={`auth-password-strength-label ${passwordStrength.class}`}>
                          {passwordStrength.label}
                        </span>
                      </div>
                      <div className="auth-strength-bar">
                        <div className={`auth-strength-fill ${passwordStrength.class}`} />
                      </div>
                      <div className="auth-rules-grid">
                        <div className={`auth-rule-item ${passwordChecks.length ? 'is-met' : ''}`}>
                          <span className="auth-rule-icon">{passwordChecks.length ? '✓' : '○'}</span>
                          <span>8+ characters</span>
                        </div>
                        <div className={`auth-rule-item ${passwordChecks.upper && passwordChecks.lower ? 'is-met' : ''}`}>
                          <span className="auth-rule-icon">{passwordChecks.upper && passwordChecks.lower ? '✓' : '○'}</span>
                          <span>Upper & lowercase</span>
                        </div>
                        <div className={`auth-rule-item ${passwordChecks.number ? 'is-met' : ''}`}>
                          <span className="auth-rule-icon">{passwordChecks.number ? '✓' : '○'}</span>
                          <span>At least 1 number</span>
                        </div>
                        <div className={`auth-rule-item ${passwordChecks.symbol ? 'is-met' : ''}`}>
                          <span className="auth-rule-icon">{passwordChecks.symbol ? '✓' : '○'}</span>
                          <span>At least 1 symbol</span>
                        </div>
                        {!passwordChecks.noWalks && (
                          <div className="auth-rule-alert">
                            ⚠️ No keyboard walks allowed (e.g. "qwerty", "1234")
                          </div>
                        )}
                        {!passwordChecks.noRepeats && (
                          <div className="auth-rule-alert">
                            ⚠️ No repeated characters allowed (e.g. "aaa", "111")
                          </div>
                        )}
                        {!passwordChecks.noSpaces && (
                          <div className="auth-rule-alert">
                            ⚠️ Password cannot contain spaces
                          </div>
                        )}
                      </div>
                    </div>
                  )}


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
            ) : step === 'otp' ? (
              /* STEP 2: OTP VERIFICATION STEP */
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
                      <>Verify & Continue <span className="auth-btn-arrow">→</span></>
                    )}
                  </button>
                </form>
              </div>
            ) : step === 'mfa-prompt' ? (
              /* STEP 3: OPTIONAL TWO-FACTOR AUTHENTICATION PROMPT */
              <div className="auth-mfa-view">
                <div className="otp-card-header">
                  <div className="auth-mfa-shield-icon">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                  </div>
                  <div className="auth-mfa-optional-badge">Optional Security Step</div>
                  <h2 className="auth-card-title">Enable Authenticator App</h2>
                  <p className="auth-card-desc">
                    Protect your candidate profile and interview history with multi-factor authentication using apps like Google Authenticator, Microsoft Authenticator, Apple Passwords, or 1Password.
                  </p>
                </div>

                {error && <div className="auth-alert-error">{error}</div>}
                {successMsg && <div className="auth-alert-success">{successMsg}</div>}

                <div className="auth-mfa-feature-list">
                  <div className="auth-mfa-feature-item">
                    <span className="auth-mfa-check-icon">✓</span>
                    <div>
                      <strong>Official HireMind Branding</strong>
                      <p>Shows official HireMind logo & your email inside your authenticator app.</p>
                    </div>
                  </div>
                  <div className="auth-mfa-feature-item">
                    <span className="auth-mfa-check-icon">✓</span>
                    <div>
                      <strong>Flexible Verification Frequency</strong>
                      <p>Choose between entering code on every login or remembering your trusted device for 2 weeks.</p>
                    </div>
                  </div>
                  <div className="auth-mfa-feature-item">
                    <span className="auth-mfa-check-icon">✓</span>
                    <div>
                      <strong>Instant Offer & Data Protection</strong>
                      <p>Prevent unauthorized access even if your password is ever compromised.</p>
                    </div>
                  </div>
                </div>

                <div className="auth-mfa-cta-stack">
                  <button
                    type="button"
                    className="auth-submit-btn"
                    onClick={handleStartMfaSetup}
                    disabled={mfaLoading}
                  >
                    {mfaLoading ? 'Loading Setup...' : (
                      <>Connect Authenticator App <span className="auth-btn-arrow">→</span></>
                    )}
                  </button>

                  <button
                    type="button"
                    className="auth-skip-btn"
                    onClick={handleSkipMfa}
                  >
                    Skip for Now (Continue to Profile) →
                  </button>
                </div>
              </div>
            ) : (
              /* STEP 4: SCAN QR CODE, SET FREQUENCY & VERIFY CODE */
              <div className="auth-mfa-view">
                <div className="otp-card-header">
                  <div className="auth-mfa-shield-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <circle cx="12" cy="11" r="3" />
                      <path d="m12 14v3" />
                    </svg>
                  </div>
                  <h2 className="auth-card-title">Scan Authenticator QR</h2>
                  <p className="auth-card-desc">
                    Scan with Google Authenticator, Microsoft Authenticator, or Apple Passwords
                  </p>
                </div>

                {error && <div className="auth-alert-error">{error}</div>}
                {successMsg && <div className="auth-alert-success">{successMsg}</div>}

                {/* QR Code Container with Center Logo Branding */}
                <div className="auth-mfa-qr-card">
                  {mfaData?.qrCodeUrl ? (
                    <div className="auth-mfa-qr-container">
                      <img src={mfaData.qrCodeUrl} alt="HireMind 2FA QR Code" className="auth-mfa-qr-image" />
                      <div className="auth-mfa-qr-badge" title="HireMind Verified">
                        <img src={logoIconBlack} alt="HireMind" className="auth-mfa-qr-logo" />
                      </div>
                    </div>
                  ) : (
                    <div className="auth-mfa-loading-box">Generating secure QR code...</div>
                  )}

                  <div className="auth-mfa-secret-section">
                    <span className="auth-mfa-secret-label">Can&apos;t scan? Enter key manually:</span>
                    <div className="auth-mfa-secret-box">
                      <code>{mfaData?.manualEntryKey}</code>
                      <button
                        type="button"
                        className="auth-mfa-copy-btn"
                        onClick={handleCopySecret}
                        title="Copy key to clipboard"
                      >
                        {copiedSecret ? 'Copied ✓' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Authentication Frequency Options */}
                <div className="auth-mfa-frequency-wrapper">
                  <label className="auth-mfa-section-label">When Should We Require This Code?</label>
                  <div className="auth-mfa-frequency-options">
                    <div
                      className={`auth-mfa-freq-card ${mfaFrequency === 'every_two_weeks' ? 'is-selected' : ''}`}
                      onClick={() => setMfaFrequency('every_two_weeks')}
                    >
                      <div className="auth-mfa-freq-radio">
                        <span className={`auth-mfa-radio-dot ${mfaFrequency === 'every_two_weeks' ? 'is-active' : ''}`} />
                      </div>
                      <div className="auth-mfa-freq-info">
                        <div className="auth-mfa-freq-title">
                          Every 2 Weeks (14 Days)
                          <span className="auth-mfa-pill-recommended">Recommended</span>
                        </div>
                        <div className="auth-mfa-freq-desc">
                          Trust this device for 14 days before requiring a new 6-digit authenticator code.
                        </div>
                      </div>
                    </div>

                    <div
                      className={`auth-mfa-freq-card ${mfaFrequency === 'always' ? 'is-selected' : ''}`}
                      onClick={() => setMfaFrequency('always')}
                    >
                      <div className="auth-mfa-freq-radio">
                        <span className={`auth-mfa-radio-dot ${mfaFrequency === 'always' ? 'is-active' : ''}`} />
                      </div>
                      <div className="auth-mfa-freq-info">
                        <div className="auth-mfa-freq-title">Every Time I Log In</div>
                        <div className="auth-mfa-freq-desc">
                          Prompt for a fresh authenticator code on every single sign-in attempt for maximum defense.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6-Digit Code Verification Input */}
                <form onSubmit={handleEnableMfaSubmit} className="auth-mfa-code-form">
                  <label className="auth-mfa-section-label">Enter 6-Digit Code from App to Confirm:</label>
                  <div className="otp-input-container" onPaste={handleMfaPaste}>
                    {mfaCodeDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (mfaInputRefs.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        className="otp-digit-input"
                        value={digit}
                        onChange={(e) => handleMfaDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleMfaKeyDown(idx, e)}
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>

                  <div className="auth-mfa-cta-stack">
                    <button type="submit" className="auth-submit-btn" disabled={mfaLoading}>
                      {mfaLoading ? 'Activating...' : (
                        <>Activate 2FA & Complete Setup <span className="auth-btn-arrow">→</span></>
                      )}
                    </button>

                    <button
                      type="button"
                      className="auth-skip-btn"
                      onClick={handleSkipMfa}
                    >
                      Skip for Now (Continue to Profile) →
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
