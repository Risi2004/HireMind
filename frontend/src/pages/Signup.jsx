import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logoImg from '../assets/images/logo.png'
import logoDarkImg from '../assets/images/logo-dark.png'
import './Auth.css'

export default function Signup() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: true,
  })

  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
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
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!formData.agreeTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy.')
      return
    }

    setError('')
    // Onboarding redirection
    navigate('/profile-setup')
  }

  const handleGoogleAuth = () => {
    // Navigate directly into onboarding for mockup
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
            <div className="auth-card-header">
              <h2 className="auth-card-title">Start Your Journey</h2>
              <p className="auth-card-desc">
                Create your account and take the first step toward becoming interview-ready.
              </p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {error && (
                <div style={{ color: '#f87171', fontSize: '0.84rem', textAlign: 'center' }}>
                  {error}
                </div>
              )}

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
                    placeholder="Create password"
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

              <button type="submit" className="auth-submit-btn">
                Create Account <span className="auth-btn-arrow">→</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
