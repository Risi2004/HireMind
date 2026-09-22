import { useState, useEffect } from 'react'
import logo from '../assets/images/3.png'
import { useAuth } from '../context/AuthContext'
import './OnboardingHeader.css'

export default function OnboardingHeader() {
  const { user } = useAuth()
  const [imageError, setImageError] = useState(false)

  const initial = user?.firstName?.trim()
    ? user.firstName.trim().charAt(0).toUpperCase()
    : 'U'

  const avatarUrl = user?.avatarUrl

  useEffect(() => {
    setImageError(false)
  }, [avatarUrl])

  return (
    <header className="onboarding-header">
      <img
        className="onboarding-header__logo"
        src={logo}
        alt="HireMind"
        draggable="false"
      />
      <div className="onboarding-header__avatar" aria-label={`User ${initial}`}>
        {avatarUrl && !imageError ? (
          <img
            className="onboarding-header__avatar-img"
            src={avatarUrl}
            alt={user?.firstName || 'User'}
            onError={() => setImageError(true)}
          />
        ) : (
          <span className="onboarding-header__initial">{initial}</span>
        )}
      </div>
    </header>
  )
}
