import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingHeader from '../components/OnboardingHeader'
import { useProfileSetup } from '../context/ProfileSetupContext'
import './ProfileSetup.css'
import './YourField.css'
import './CareerStage.css'

export default function CareerStage() {
  const navigate = useNavigate()
  const {
    careerStage,
    setCareerStage,
    customCareerStage,
    setCustomCareerStage,
    careerStageOptions,
  } = useProfileSetup()
  const [error, setError] = useState('')

  function handlePrevious() {
    navigate('/profile-setup/your-field')
  }

  function handleFinish() {
    if (!careerStage) {
      setError('Please select your career stage.')
      return
    }

    if (careerStage === 'Other' && !customCareerStage.trim()) {
      setError('Please enter your career stage.')
      return
    }

    if (careerStage === 'Other') {
      setCustomCareerStage(customCareerStage.trim())
    }

    setError('')
    // Onboarding complete. Wire API submission / post-onboarding destination when available.
  }

  return (
    <div className="profile-setup">
      <OnboardingHeader />
      <main className="profile-setup__card career-stage__card">
        <div className="your-field__form career-stage__form">
          <div className="your-field__group">
            <label className="your-field__label" htmlFor="career-stage-select">
              WHERE ARE YOU IN YOUR CAREER?
            </label>
            <div className="your-field__select-wrap">
              <select
                id="career-stage-select"
                className="your-field__select"
                value={careerStage}
                onChange={(event) => {
                  const next = event.target.value
                  setCareerStage(next)
                  if (next !== 'Other') setCustomCareerStage('')
                  if (error) setError('')
                }}
              >
                <option value="" disabled>
                  Select
                </option>
                {careerStageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {careerStage === 'Other' ? (
              <input
                id="career-stage-custom"
                className="your-field__input"
                type="text"
                value={customCareerStage}
                placeholder="Enter your career stage"
                onChange={(event) => {
                  setCustomCareerStage(event.target.value)
                  if (error) setError('')
                }}
              />
            ) : null}
          </div>

          {error ? (
            <p className="your-field__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="profile-setup__actions career-stage__actions">
            <button
              type="button"
              className="profile-btn profile-btn--previous"
              onClick={handlePrevious}
            >
              <span aria-hidden="true">←</span> PREVIOUS
            </button>
            <button
              type="button"
              className="profile-btn profile-btn--next"
              onClick={handleFinish}
            >
              FINISH
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
