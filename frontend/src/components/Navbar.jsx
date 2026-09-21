import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import brandMarkImg from '../assets/images/3.png'
import chatbotIcon from '../assets/icons/chatbot.svg'
import ProfileDropdown from './ProfileDropdown'
import './Navbar.css'

export default function Navbar({
  logoRedirect = '/dashboard',
  leftBadge,
  leftContent,
  showChatBot = false,
  isChatOpen = false,
  onChatToggle,
  rightContent,
  initial: propInitial,
  userName: propUserName,
  userEmail: propUserEmail,
  className = '',
}) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const displayName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
    : propUserName || 'Candidate'
  const displayEmail = user?.email || propUserEmail || 'candidate@hiremind.com'
  const displayInitial = user?.firstName?.trim()
    ? user.firstName.trim().charAt(0).toUpperCase()
    : propInitial || displayName?.trim().charAt(0).toUpperCase() || 'U'

  return (
    <header className={`app-navbar ${className}`}>
      <div className="app-navbar__left">
        <div
          className="app-navbar__brand"
          onClick={() => navigate(logoRedirect)}
          title="HireMind Home"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate(logoRedirect)}
        >
          <img src={brandMarkImg} alt="HireMind" className="app-navbar__logo" />
        </div>

        {leftBadge && (
          <div className="app-navbar__badge">
            <span className="app-navbar__badge-dot" />
            <span className="app-navbar__badge-text">{leftBadge}</span>
          </div>
        )}

        {leftContent}
      </div>

      <div className="app-navbar__right">
        {rightContent}

        {showChatBot && (
          <button
            type="button"
            className={`app-navbar__icon-btn ${isChatOpen ? 'is-active' : ''}`}
            onClick={onChatToggle}
            title="Toggle AI Coach"
            aria-label="Toggle AI Coach Chat"
          >
            <img src={chatbotIcon} alt="AI Coach" className="app-navbar__bot-icon" />
          </button>
        )}

        <ProfileDropdown initial={displayInitial} name={displayName} email={displayEmail} />
      </div>
    </header>
  )
}
