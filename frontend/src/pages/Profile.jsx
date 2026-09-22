import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import brandMarkImg from '../assets/images/3.png'
import backArrowIcon from '../assets/icons/back arrow.svg'
import logoutIcon from '../assets/icons/logout.svg'
import emailIcon from '../assets/icons/email.svg'
import tick2Icon from '../assets/icons/tick2.svg'
import careerInfoIcon from '../assets/icons/career information.svg'
import editIcon from '../assets/icons/edit.svg'
import connectedProfilesIcon from '../assets/icons/connected profiles.svg'
import profileShowIcon from '../assets/icons/profile show.svg'
import skillsIcon from '../assets/icons/skills.svg'
import addIcon from '../assets/icons/add.svg'
import closeIcon from '../assets/icons/close.svg'
import githubIcon from '../assets/icons/Vector.svg'
import linkedinIcon from '../assets/icons/linkedin.svg'
import Navbar from '../components/Navbar'
import DeleteAccountModal from '../components/DeleteAccountModal'
import TwoFactorModal from '../components/TwoFactorModal'
import { useAuth } from '../context/AuthContext'
import { getApiUrl } from '../config/api'
import {
  CAREER_STAGE_OPTIONS,
  FIELD_OPTIONS,
  EXPERIENCE_LEVELS,
  POPULAR_SKILLS,
} from '../context/ProfileSetupContext'
import './Profile.css'

