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
    careerInterests,
    addCareerInterest,
    removeCareerInterest,
    submitProfileSetup,
  } = useProfileSetup()
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Local state for adding an interest
  const [isAddingInterest, setIsAddingInterest] = useState(false)
  const [newInterestInput, setNewInterestInput] = useState('')

  function handleAddInterestSubmit(e) {
    if (e) e.preventDefault()
    const clean = newInterestInput.trim()
    if (!clean) return
    addCareerInterest(clean)
    setNewInterestInput('')
    setIsAddingInterest(false)
  }

  function handleKeyDownInterest(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddInterestSubmit()
    } else if (e.key === 'Escape') {
      setIsAddingInterest(false)
      setNewInterestInput('')
    }
  }

  function handlePrevious() {
    navigate('/profile-setup/your-field')
  }

  async function handleFinish() {
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
    setIsSubmitting(true)

    try {
      await submitProfileSetup()
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Failed to complete profile setup. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
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

          {/* CAREER INTERESTS SECTION (Matching User UI Specification) */}
          <div className="career-stage__interests-container">
            <div className="career-stage__interests-badge-wrap">
              <span className="career-stage__interests-badge">CAREER INTERESTS</span>
            </div>

            <div className="career-stage__interests-box">
              {careerInterests.map((interest) => (
                <div key={interest} className="career-stage__interest-pill">
                  <span className="career-stage__interest-name">{interest}</span>
                  <button
                    type="button"
                    className="career-stage__interest-remove-btn"
                    onClick={() => removeCareerInterest(interest)}
                    aria-label={`Remove ${interest}`}
                    title={`Remove ${interest}`}
                  >
                    ✕
                  </button>
                </div>
              ))}

              {isAddingInterest ? (
                <form className="career-stage__interest-add-form" onSubmit={handleAddInterestSubmit}>
                  <input
                    type="text"
                    className="career-stage__interest-input"
                    placeholder="Type an interest (e.g. Cloud Computing)..."
                    autoFocus
                    value={newInterestInput}
                    onChange={(e) => setNewInterestInput(e.target.value)}
                    onKeyDown={handleKeyDownInterest}
                  />
                  <button
                    type="submit"
                    className="career-stage__interest-add-confirm-btn"
                    disabled={!newInterestInput.trim()}
                  >
                    + Add
                  </button>
                  <button
                    type="button"
                    className="career-stage__interest-add-cancel-btn"
                    onClick={() => {
                      setIsAddingInterest(false)
                      setNewInterestInput('')
                    }}
                    title="Cancel"
                  >
                    ✕
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="career-stage__interest-add-btn"
                  onClick={() => setIsAddingInterest(true)}
                  title="Add Career Interest"
                >
                  <span>Add Interest</span>
                  <span className="career-stage__interest-plus-icon">+</span>
                </button>
              )}
            </div>
          </div>

          {error ? (
            <p className="your-field__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="profile-setup__actions career-stage__actions">
            <button
              type="button"
              className="profile-btn profile-btn--next"
              onClick={handleFinish}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'SAVING PROFILE...' : 'FINISH'}
            </button>
            <button
              type="button"
              className="profile-btn profile-btn--previous"
              onClick={handlePrevious}
            >
              <span aria-hidden="true">←</span> PREVIOUS
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
