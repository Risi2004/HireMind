import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingHeader from '../components/OnboardingHeader'
import { useProfileSetup } from '../context/ProfileSetupContext'
import './ProfileSetup.css'
import './YourField.css'

export default function YourField() {
  const navigate = useNavigate()
  const {
    field,
    setField,
    customField,
    setCustomField,
    experienceLevel,
    setExperienceLevel,
    experienceLevels,
    fieldOptions,
  } = useProfileSetup()
  const [error, setError] = useState('')

  function handlePrevious() {
    navigate('/profile-setup/about-you')
  }

  function handleNext() {
    if (!field) {
      setError('Please select your field.')
      return
    }

    if (field === 'Other' && !customField.trim()) {
      setError('Please enter your field.')
      return
    }

    if (!experienceLevel) {
      setError('Please select your experience level.')
      return
    }

    if (field === 'Other') {
      setCustomField(customField.trim())
    }

    setError('')
    navigate('/profile-setup/career-stage')
  }

  return (
    <div className="profile-setup">
      <OnboardingHeader />
      <main className="profile-setup__card your-field__card">
        <div className="your-field__form">
          <div className="your-field__group">
            <label className="your-field__label" htmlFor="your-field-select">
              YOUR FIELD
            </label>
            <div className="your-field__select-wrap">
              <select
                id="your-field-select"
                className="your-field__select"
                value={field}
                onChange={(event) => {
                  const next = event.target.value
                  setField(next)
                  if (next !== 'Other') setCustomField('')
                  if (error) setError('')
                }}
              >
                <option value="" disabled>
                  Select your field
                </option>
                {fieldOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {field === 'Other' ? (
              <input
                id="your-field-custom"
                className="your-field__input"
                type="text"
                value={customField}
                placeholder="Enter your field"
                onChange={(event) => {
                  setCustomField(event.target.value)
                  if (error) setError('')
                }}
              />
            ) : null}
          </div>

          <div className="your-field__group">
            <p className="your-field__label" id="experience-level-label">
              EXPERIENCE LEVEL
            </p>
            <div
              className="your-field__segment"
              role="radiogroup"
              aria-labelledby="experience-level-label"
            >
              {experienceLevels.map((level) => {
                const selected = experienceLevel === level
                return (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`your-field__option${selected ? ' is-selected' : ''}`}
                    onClick={() => {
                      setExperienceLevel(level)
                      if (error) setError('')
                    }}
                  >
                    {level}
                  </button>
                )
              })}
            </div>
          </div>

          {error ? (
            <p className="your-field__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="profile-setup__actions your-field__actions">
            <button
              type="button"
              className="profile-btn profile-btn--next"
              onClick={handleNext}
            >
              NEXT <span aria-hidden="true">→</span>
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
