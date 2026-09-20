import { useNavigate } from 'react-router-dom'
import OnboardingHeader from '../components/OnboardingHeader'
import githubLogo from '../assets/icons/Vector.svg'
import './ProfileSetup.css'

export default function ProfileSetup() {
  const navigate = useNavigate()

  function goToAboutYou() {
    navigate('/profile-setup/about-you')
  }

  return (
    <div className="profile-setup">
      <OnboardingHeader />
      <main className="profile-setup__card">
        <div className="profile-setup__content">
          <h1 className="profile-setup__title">Build Your Professional Profile</h1>
          <p className="profile-setup__desc">
            Help HireMind tailor your interview scenarios by telling us a bit about your
            background and technical stack. The more context you provide, the smarter the AI
            gets.
          </p>

          <div className="github-card">
            <div className="github-card__left">
              <img
                className="github-card__logo"
                src={githubLogo}
                alt=""
                width={20}
                height={20}
              />
              <div className="github-card__text">
                <span className="github-card__name">GitHub</span>
                <span className="github-card__sub">Showcase projects &amp; code</span>
              </div>
            </div>
            <button type="button" className="github-card__login">
              LOGIN
            </button>
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
    </div>
  )
}
