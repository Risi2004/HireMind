import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingHeader from '../components/OnboardingHeader'
import { useProfileSetup } from '../context/useProfileSetup'
import { useAuth } from '../context/useAuth'
import './ProfileSetup.css'
import './YourField.css'

export default function YourField() {
  const navigate = useNavigate()
  const { user: authUser } = useAuth()
  const {
    field,
    setField,
    customField,
    setCustomField,
    experienceLevel,
    setExperienceLevel,
    experienceLevels,
    fieldOptions,
    skills,
    addSkill,
    removeSkill,
    popularSkills,
    resumeFile,
    isExtractingSkills,
    extractedSkills,
    lastExtractedSource,
    extractSkillsFromResume,
  } = useProfileSetup()
  const [error, setError] = useState('')
  const [skillInput, setSkillInput] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Automatically detect skills from resume if not already extracted for this file/profile
  useEffect(() => {
    const hasResume = Boolean(resumeFile || authUser?.resumeFileName || authUser?.resumeUrl)
    const currentSource = resumeFile
      ? `${resumeFile.name}_${resumeFile.size}_${resumeFile.lastModified}`
      : (authUser?.resumeFileName || authUser?.resumeUrl || '')

    if (hasResume && currentSource && currentSource !== lastExtractedSource && !isExtractingSkills) {
      extractSkillsFromResume(resumeFile)
    }
  }, [resumeFile, authUser?.resumeFileName, authUser?.resumeUrl, lastExtractedSource, isExtractingSkills, extractSkillsFromResume])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter skills based on current input and avoid already selected skills
  const filteredSuggestions = useMemo(() => {
    const query = skillInput.trim().toLowerCase()
    const available = popularSkills.filter(
      (s) => !skills.some((already) => already.toLowerCase() === s.toLowerCase())
    )
    if (!query) return available.slice(0, 12)
    return available.filter((s) => s.toLowerCase().includes(query)).slice(0, 10)
  }, [skillInput, skills, popularSkills])

  function handleAddSkill(skillToAdd) {
    const clean = (skillToAdd || skillInput).trim()
    if (!clean) return
    addSkill(clean)
    setSkillInput('')
    setIsDropdownOpen(false)
    if (error) setError('')
  }

  function handleSkillKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (skillInput.trim()) {
        handleAddSkill(skillInput.trim())
      }
    } else if (e.key === 'Backspace' && !skillInput && skills.length > 0) {
      removeSkill(skills[skills.length - 1])
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false)
    }
  }

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

          <div className="your-field__group" ref={dropdownRef}>
            <div className="your-field__label-row">
              <div className="your-field__label-title-group">
                <label className="your-field__label" htmlFor="skills-input">
                  SKILLS
                </label>
                {isExtractingSkills ? (
                  <span className="your-field__detecting-badge">
                    <span className="your-field__spinner-dot" aria-hidden="true" />
                    Detecting from CV...
                  </span>
                ) : extractedSkills.length > 0 ? (
                  <span
                    className="your-field__detected-badge"
                    title={`${extractedSkills.length} skills automatically detected from your resume`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', verticalAlign: '-1px' }}>
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                    </svg>
                    {extractedSkills.length} from CV
                  </span>
                ) : null}
              </div>
              <div className="your-field__label-actions-group">
                {!isExtractingSkills && (resumeFile || authUser?.resumeFileName) && (
                  <button
                    type="button"
                    className="your-field__rescan-btn"
                    onClick={() => extractSkillsFromResume(resumeFile, true)}
                    title="Re-scan your CV to detect skills"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', verticalAlign: '-1px' }}>
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                      <path d="M16 21h5v-5" />
                    </svg>
                    Re-detect
                  </button>
                )}
                <span className="your-field__label-hint">
                  {skills.length > 0 ? `${skills.length} selected` : 'Type or pick skills'}
                </span>
              </div>
            </div>

            <div className="your-field__skill-input-wrap">
              <input
                id="skills-input"
                type="text"
                className="your-field__input your-field__skill-input"
                value={skillInput}
                placeholder={
                  isExtractingSkills
                    ? 'Detecting skills from your CV...'
                    : skills.length === 0
                      ? 'Type any skill (e.g. React, Python) and press Enter...'
                      : 'Add another skill...'
                }
                onChange={(event) => {
                  setSkillInput(event.target.value)
                  setIsDropdownOpen(true)
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={handleSkillKeyDown}
                autoComplete="off"
              />
              <button
                type="button"
                className="your-field__skill-add-btn"
                onClick={() => handleAddSkill(skillInput)}
                disabled={!skillInput.trim() || isExtractingSkills}
                title="Add Skill"
              >
                + Add
              </button>

              {isDropdownOpen && (
                <div className="your-field__skill-dropdown" role="listbox">
                  {skillInput.trim() &&
                    !skills.some((s) => s.toLowerCase() === skillInput.trim().toLowerCase()) && (
                      <button
                        type="button"
                        className="your-field__skill-dropdown-item your-field__skill-dropdown-item--custom"
                        onClick={() => handleAddSkill(skillInput)}
                      >
                        <span className="your-field__skill-add-icon">+</span>
                        <span>
                          Add <strong>"{skillInput.trim()}"</strong>
                        </span>
                      </button>
                    )}

                  {filteredSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="your-field__skill-dropdown-item"
                      onClick={() => handleAddSkill(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}

                  {filteredSuggestions.length === 0 && !skillInput.trim() && (
                    <div className="your-field__skill-dropdown-empty">
                      All popular skills selected. Type to add custom skills!
                    </div>
                  )}
                </div>
              )}
            </div>

            {skills.length > 0 && (
              <div className="your-field__skills-tags">
                {skills.map((s) => (
                  <span key={s} className="your-field__skill-pill">
                    {s}
                    <button
                      type="button"
                      className="your-field__skill-remove"
                      onClick={() => removeSkill(s)}
                      aria-label={`Remove ${s}`}
                      title={`Remove ${s}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
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