export default function Profile() {
  const navigate = useNavigate()
  const resumeInputRef = useRef(null)
  const avatarInputRef = useRef(null)

  const {
    user,
    token,
    logout,
    refreshUser,
    updateUserProfile,
    uploadUserResume,
    deleteUserResume,
    uploadUserAvatar,
    connectUserGithub,
    disconnectUserGithub,
    updateUserSkills,
    updateUserInterests,
    updateUserLinkedin,
    disable2FA,
  } = useAuth()

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false)
  const [isDisablingMfa, setIsDisablingMfa] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const [isUploadingResume, setIsUploadingResume] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isSavingCareer, setIsSavingCareer] = useState(false)

  // Toast Notification Helper
  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }

  // Refresh fresh profile data from DB on mount
  useEffect(() => {
    if (token) {
      refreshUser()
    }
  }, [token])

  // Profile data states derived dynamically from DB user
  const candidateFirstName = user?.firstName || 'Candidate'
  const candidateLastName = user?.lastName || ''
  const candidateName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
    : 'Candidate'
  const candidateEmail = user?.email || ''
  const candidateAvatar = user?.avatarUrl || ''
  const candidateInitial = candidateFirstName.trim() ? candidateFirstName.trim().charAt(0).toUpperCase() : 'U'
  const candidateTier = user?.tier || 'FREE'
  const candidateTitle = user?.title || user?.careerStage || 'Software Engineering Professional'

  // Hero identity editor state
  const [isEditingHero, setIsEditingHero] = useState(false)
  const [heroFields, setHeroFields] = useState({
    firstName: '',
    lastName: '',
    title: '',
  })

  // Sync Hero Fields with user
  useEffect(() => {
    if (user) {
      setHeroFields({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        title: user.title || user.careerStage || '',
      })
    }
  }, [user])

  // Save Hero Identity (Name and Title) to DB
  const handleSaveHero = async (e) => {
    e.preventDefault()
    try {
      await updateUserProfile({
        firstName: heroFields.firstName.trim(),
        lastName: heroFields.lastName.trim(),
        title: heroFields.title.trim(),
      })
      setIsEditingHero(false)
      showToast('Profile identity updated successfully in database!')
    } catch (err) {
      showToast(err.message || 'Failed to update identity', 'error')
    }
  }

  // Handle Avatar Image Upload directly to DB & R2
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Verify 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      showToast('Profile image must be less than 5MB', 'error')
      return
    }

    setIsUploadingAvatar(true)
    try {
      await uploadUserAvatar(file)
      showToast('Profile picture uploaded successfully!')
    } catch (err) {
      showToast(err.message || 'Failed to upload profile picture', 'error')
    } finally {
      setIsUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  // Handle Resume File Upload directly to DB & R2
  const handleResumeFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      showToast('Resume file must be under 10MB', 'error')
      return
    }

    setIsUploadingResume(true)
    try {
      await uploadUserResume(file)
      showToast(`Resume "${file.name}" saved securely in database!`)
    } catch (err) {
      showToast(err.message || 'Failed to upload resume file', 'error')
    } finally {
      setIsUploadingResume(false)
      if (resumeInputRef.current) resumeInputRef.current.value = ''
    }
  }

  // Handle View / Download Resume from DB
  const handleViewResume = (e) => {
    if (e) e.stopPropagation()
    if (!user?.resumeFileName && !user?.resumeUrl) {
      showToast('No resume document uploaded yet', 'error')
      return
    }

    let targetUrl = user?.resumeUrl
    if (!targetUrl) {
      const cleanFilename = (user?.resumeFileName || '').replace(/^resumes\//, '')
      targetUrl = `/api/profile/resume/${encodeURIComponent(cleanFilename)}`
    }

    const separator = targetUrl.includes('?') ? '&' : '?'
    const fullUrl = `${getApiUrl(targetUrl)}${separator}token=${encodeURIComponent(token || '')}`
    window.open(fullUrl, '_blank')
  }

  // Edit Career Info Modal/Inline state
  const [isEditingCareer, setIsEditingCareer] = useState(false)
  const [careerFields, setCareerFields] = useState({
    careerStage: user?.careerStage || 'Student / Undergraduate',
    field: user?.field || 'Software Engineering',
    experienceLevel: user?.experienceLevel || 'Beginner',
  })

  // Sync Career Fields with user
  useEffect(() => {
    if (user) {
      setCareerFields({
        careerStage: user.careerStage || 'Student / Undergraduate',
        field: user.field || 'Software Engineering',
        experienceLevel: user.experienceLevel || 'Beginner',
      })
    }
  }, [user])

  // Handle Career Info Save to DB
  const handleSaveCareer = async (e) => {
    e.preventDefault()
    setIsSavingCareer(true)
    try {
      await updateUserProfile({
        careerStage: careerFields.careerStage,
        field: careerFields.field,
        experienceLevel: careerFields.experienceLevel,
      })
      setIsEditingCareer(false)
      showToast('Career information saved to database!')
    } catch (err) {
      showToast(err.message || 'Failed to save career details', 'error')
    } finally {
      setIsSavingCareer(false)
    }
  }

  // Career Interests state from DB
  const careerInterests = Array.isArray(user?.careerInterests)
    ? user.careerInterests
    : ['Full Stack Development', 'AI Engineering']

  const [isAddingInterest, setIsAddingInterest] = useState(false)
  const [newInterestInput, setNewInterestInput] = useState('')

  // Handle Add Career Interest to DB
  const handleAddInterest = async (e) => {
    e.preventDefault()
    const clean = newInterestInput.trim()
    if (!clean) return

    if (careerInterests.includes(clean)) {
      showToast('Career interest already added', 'error')
      return
    }

    try {
      await updateUserInterests({ action: 'add', interest: clean })
      setNewInterestInput('')
      setIsAddingInterest(false)
      showToast(`Interest "${clean}" added!`)
    } catch (err) {
      showToast(err.message || 'Failed to add career interest', 'error')
    }
  }

  // Handle Remove Career Interest from DB
  const handleRemoveInterest = async (interestToRemove) => {
    try {
      await updateUserInterests({ action: 'remove', interest: interestToRemove })
      showToast(`Removed "${interestToRemove}"`)
    } catch (err) {
      showToast(err.message || 'Failed to remove career interest', 'error')
    }
  }

  // Connected Profiles states from DB
  const isGithubConnected = Boolean(user?.github?.connected)
  const githubUsername = user?.github?.username || 'Not Connected'
  const githubRepoCount = isGithubConnected
    ? `${user.github.publicRepos || user.github.repos?.length || 0} Repositories`
    : 'Not Synced'
  const githubProfileUrl = user?.github?.profileUrl || (user?.github?.username ? `https://github.com/${user.github.username}` : '#')

  const isLinkedinConnected = Boolean(user?.linkedin?.connected)
  const linkedinName = user?.linkedin?.name || candidateName
  const linkedinUrl = user?.linkedin?.profileUrl || ''

  const [isConnectingLinkedin, setIsConnectingLinkedin] = useState(false)
  const [linkedinInput, setLinkedinInput] = useState('')

  const [isConnectingGithub, setIsConnectingGithub] = useState(false)
  const [githubInput, setGithubInput] = useState('')

  // Connect LinkedIn to DB
  const handleSaveLinkedin = async (e) => {
    e.preventDefault()
    if (!linkedinInput.trim()) return

    try {
      await updateUserLinkedin({
        profileUrl: linkedinInput.trim(),
        name: candidateName,
        action: 'connect',
      })
      setIsConnectingLinkedin(false)
      setLinkedinInput('')
      showToast('LinkedIn profile connected in database!')
    } catch (err) {
      showToast(err.message || 'Failed to connect LinkedIn', 'error')
    }
  }

  // Disconnect LinkedIn from DB
  const handleDisconnectLinkedin = async () => {
    const confirmDis = window.confirm('Are you sure you want to disconnect LinkedIn?')
    if (!confirmDis) return
    try {
      await updateUserLinkedin({ action: 'disconnect' })
      showToast('LinkedIn profile disconnected')
    } catch (err) {
      showToast(err.message || 'Failed to disconnect LinkedIn', 'error')
    }
  }

  // Connect GitHub to DB
  const handleSaveGithub = async (e) => {
    e.preventDefault()
    if (!githubInput.trim()) return

    try {
      await connectUserGithub(githubInput.trim())
      setIsConnectingGithub(false)
      setGithubInput('')
      showToast(`GitHub account @${githubInput.trim()} connected and repos synced!`)
    } catch (err) {
      showToast(err.message || 'Failed to connect GitHub account', 'error')
    }
  }

  // Disconnect GitHub from DB
  const handleDisconnectGithub = async () => {
    const confirmDis = window.confirm('Are you sure you want to disconnect GitHub?')
    if (!confirmDis) return
    try {
      await disconnectUserGithub()
      showToast('GitHub disconnected from your profile')
    } catch (err) {
      showToast(err.message || 'Failed to disconnect GitHub', 'error')
    }
  }

  // Skills state from DB
  const skills = user?.skills && Array.isArray(user.skills) && user.skills.length > 0
    ? user.skills
    : ['React', 'Database Architecture', 'Node.js', 'SQL', 'Java', 'Python', 'Git', 'REST APIs']

  const [isAddingSkill, setIsAddingSkill] = useState(false)
  const [newSkillInput, setNewSkillInput] = useState('')

  // Add Skill to DB
  const handleAddSkill = async (skillToAdd) => {
    const clean = (typeof skillToAdd === 'string' ? skillToAdd : newSkillInput).trim()
    if (!clean) return

    if (skills.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      showToast('Skill already in your profile', 'error')
      return
    }

    try {
      await updateUserSkills({ action: 'add', skill: clean })
      setNewSkillInput('')
      setIsAddingSkill(false)
      showToast(`Skill "${clean}" saved to database!`)
    } catch (err) {
      showToast(err.message || 'Failed to add skill', 'error')
    }
  }

  // Remove Skill from DB
  const handleRemoveSkill = async (skillToRemove) => {
    try {
      await updateUserSkills({ action: 'remove', skill: skillToRemove })
      showToast(`Removed skill "${skillToRemove}"`)
    } catch (err) {
      showToast(err.message || 'Failed to remove skill', 'error')
    }
  }

  // Handle Disable Multi-Factor Authentication
  const handleDisable2FA = async () => {
    const confirmDisable = window.confirm(
      'Are you sure you want to disable Multi-Factor Authentication (2FA)? Your account will only be protected by your password.'
    )
    if (!confirmDisable) return

    setIsDisablingMfa(true)
    try {
      await disable2FA()
      showToast('Two-factor authentication disabled successfully')
    } catch (err) {
      showToast(err.message || 'Failed to disable two-factor authentication', 'error')
    } finally {
      setIsDisablingMfa(false)
    }
  }

  // Handle Logout
  const handleLogout = () => {
    const confirmLogout = window.confirm('Are you sure you want to log out of HireMind?')
    if (confirmLogout) {
      logout()
      navigate('/login')
    }
  }

  return (
    <div className="prof-page">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className={`prof-toast prof-toast--${toastMessage.type}`} role="alert">
          <span>{toastMessage.text}</span>
          <button type="button" onClick={() => setToastMessage(null)} className="prof-toast-close">
            ✕
          </button>
        </div>
      )}

      {/* Background ambience */}
      <div className="prof-bg-dots" aria-hidden="true" />
      <div className="prof-glow-orb prof-glow-orb--top" aria-hidden="true" />
      <div className="prof-glow-orb prof-glow-orb--bottom" aria-hidden="true" />

      {/* =====================================================================
          TOP APP HEADER
          ===================================================================== */}
      <Navbar
        logoRedirect="/dashboard"
        initial={candidateInitial}
        userName={candidateName}
        userEmail={candidateEmail}
      />

      {/* =====================================================================
          PAGE TITLE & LOGOUT BAR
          ===================================================================== */}
      <div className="prof-container">
        <div className="prof-title-row">
          <div className="prof-title-left">
            <button
              type="button"
              className="prof-back-btn"
              onClick={() => navigate('/dashboard')}
              title="Return to Dashboard"
            >
              <img src={backArrowIcon} alt="" className="prof-back-icon" />
              <span>BACK TO DASHBOARD</span>
            </button>
            <h1 className="prof-heading">My Profile</h1>
          </div>

          <div className="prof-title-right">
            <button type="button" className="prof-logout-btn" onClick={handleLogout} title="Log Out">
              <img src={logoutIcon} alt="" className="prof-logout-icon" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* =====================================================================
            1. HERO / PROFILE SUMMARY CARD (DYNAMIC DB SYNCED)
            ===================================================================== */}
        <section className="prof-hero-card">
          {/* Left: User Identity Info with Live Avatar Upload */}
          <div className="prof-hero-user">
            <div
              className="prof-avatar-wrap"
              onClick={() => avatarInputRef.current?.click()}
              title="Click to Change Profile Picture (JPG/PNG under 5MB)"
            >
              <input
                type="file"
                ref={avatarInputRef}
                onChange={handleAvatarChange}
                accept="image/png,image/jpeg,image/jpg"
                style={{ display: 'none' }}
              />

              {candidateAvatar ? (
                <img
                  src={candidateAvatar}
                  alt={candidateName}
                  className="prof-avatar-img"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div className="prof-avatar-initial">{candidateInitial}</div>
              )}

              {/* Hover overlay with camera icon */}
              <div className="prof-avatar-overlay">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>

              {isUploadingAvatar && (
                <div className="prof-avatar-loading">
                  <div className="prof-mini-spinner" />
                </div>
              )}

              <div className="prof-avatar-badge" title="Active Account" />
            </div>

            <div className="prof-hero-meta">
              {isEditingHero ? (
                <form className="prof-hero-edit-form" onSubmit={handleSaveHero}>
                  <div className="prof-hero-inputs-row">
                    <input
                      type="text"
                      className="prof-hero-input"
                      placeholder="First Name"
                      value={heroFields.firstName}
                      onChange={(e) => setHeroFields({ ...heroFields, firstName: e.target.value })}
                      required
                    />
                    <input
                      type="text"
                      className="prof-hero-input"
                      placeholder="Last Name"
                      value={heroFields.lastName}
                      onChange={(e) => setHeroFields({ ...heroFields, lastName: e.target.value })}
                    />
                  </div>
                  <input
                    type="text"
                    className="prof-hero-input prof-hero-input--full"
                    placeholder="Professional Title / Headline"
                    value={heroFields.title}
                    onChange={(e) => setHeroFields({ ...heroFields, title: e.target.value })}
                  />
                  <div className="prof-hero-form-actions">
                    <button type="submit" className="prof-btn-save prof-btn-save--sm">
                      Save
                    </button>
                    <button
                      type="button"
                      className="prof-btn-cancel prof-btn-cancel--sm"
                      onClick={() => setIsEditingHero(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="prof-name-row">
                    <h2 className="prof-user-name">{candidateName}</h2>
                    <span className="prof-tier-pill">{candidateTier}</span>
                    <button
                      type="button"
                      className="prof-hero-edit-btn"
                      onClick={() => setIsEditingHero(true)}
                      title="Edit Name & Headline"
                      aria-label="Edit Profile Details"
                    >
                      <img src={editIcon} alt="Edit" className="prof-hero-edit-icon" />
                    </button>
                  </div>
                  <p className="prof-user-subtitle">{candidateTitle}</p>
                  <div className="prof-email-pill">
                    <img src={emailIcon} alt="Email" className="prof-email-icon" />
                    <span>{candidateEmail}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: Dynamic Resume Card synced with MongoDB & Cloudflare R2 */}
          <div className="prof-resume-card">
            <input
              type="file"
              ref={resumeInputRef}
              onChange={handleResumeFileChange}
              accept=".pdf,.doc,.docx"
              style={{ display: 'none' }}
            />

            {/* Top Row: Status badge & Action buttons */}
            <div className="prof-resume-header">
              <div className="prof-resume-badge-group">
                <span className={`prof-resume-status-dot ${user?.resumeFileName ? 'is-active' : ''}`} />
                <span className="prof-resume-status-text">
                  {user?.resumeFileName ? 'ACTIVE RESUME' : 'NO RESUME'}
                </span>
              </div>

              <div className="prof-resume-actions">
                {user?.resumeFileName && (
                  <button
                    type="button"
                    className="prof-resume-action-pill prof-resume-action-pill--view"
                    onClick={handleViewResume}
                    title="View / Download Resume in browser"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <span>VIEW</span>
                  </button>
                )}
                <button
                  type="button"
                  className="prof-resume-action-pill prof-resume-action-pill--replace"
                  onClick={(e) => {
                    e.stopPropagation()
                    resumeInputRef.current?.click()
                  }}
                  disabled={isUploadingResume}
                  title="Upload or Replace Resume"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>{isUploadingResume ? 'UPLOADING...' : user?.resumeFileName ? 'REPLACE' : 'UPLOAD'}</span>
                </button>
              </div>
            </div>

            {/* Middle: File Presentation Box */}
            <div
              className="prof-resume-doc-row"
              onClick={handleViewResume}
              title={user?.resumeFileName ? 'Click to open resume' : 'Click to upload resume'}
            >
              <div className="prof-resume-doc-icon-box">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <div className="prof-resume-doc-details">
                <span className="prof-resume-doc-name" title={user?.resumeFileName || 'No file chosen'}>
                  {user?.resumeFileName ? user.resumeFileName.replace(/^resumes\//, '') : 'No resume uploaded yet'}
                </span>
                <span className="prof-resume-doc-meta">
                  {user?.resumeFileName ? 'Verified Candidate CV • Stored in Cloud' : 'Accepts PDF, DOC, DOCX up to 10MB'}
                </span>
              </div>
            </div>

            {/* Bottom: Interactive Dropzone Trigger */}
            <div
              className={`prof-resume-dropzone-cta ${isUploadingResume ? 'is-uploading' : ''}`}
              onClick={() => resumeInputRef.current?.click()}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                <path d="M12 12v9" />
                <path d="m16 16-4-4-4 4" />
              </svg>
              <span>
                {isUploadingResume
                  ? 'Saving document to secure storage...'
                  : 'Click or Drag & Drop to update CV (PDF, DOCX)'}
              </span>
            </div>
          </div>
        </section>

        {/* =====================================================================
            2. MIDDLE ROW (3 COLUMNS: Career Info, Career Interests, Connected Profiles)
            ===================================================================== */}
        <div className="prof-middle-grid">
          {/* CARD 1: Career Information (Dynamic Database Form) */}
          <section className="prof-card prof-card--career">
            <div className="prof-card-header">
              <div className="prof-card-title-group">
                <div className="prof-card-icon-wrap is-purple">
                  <img src={careerInfoIcon} alt="" className="prof-card-icon" />
                </div>
                <h3 className="prof-card-title">Career Information</h3>
              </div>
              <button
                type="button"
                className="prof-card-action-btn"
                onClick={() => setIsEditingCareer((prev) => !prev)}
                title="Edit Career Details"
                aria-label="Edit Career Information"
              >
                <img src={editIcon} alt="Edit" className="prof-action-icon" />
              </button>
            </div>

            {isEditingCareer ? (
              <form className="prof-career-edit-form" onSubmit={handleSaveCareer}>
                <div className="prof-edit-field">
                  <label className="prof-edit-label">CAREER STAGE</label>
                  <select
                    className="prof-edit-input prof-edit-select"
                    value={careerFields.careerStage}
                    onChange={(e) => setCareerFields({ ...careerFields, careerStage: e.target.value })}
                  >
                    {CAREER_STAGE_OPTIONS.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                    {!CAREER_STAGE_OPTIONS.includes(careerFields.careerStage) && (
                      <option value={careerFields.careerStage}>{careerFields.careerStage}</option>
                    )}
                  </select>
                </div>

                <div className="prof-edit-field">
                  <label className="prof-edit-label">FIELD</label>
                  <select
                    className="prof-edit-input prof-edit-select"
                    value={careerFields.field}
                    onChange={(e) => setCareerFields({ ...careerFields, field: e.target.value })}
                  >
                    {FIELD_OPTIONS.map((fld) => (
                      <option key={fld} value={fld}>
                        {fld}
                      </option>
                    ))}
                    {!FIELD_OPTIONS.includes(careerFields.field) && (
                      <option value={careerFields.field}>{careerFields.field}</option>
                    )}
                  </select>
                </div>

                <div className="prof-edit-field">
                  <label className="prof-edit-label">EXPERIENCE LEVEL</label>
                  <select
                    className="prof-edit-input prof-edit-select"
                    value={careerFields.experienceLevel}
                    onChange={(e) => setCareerFields({ ...careerFields, experienceLevel: e.target.value })}
                  >
                    {EXPERIENCE_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="prof-edit-actions">
                  <button type="submit" className="prof-btn-save" disabled={isSavingCareer}>
                    {isSavingCareer ? 'Saving...' : 'Save to DB'}
                  </button>
                  <button
                    type="button"
                    className="prof-btn-cancel"
                    onClick={() => setIsEditingCareer(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="prof-career-grid">
                <div className="prof-career-item">
                  <span className="prof-field-label">CAREER STAGE</span>
                  <span className="prof-field-val">{user?.careerStage || 'Not specified'}</span>
                </div>
                <div className="prof-career-item">
                  <span className="prof-field-label">FIELD</span>
                  <span className="prof-field-val">{user?.field || 'Not specified'}</span>
                </div>
                <div className="prof-career-item">
                  <span className="prof-field-label">EXPERIENCE LEVEL</span>
                  <span className="prof-field-val">{user?.experienceLevel || 'Beginner'}</span>
                </div>
              </div>
            )}
          </section>

          {/* CARD 2: Career Interests (Dynamic Database Interests) */}
          <section className="prof-card prof-card--interests">
            <div className="prof-card-header prof-interests-header">
              <div className="prof-interests-title-wrap">
                <h3 className="prof-interests-title">CAREER INTERESTS</h3>
              </div>
            </div>

            <div className="prof-interests-list">
              {careerInterests.map((interest) => (
                <div key={interest} className="prof-interest-pill">
                  <span>{interest}</span>
                  <button
                    type="button"
                    className="prof-interest-remove"
                    onClick={() => handleRemoveInterest(interest)}
                    title={`Remove ${interest}`}
                  >
                    ✕
                  </button>
                </div>
              ))}

              {isAddingInterest ? (
                <form className="prof-interest-add-form" onSubmit={handleAddInterest}>
                  <input
                    type="text"
                    className="prof-interest-input"
                    placeholder="e.g. Cloud Architecture, DevOps"
                    autoFocus
                    value={newInterestInput}
                    onChange={(e) => setNewInterestInput(e.target.value)}
                  />
                  <button type="submit" className="prof-interest-add-btn">
                    Add
                  </button>
                  <button
                    type="button"
                    className="prof-interest-cancel-btn"
                    onClick={() => setIsAddingInterest(false)}
                  >
                    ✕
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="prof-interest-pill prof-interest-pill--add"
                  onClick={() => setIsAddingInterest(true)}
                  title="Add new career interest"
                >
                  <span>Add Interest</span>
                  <span className="prof-interest-plus">+</span>
                </button>
              )}
            </div>
          </section>

          {/* CARD 3: Connected Profiles (Dynamic DB Integrations) */}
          <section className="prof-card prof-card--connected">
            <div className="prof-card-header">
              <div className="prof-card-title-group">
                <img src={connectedProfilesIcon} alt="" className="prof-card-icon" />
                <h3 className="prof-card-title">Connected Profiles</h3>
              </div>
            </div>

            <div className="prof-connected-list">
              {/* LinkedIn Row */}
              <div className="prof-connected-item">
                <div className="prof-connected-left">
                  <div className="prof-soc-icon-wrap linkedin">
                    <img src={linkedinIcon} alt="LinkedIn" className="prof-soc-icon" />
                  </div>
                  <div className="prof-soc-meta">
                    <span className="prof-soc-name">{isLinkedinConnected ? linkedinName : 'LinkedIn'}</span>
                    <span className={`prof-soc-status ${isLinkedinConnected ? 'is-connected' : 'is-disconnected'}`}>
                      {isLinkedinConnected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                </div>

                <div className="prof-soc-actions-right">
                  {isLinkedinConnected ? (
                    <>
                      {linkedinUrl && (
                        <a
                          href={linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="prof-soc-action"
                          title="Open LinkedIn Profile in new tab"
                        >
                          <img src={profileShowIcon} alt="View" className="prof-unlink-icon" />
                        </a>
                      )}
                      <button
                        type="button"
                        className="prof-soc-unlink-text-btn"
                        onClick={handleDisconnectLinkedin}
                        title="Disconnect LinkedIn"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="prof-soc-connect-btn"
                      onClick={() => setIsConnectingLinkedin((prev) => !prev)}
                      title="Connect LinkedIn"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>

              {/* Inline LinkedIn Connect Input */}
              {isConnectingLinkedin && (
                <form className="prof-connect-inline-form" onSubmit={handleSaveLinkedin}>
                  <input
                    type="text"
                    className="prof-connect-inline-input"
                    placeholder="https://linkedin.com/in/your-profile"
                    value={linkedinInput}
                    onChange={(e) => setLinkedinInput(e.target.value)}
                    autoFocus
                    required
                  />
                  <button type="submit" className="prof-connect-inline-submit">
                    Save
                  </button>
                  <button
                    type="button"
                    className="prof-connect-inline-cancel"
                    onClick={() => setIsConnectingLinkedin(false)}
                  >
                    ✕
                  </button>
                </form>
              )}

              {/* GitHub Row */}
              <div className="prof-connected-item">
                <div className="prof-connected-left">
                  <div className="prof-soc-icon-wrap github">
                    <img src={githubIcon} alt="GitHub" className="prof-soc-icon" />
                  </div>
                  <div className="prof-soc-meta">
                    <span className="prof-soc-name">{isGithubConnected ? `@${githubUsername}` : 'GitHub'}</span>
                    <span className={`prof-soc-status ${isGithubConnected ? 'is-connected' : 'is-disconnected'}`}>
                      {githubRepoCount}
                    </span>
                  </div>
                </div>

                <div className="prof-soc-actions-right">
                  {isGithubConnected ? (
                    <>
                      <a
                        href={githubProfileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="prof-soc-action"
                        title="View GitHub Profile in new tab"
                      >
                        <img src={profileShowIcon} alt="View" className="prof-unlink-icon" />
                      </a>
                      <button
                        type="button"
                        className="prof-soc-unlink-text-btn"
                        onClick={handleDisconnectGithub}
                        title="Disconnect GitHub"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="prof-soc-connect-btn"
                      onClick={() => setIsConnectingGithub((prev) => !prev)}
                      title="Connect GitHub Account"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>

              {/* Inline GitHub Connect Input */}
              {isConnectingGithub && (
                <form className="prof-connect-inline-form" onSubmit={handleSaveGithub}>
                  <input
                    type="text"
                    className="prof-connect-inline-input"
                    placeholder="GitHub username (e.g. octocat)"
                    value={githubInput}
                    onChange={(e) => setGithubInput(e.target.value)}
                    autoFocus
                    required
                  />
                  <button type="submit" className="prof-connect-inline-submit">
                    Connect
                  </button>
                  <button
                    type="button"
                    className="prof-connect-inline-cancel"
                    onClick={() => setIsConnectingGithub(false)}
                  >
                    ✕
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>

        {/* =====================================================================
            3. BOTTOM CARD: SKILLS & EXPERTISE (DYNAMIC DATABASE)
            ===================================================================== */}
        <section className="prof-card prof-card--skills">
          <div className="prof-card-header">
            <div className="prof-card-title-group">
              <img src={skillsIcon} alt="" className="prof-card-icon" />
              <h3 className="prof-card-title">Skills & Expertise</h3>
            </div>

            <button
              type="button"
              className="prof-add-skill-trigger"
              onClick={() => setIsAddingSkill((prev) => !prev)}
              title="Add a technical skill"
            >
              <img src={addIcon} alt="" className="prof-btn-add-icon" />
              <span>ADD SKILL</span>
            </button>
          </div>

          {isAddingSkill && (
            <div className="prof-add-skill-panel">
              <form
                className="prof-add-skill-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  handleAddSkill(newSkillInput)
                }}
              >
                <input
                  type="text"
                  className="prof-add-skill-input"
                  placeholder="e.g. Docker, GraphQL, Kubernetes, TypeScript"
                  autoFocus
                  value={newSkillInput}
                  onChange={(e) => setNewSkillInput(e.target.value)}
                  list="popular-skills-list"
                />
                <datalist id="popular-skills-list">
                  {POPULAR_SKILLS.filter((s) => !skills.includes(s)).map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>

                <button type="submit" className="prof-skill-submit-btn">
                  Add
                </button>
                <button
                  type="button"
                  className="prof-skill-close-btn"
                  onClick={() => setIsAddingSkill(false)}
                >
                  Cancel
                </button>
              </form>

              {/* Popular Skill Quick Suggestions */}
              <div className="prof-skill-suggestions">
                <span className="prof-suggestion-label">Suggestions:</span>
                <div className="prof-suggestion-chips">
                  {POPULAR_SKILLS.filter((s) => !skills.includes(s))
                    .slice(0, 8)
                    .map((suggestion) => (
                      <button
                        type="button"
                        key={suggestion}
                        className="prof-suggestion-chip"
                        onClick={() => handleAddSkill(suggestion)}
                      >
                        + {suggestion}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}

          <div className="prof-skills-wrap">
            {skills.map((skill) => (
              <div key={skill} className="prof-skill-chip">
                <span className="prof-skill-name">{skill}</span>
                <button
                  type="button"
                  className="prof-skill-del-btn"
                  onClick={() => handleRemoveSkill(skill)}
                  title={`Remove ${skill}`}
                  aria-label={`Remove ${skill}`}
                >
                  <img src={closeIcon} alt="Remove" className="prof-skill-del-icon" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* =====================================================================
            4. SECURITY: MULTI-FACTOR AUTHENTICATION (MFA) CARD
            ===================================================================== */}
        <section className="prof-card prof-card--mfa">
          <div className="prof-card-header">
            <div className="prof-card-title-group">
              <div className="prof-mfa-icon-box">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <div>
                <div className="prof-mfa-title-row">
                  <h3 className="prof-card-title">Multi-Factor Authentication (MFA)</h3>
                  <span className={`prof-mfa-status-pill ${user?.twoFactorEnabled ? 'is-enabled' : 'is-disabled'}`}>
                    {user?.twoFactorEnabled ? '● 2FA ENABLED' : '○ 2FA DISABLED'}
                  </span>
                </div>
                <p className="prof-mfa-desc">
                  {user?.twoFactorEnabled
                    ? `Fortified with time-based one-time password (TOTP). Verification frequency: ${
                        user.twoFactorFrequency === 'every_two_weeks'
                          ? 'Every 2 weeks (Trusted browser)'
                          : 'Every sign-in'
                      }.`
                    : 'Add an extra layer of security using Google Authenticator, Microsoft Authenticator, 2FAS, or 1Password.'}
                </p>
              </div>
            </div>

            <div className="prof-mfa-actions-wrap">
              {user?.twoFactorEnabled ? (
                <>
                  <button
                    type="button"
                    className="prof-mfa-action-btn prof-mfa-action-btn--reconfig"
                    onClick={() => setIsMfaModalOpen(true)}
                    title="Reconfigure Authenticator with new device or frequency"
                  >
                    RECONFIGURE
                  </button>
                  <button
                    type="button"
                    className="prof-mfa-action-btn prof-mfa-action-btn--disable"
                    onClick={handleDisable2FA}
                    disabled={isDisablingMfa}
                    title="Disable Two-Factor Authentication"
                  >
                    {isDisablingMfa ? 'DISABLING...' : 'DISABLE 2FA'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="prof-mfa-action-btn prof-mfa-action-btn--enable"
                  onClick={() => setIsMfaModalOpen(true)}
                  title="Enable Multi-Factor Authentication"
                >
                  ENABLE 2FA
                </button>
              )}
            </div>
          </div>
        </section>

        {/* =====================================================================
            5. DANGER ZONE: PERMANENT ACCOUNT DELETION
            ===================================================================== */}
        <section className="prof-card prof-card--danger">
          <div className="prof-card-header">
            <div className="prof-card-title-group">
              <div className="prof-danger-icon-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="prof-card-title" style={{ color: '#f87171' }}>Danger Zone</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                  Permanently delete your candidate profile, interview histories, and all stored data.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="prof-danger-btn"
              onClick={() => setIsDeleteModalOpen(true)}
              title="Permanently delete account"
            >
              DELETE ACCOUNT
            </button>
          </div>
        </section>
      </div>

      {/* Two-Factor Authentication Setup Modal */}
      <TwoFactorModal
        isOpen={isMfaModalOpen}
        onClose={() => setIsMfaModalOpen(false)}
        onSuccess={(msg) => showToast(msg)}
      />

      {/* High-Fidelity Delete Account Modal */}
      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      />
    </div>
  )
}
