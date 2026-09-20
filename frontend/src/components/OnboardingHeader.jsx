import logo from '../assets/images/3.png'
import { useProfileSetup } from '../context/ProfileSetupContext'
import './OnboardingHeader.css'

export default function OnboardingHeader() {
  const { user } = useProfileSetup()
  const initial = user?.name?.charAt(0).toUpperCase() || 'J'

  return (
    <header className="onboarding-header">
      <img
        className="onboarding-header__logo"
        src={logo}
        alt="HireMind"
        draggable="false"
      />
      <div className="onboarding-header__avatar" aria-label={`User ${initial}`}>
        <span className="onboarding-header__initial">{initial}</span>
      </div>
    </header>
  )
}
