import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logoImg from '../assets/images/logo.png'
import logoDarkImg from '../assets/images/logo-dark.png'
import './Auth.css'

export default function Login() {
  const navigate = useNavigate()
  const { login, loading } = useAuth()

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: true,
  })

  const [error, setError] = useState('')
  const [needsVerificationEmail, setNeedsVerificationEmail] = useState(null)

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
      await login(formData.email.trim(), formData.password, formData.rememberMe)
      navigate('/dashboard')
    } catch (err) {
      if (err.needsVerification) {
        setNeedsVerificationEmail(err.email || formData.email.trim())
        setError(err.message || 'Please verify your email before logging in.')
      } else {
        setError(err.message || 'Invalid email or password.')
      }
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
                <input
                  id="password"
                  type="password"
                  className="auth-input"
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
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
          </div>
        </div>
      </div>
    </div>
  )
}
