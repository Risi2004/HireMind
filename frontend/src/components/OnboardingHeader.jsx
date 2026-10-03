import { useState } from 'react'
import logo from '../assets/images/3.png'
import { useAuth } from '../context/useAuth'
import './OnboardingHeader.css'

export default function OnboardingHeader() {
  const { user } = useAuth()
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null)

  const initial = user?.firstName?.trim()
    ? user.firstName.trim().charAt(0).toUpperCase()
    : 'U'

  const avatarUrl = user?.avatarUrl

  // A new avatar URL gets a fresh attempt automatically
  const imageError = Boolean(avatarUrl) && failedAvatarUrl === avatarUrl

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
            onError={() => setFailedAvatarUrl(avatarUrl)}
          />
        ) : (
          <span className="onboarding-header__initial">{initial}</span>
        )}
      </div>
    </header>
  )
}
