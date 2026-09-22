import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import OnboardingHeader from '../components/OnboardingHeader'
import githubLogo from '../assets/icons/Vector.svg'
import { useProfileSetup } from '../context/ProfileSetupContext'
import { useAuth } from '../context/AuthContext'
import './ProfileSetup.css'

export default function ProfileSetup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { refreshUser } = useAuth()
  const { githubData, connectGithub, disconnectGithub, startGithubOAuth } = useProfileSetup()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  // Check for redirect return from GitHub OAuth flow
  useEffect(() => {
    const isConnected = searchParams.get('github_connected')
    const ghError = searchParams.get('github_error')

    if (isConnected === 'true') {
      if (refreshUser) refreshUser()
      setStatusMessage('GitHub account connected successfully!')
      setTimeout(() => setStatusMessage(''), 4000)
      navigate('/profile-setup', { replace: true })
    } else if (ghError) {
      if (ghError === 'oauth_not_configured') {
        setError('GitHub OAuth credentials not yet configured in backend .env. You can enter your username below.')
        setIsModalOpen(true)
      } else if (ghError === 'access_denied') {
        setError('GitHub authorization was canceled or access was denied.')
        setIsModalOpen(true)
      } else {
        setError('GitHub connection failed. Please try again.')
        setIsModalOpen(true)
      }
      navigate('/profile-setup', { replace: true })
    }
  }, [searchParams, refreshUser, navigate])

  function goToAboutYou() {
    navigate('/profile-setup/about-you')
  }

  const handleOpenModal = () => {
    setUsernameInput('')
    setError('')
    setIsModalOpen(true)
  }

  const handleConnectSubmit = async (e) => {
    e.preventDefault()
    if (!usernameInput.trim()) {
      setError('Please enter a GitHub username or URL.')
      return
    }

    setIsConnecting(true)
    setError('')

    try {
      await connectGithub(usernameInput.trim())
      setIsModalOpen(false)
    } catch (err) {
      setError(err.message || 'Failed to connect GitHub account. Please check the username.')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async (e) => {
    e.stopPropagation()
    if (window.confirm('Disconnect GitHub account?')) {
      try {
        await disconnectGithub()
      } catch (err) {
        alert(err.message || 'Failed to disconnect GitHub')
      }
    }
  }

  return (
    <div className="profile-setup">
      <OnboardingHeader />
      <main className="profile-setup__card">
        {statusMessage && (
          <div className="profile-setup-banner" style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#4ade80', padding: '10px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✓</span>
            <span>{statusMessage}</span>
          </div>
        )}
        <div className="profile-setup__content">
          <h1 className="profile-setup__title">Build Your Professional Profile</h1>
          <p className="profile-setup__desc">
            Help HireMind tailor your interview scenarios by telling us a bit about your
            background and technical stack. The more context you provide, the smarter the AI
            gets.
          </p>

          {/* GitHub Connection Card */}
          <div className={`github-card ${githubData?.connected ? 'is-connected' : ''}`}>
            <div className="github-card__left">
              {githubData?.connected && githubData.avatarUrl ? (
                <img
                  className="github-card__avatar"
                  src={githubData.avatarUrl}
                  alt={githubData.username}
                />
              ) : (
                <img
                  className="github-card__logo"
                  src={githubLogo}
                  alt=""
                  width={20}
                  height={20}
                />
              )}

              <div className="github-card__text">
                <span className="github-card__name">
                  {githubData?.connected ? `@${githubData.username}` : 'GitHub'}
                </span>
                <span className="github-card__sub">
                  {githubData?.connected
                    ? `${githubData.publicRepos || 0} Repositories linked`
                    : 'Showcase projects & code'}
                </span>
              </div>
            </div>

            {githubData?.connected ? (
              <div className="github-card__actions-wrap">
                <span className="github-card__badge">&#10003; Connected</span>
                <button
                  type="button"
                  className="github-card__unlink-btn"
                  onClick={handleDisconnect}
                  title="Disconnect GitHub account"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="github-card__login"
                onClick={handleOpenModal}
              >
                LOGIN
              </button>
            )}
          </div>
        </div>

        <div className="profile-setup__actions">
          <button
            type="button"
            className="profile-btn profile-btn--next"
            onClick={goToAboutYou}
          >
            NEXT <span aria-hidden="true">→</span>
          </button>
          <button
            type="button"
            className="profile-btn profile-btn--skip"
            onClick={goToAboutYou}
          >
            SKIP
          </button>
        </div>
      </main>

      {/* GitHub Connect Modal */}
      {isModalOpen && (
        <div className="gh-modal-overlay" onClick={() => !isConnecting && setIsModalOpen(false)}>
          <div className="gh-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="gh-modal-close"
              onClick={() => setIsModalOpen(false)}
              disabled={isConnecting}
            >
              ✕
            </button>

            <div className="gh-modal-header">
              <div className="gh-modal-icon">
                <img src={githubLogo} alt="" width={24} height={24} />
              </div>
              <h3 className="gh-modal-title">Connect Your GitHub</h3>
              <p className="gh-modal-desc">
                Enter your GitHub username or profile link to showcase your repositories and code activity to AI interviewers.
              </p>
            </div>

            {error && (
              <div className="gh-modal-error" role="alert">
                {error}
              </div>
            )}

            <div className="gh-oauth-action">
              <button
                type="button"
                className="gh-oauth-btn"
                onClick={() => startGithubOAuth('/profile-setup')}
                disabled={isConnecting}
              >
                <img src={githubLogo} alt="" width={20} height={20} />
                <span>Authorize with GitHub (1-Click OAuth)</span>
              </button>
            </div>

            <div className="gh-modal-divider">
              <span>or connect by username</span>
            </div>

            <form onSubmit={handleConnectSubmit} className="gh-modal-form">
              <div className="gh-input-wrap">
                <span className="gh-input-prefix">github.com/</span>
                <input
                  type="text"
                  className="gh-input"
                  placeholder="username"
                  autoFocus
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  disabled={isConnecting}
                />
              </div>

              <div className="gh-modal-buttons">
                <button
                  type="button"
                  className="gh-btn gh-btn--cancel"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isConnecting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="gh-btn gh-btn--primary"
                  disabled={isConnecting || !usernameInput.trim()}
                >
                  {isConnecting ? 'Verifying...' : 'Connect Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
