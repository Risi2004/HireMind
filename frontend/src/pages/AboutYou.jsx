import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingHeader from '../components/OnboardingHeader'
import aboutIcon from '../assets/icons/Background+Shadow.svg'
import uploadIcon from '../assets/icons/Container.svg'
import { useProfileSetup } from '../context/ProfileSetupContext'
import { useAuth } from '../context/AuthContext'
import './ProfileSetup.css'
import './AboutYou.css'

const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx']

function hasAcceptedExtension(fileName) {
  const lower = fileName.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export default function AboutYou() {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const { resumeFile, setResumeFile, clearResume } = useProfileSetup()
  const { user: authUser } = useAuth()
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState('')

  function openPicker() {
    setError('')
    inputRef.current?.click()
  }

  function applyFile(file) {
    if (!file) return

    if (!hasAcceptedExtension(file.name)) {
      setError('Please upload a PDF or DOCX resume.')
      return
    }

    setError('')
    setResumeFile(file)
  }

  function onInputChange(event) {
    applyFile(event.target.files?.[0])
    event.target.value = ''
  }

  function onDragOver(event) {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(true)
  }

  function onDragLeave(event) {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
  }

  function onDrop(event) {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
    applyFile(event.dataTransfer.files?.[0])
  }

  function handleViewResume(event) {
    if (event) event.stopPropagation()
    if (resumeFile) {
      const blobUrl = URL.createObjectURL(resumeFile)
      window.open(blobUrl, '_blank', 'noopener,noreferrer')
      return
    }
    if (authUser?.resumeFileName || authUser?.resumeUrl) {
      const token = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      let targetUrl = authUser?.resumeUrl
      if (!targetUrl) {
        const cleanFilename = (authUser?.resumeFileName || '').replace(/^resumes\//, '')
        targetUrl = `/api/profile/resume/${encodeURIComponent(cleanFilename || 'view')}`
      }
      const separator = targetUrl.includes('?') ? '&' : '?'
      const fullUrl = `http://localhost:5000${targetUrl}${separator}token=${encodeURIComponent(token || '')}`
      window.open(fullUrl, '_blank', 'noopener,noreferrer')
    }
  }

  function handlePrevious() {
    navigate('/profile-setup')
  }

  function handleNext() {
    if (!resumeFile && !authUser?.resumeFileName) {
      setError('Please upload your resume before continuing.')
      return
    }

    setError('')
    navigate('/profile-setup/your-field')
  }

  return (
    <div className="profile-setup">
      <OnboardingHeader />
      <main className="profile-setup__card about-you__card">
        <div className="about-you__header">
          <img className="about-you__user-icon" src={aboutIcon} alt="" />
          <h1 className="about-you__title">About You</h1>
        </div>

        <input
          ref={inputRef}
          className="about-you__file-input"
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={onInputChange}
        />

        <div
          className={`about-you__dropzone${isDragging ? ' is-dragging' : ''}${resumeFile ? ' has-file' : ''}`}
          role="button"
          tabIndex={0}
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              openPicker()
            }
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          aria-label="Upload resume"
        >
          <span className="about-you__upload-icon-wrap" aria-hidden="true">
            <img className="about-you__upload-icon" src={uploadIcon} alt="" />
          </span>

          {resumeFile || authUser?.resumeFileName ? (
            <>
              <span className="about-you__upload-label">
                {resumeFile ? resumeFile.name : authUser.resumeFileName}
              </span>
              <span className="about-you__upload-hint">Click to replace · PDF, DOC, DOCX</span>
              <div className="about-you__btn-group" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="about-you__view-btn"
                  onClick={handleViewResume}
                  title="View uploaded resume document"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span>View Resume</span>
                </button>
                <button
                  type="button"
                  className="about-you__clear"
                  onClick={(event) => {
                    event.stopPropagation()
                    clearResume()
                    setError('')
                  }}
                >
                  {resumeFile ? 'Remove' : 'Replace File'}
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="about-you__upload-label">Upload Resume</span>
              <span className="about-you__upload-hint">
                Drag &amp; Drop or Click to Browse (PDF, DOCX)
              </span>
            </>
          )}
        </div>

        {error ? (
          <p className="about-you__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="profile-setup__actions about-you__actions">
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
      </main>
    </div>
  )
}
