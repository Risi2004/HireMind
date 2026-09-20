import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import logoutIcon from '../assets/icons/logout.svg'
import './ProfileDropdown.css'

export default function ProfileDropdown({
  initial = 'J',
  name = 'Jazeel Jaufer',
  email = 'jazeel.jaufer@example.com',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  // Close dropdown on outside click or Escape
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleGoToProfile = () => {
    setIsOpen(false)
    navigate('/profile')
  }

  const handleDeleteAccount = () => {
    setIsOpen(false)
    const confirmed = window.confirm(
      'Warning: Are you sure you want to permanently delete your HireMind account? All interview history, scores, and profile data will be permanently removed. This action cannot be undone.'
    )
    if (confirmed) {
      localStorage.clear()
      sessionStorage.clear()
      alert('Your account has been deleted successfully.')
      navigate('/signup')
    }
  }

  const handleLogout = () => {
    setIsOpen(false)
    const confirmed = window.confirm('Are you sure you want to log out?')
    if (confirmed) {
      navigate('/login')
    }
  }

  return (
    <div className={`prof-dropdown-wrapper ${className}`} ref={dropdownRef}>
      <button
        type="button"
        className={`prof-dropdown-trigger ${isOpen ? 'is-active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        title="Account Menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User Account Menu"
      >
        <span className="prof-dropdown-initial">{initial}</span>
      </button>

      {isOpen && (
        <div className="prof-dropdown-menu" role="menu">
          {/* User Profile Summary */}
          <div className="prof-dropdown-user-header">
            <div className="prof-dropdown-user-avatar">
              <span>{initial}</span>
            </div>
            <div className="prof-dropdown-user-details">
              <span className="prof-dropdown-user-name">{name}</span>
              <span className="prof-dropdown-user-email">{email}</span>
            </div>
          </div>

          <div className="prof-dropdown-divider" />

          {/* Item 1: Go to Profile */}
          <button
            type="button"
            className="prof-dropdown-item"
            onClick={handleGoToProfile}
            role="menuitem"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>Go to Profile</span>
          </button>

          {/* Item 2: Delete Account */}
          <button
            type="button"
            className="prof-dropdown-item is-danger"
            onClick={handleDeleteAccount}
            role="menuitem"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            <span>Delete Account</span>
          </button>

          <div className="prof-dropdown-divider" />

          {/* Item 3: Log Out */}
          <button
            type="button"
            className="prof-dropdown-item"
            onClick={handleLogout}
            role="menuitem"
          >
            <img src={logoutIcon} alt="" className="prof-dropdown-item-icon" />
            <span>Log Out</span>
          </button>
        </div>
      )}
    </div>
  )
}
