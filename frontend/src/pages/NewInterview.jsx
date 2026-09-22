import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import recordingDotIcon from '../assets/icons/recording.svg'
import attachmentIcon from '../assets/icons/attachment.svg'
import chatbotIcon from '../assets/icons/chatbot.svg'
import jdSkillsIcon from '../assets/icons/jdskills.svg'
import researchEngIcon from '../assets/icons/research engineering.svg'
import genQuestionsIcon from '../assets/icons/generating questions.svg'
import tick2Icon from '../assets/icons/tick2.svg'
import ProfileDropdown from '../components/ProfileDropdown'
import { useAuth } from '../context/AuthContext'
import { generateInterviewId, getInterviewSession, saveInterviewSession } from '../utils/interviewUtils'
import './NewInterview.css'

export default function NewInterview() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user: authUser, token: authToken } = useAuth()

  // Auto-generate unique ID if accessed at /new-interview directly
  useEffect(() => {
    if (!id) {
      navigate(`/new-interview/${generateInterviewId()}`, { replace: true })
    }
  }, [id, navigate])

  // Session recording state & timer
  const [isRecording, setIsRecording] = useState(false)
  const [secondsElapsed, setSecondsElapsed] = useState(0)

  // Form setup state
  const [targetRole, setTargetRole] = useState('')
  const [company, setCompany] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [interviewType, setInterviewType] = useState('Technical')
  const [difficulty, setDifficulty] = useState('Intermediate')
  const [duration, setDuration] = useState('30 min')
  const [uploadedResume, setUploadedResume] = useState(null)
  const [currentResumeFile, setCurrentResumeFile] = useState(null)
  const [isGithubConnected, setIsGithubConnected] = useState(false)
  const [showUrlModal, setShowUrlModal] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [activeMobileTab, setActiveMobileTab] = useState('setup') // 'setup' | 'gauge' | 'pipeline'
  const [useProfileResumeChoiceDismissed, setUseProfileResumeChoiceDismissed] = useState(false)

  // AI Resume Analysis State (Google ADK & Qwen 14B)
  const [isAnalyzingResume, setIsAnalyzingResume] = useState(false)
  const [resumeAnalysis, setResumeAnalysis] = useState(null)
  const [analysisError, setAnalysisError] = useState(null)

  const fileInputRef = useRef(null)
  const isLoadedRef = useRef(false)

  // Load existing session data on mount
  useEffect(() => {
    if (!id) return

    const session = getInterviewSession(id)
    if (session) {
      if (session.targetRole) setTargetRole(session.targetRole)
      if (session.company) setCompany(session.company)
      if (session.jobDescription) setJobDescription(session.jobDescription)
      if (session.interviewType) setInterviewType(session.interviewType)
      if (session.difficulty) setDifficulty(session.difficulty)
      if (session.duration) setDuration(session.duration)
      if (session.uploadedResume) setUploadedResume(session.uploadedResume)
      if (session.resumeAnalysis) setResumeAnalysis(session.resumeAnalysis)
      if (session.isGithubConnected !== undefined) setIsGithubConnected(session.isGithubConnected)
    }

    // Attempt to fetch from backend MongoDB as primary source of truth
    fetch(`http://localhost:5000/api/interview/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.success && data.session) {
          const s = data.session
          if (s.targetRole) setTargetRole(s.targetRole)
          if (s.company) setCompany(s.company)
          if (s.jobDescription) setJobDescription(s.jobDescription)
          if (s.interviewType) setInterviewType(s.interviewType)
          if (s.difficulty) setDifficulty(s.difficulty)
          if (s.duration) setDuration(s.duration)
          if (s.resumeFileName) setUploadedResume(s.resumeFileName.replace(/^resumes\//, ''))
          // Discard old mock fallbacks
          if (s.resumeAnalysis && !s.resumeAnalysis?.summary?.includes('Qualified software engineer')) {
            setResumeAnalysis(s.resumeAnalysis)
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        isLoadedRef.current = true
      })
  }, [id])

  // Auto-save any form changes to persistent storage
  useEffect(() => {
    if (!id || !isLoadedRef.current) return

    saveInterviewSession({
      id,
      targetRole: targetRole || '',
      company: company || '',
      jobDescription,
      interviewType,
      difficulty,
      duration,
      uploadedResume,
      resumeAnalysis,
      isGithubConnected,
      status: isAnalyzingResume ? 'analyzing_resume' : 'setup',
      lastVisitedPath: `/new-interview/${id}`,
    })
  }, [id, targetRole, company, jobDescription, interviewType, difficulty, duration, uploadedResume, resumeAnalysis, isGithubConnected, isAnalyzingResume])

  // Live timer effect
  useEffect(() => {
    let interval = null
    if (isRecording) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRecording])

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const handleStartToggle = () => {
    if (isAnalyzingResume) return // Disabled during active resume parsing
    const interviewId = id || generateInterviewId()
    saveInterviewSession({
      id: interviewId,
      targetRole: targetRole || 'New Interview',
      company: company || '',
      jobDescription,
      interviewType,
      difficulty,
      duration,
      uploadedResume,
      resumeAnalysis,
      isGithubConnected,
      status: 'in_progress',
      lastVisitedPath: `/new-interview/${interviewId}/room`,
    })
    navigate(`/new-interview/${interviewId}/room`)
  }

  // Trigger Google ADK Resume Analyzer via Backend
  const triggerResumeAnalysis = async (file, useProfile = false) => {
    if (!file && !useProfile) return

    setIsAnalyzingResume(true)
    setAnalysisError(null)

    if (file) setCurrentResumeFile(file)
    const displayFilename = file ? file.name : (authUser?.resumeFileName?.replace(/^resumes\//, '') || 'Profile_Resume.pdf')
    setUploadedResume(displayFilename)

    try {
      const formData = new FormData()
      if (useProfile) {
        formData.append('useProfileResume', 'true')
        if (authUser?._id) formData.append('userId', authUser._id)
      } else {
        formData.append('resume', file)
      }
      if (authUser) {
        formData.append('candidateName', `${authUser.firstName || ''} ${authUser.lastName || ''}`.trim())
      }

      const activeToken = authToken || localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(`http://localhost:5000/api/interview/${id}/analyze-resume`, {
        method: 'POST',
        headers: {
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {})
        },
        body: formData,
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setResumeAnalysis(data.resumeAnalysis)
        setAnalysisError(null)
        if (data.resumeFileName) {
          setUploadedResume(data.resumeFileName.replace(/^resumes\//, ''))
        }
        // Auto-fill target role from resume if currently blank
        if (!targetRole && data.resumeAnalysis?.detected_role) {
          setTargetRole(data.resumeAnalysis.detected_role)
        }
      } else {
        // No silent fallback — display exact error from AI service
        setResumeAnalysis(null)
        const errMsg = data.message || `Analysis failed (${res.status}): AI service unreachable.`
        setAnalysisError(errMsg)
        console.error('Resume analyzer error:', errMsg)
      }
    } catch (err) {
      // Network or connection error to backend
      setResumeAnalysis(null)
      const errMsg = `Could not reach backend service: ${err.message}`
      setAnalysisError(errMsg)
      console.error('Resume analyzer network error:', errMsg)
    } finally {
      setIsAnalyzingResume(false)
    }
  }

  const handleViewProfileResume = (e) => {
    if (e) e.stopPropagation()
    if (!authUser?.resumeFileName && !authUser?.resumeUrl) return

    const activeToken = authToken || localStorage.getItem('hiremind_token') || localStorage.getItem('token')
    let targetUrl = authUser?.resumeUrl
    if (!targetUrl) {
      const cleanFilename = (authUser?.resumeFileName || '').replace(/^resumes\//, '')
      targetUrl = `/api/profile/resume/${encodeURIComponent(cleanFilename || 'view')}`
    }

    const separator = targetUrl.includes('?') ? '&' : '?'
    const baseBackend = 'http://localhost:5000'
    const fullUrl = targetUrl.startsWith('http')
      ? targetUrl
      : `${baseBackend}${targetUrl}${separator}token=${encodeURIComponent(activeToken || '')}`

    window.open(fullUrl, '_blank', 'noopener,noreferrer')
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      triggerResumeAnalysis(file, false)
    }
  }

  const handleRemoveResume = (e) => {
    if (e) e.stopPropagation()
    setUploadedResume(null)
    setResumeAnalysis(null)
    setCurrentResumeFile(null)
    setAnalysisError(null)
    setUseProfileResumeChoiceDismissed(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      triggerResumeAnalysis(file, false)
    }
  }

  const handlePasteUrlSubmit = (e) => {
    e.preventDefault()
    if (urlInput.trim()) {
      setJobDescription((prev) =>
        prev
          ? `${prev}\n\n[Imported from ${urlInput.trim()}]\nResponsibilities: Designing distributed microservices, optimizing APIs, collaborating with cross-functional product teams.`
          : `[Imported from ${urlInput.trim()}]\nLooking for an enthusiastic engineer with strong computer science fundamentals, system design proficiency, and agile development experience.`
      )
      setUrlInput('')
      setShowUrlModal(false)
    }
  }

  // Sequential onboarding & calibration progress
  const hasResume = Boolean(uploadedResume && String(uploadedResume).trim())
  const hasResumeReady = Boolean(hasResume && resumeAnalysis && !analysisError)
  const hasRole = Boolean(targetRole && targetRole.trim())
  const hasCompany = Boolean(company && company.trim())
  const hasJd = Boolean(jobDescription && jobDescription.trim())

  let completedStepsCount = 0
  if (hasResumeReady) completedStepsCount++
  if (hasRole) completedStepsCount++
  if (hasCompany) completedStepsCount++
  if (hasJd) completedStepsCount++

  const setupPercent = completedStepsCount * 25
  const isSetupComplete = setupPercent === 100

  // 1: Resume -> 2: Role -> 3: Company -> 4: Job Description -> 5: Ready
  const currentStep = !hasResumeReady ? 1 : !hasRole ? 2 : !hasCompany ? 3 : !hasJd ? 4 : 5

  const stepDetails = isAnalyzingResume
    ? {
        badge: 'AI RESUME ANALYZER ACTIVE',
        headline: 'Extracting Skills & Experience...',
        subtext: 'Google ADK Resume Analyzer agent is processing your resume with Qwen 14B. You can type your Target Role, Company, and JD in the meantime.',
      }
    : analysisError
    ? {
        badge: 'AI SERVICE ERROR',
        headline: 'Resume Analysis Incomplete',
        subtext: analysisError,
      }
    : {
        1: {
          badge: 'STEP 1 OF 4',
          headline: 'Upload Your Resume to Begin',
          subtext: 'Upload your resume (PDF or DOCX). HireMind AI analyzes your experience to personalize interview questions.',
        },
        2: {
          badge: 'STEP 2 OF 4',
          headline: 'Enter Your Target Role',
          subtext: 'Specify the job position you are interviewing for (e.g. Backend Developer, Full Stack Engineer).',
        },
        3: {
          badge: 'STEP 3 OF 4',
          headline: 'Specify the Target Company',
          subtext: 'Enter the company name (e.g. WSO2, Google, Sysco) to calibrate behavioral & culture expectations.',
        },
        4: {
          badge: 'STEP 4 OF 4',
          headline: 'Add Job Description (JD)',
          subtext: 'Paste key job requirements or import from a URL so the AI agent tests relevant technical competencies.',
        },
        5: {
          badge: 'CALIBRATION 100% COMPLETE',
          headline: 'Interview Cockpit Ready!',
          subtext: 'All candidate configurations are complete. Click "Start" to begin your interactive AI interview.',
        },
      }[currentStep]

  return (
    <div className="new-int-page">
      {/* Background Ambience */}
      <div className="new-int-bg" aria-hidden="true" />
      <div className="new-int-glow-orb new-int-glow-orb--top" aria-hidden="true" />
      <div className="new-int-glow-orb new-int-glow-orb--right" aria-hidden="true" />

      {/* =====================================================================
          TOP NAVIGATION BAR
          ===================================================================== */}
      <header className="new-int-nav">
        <div className="new-int-nav__left">
          <button
            type="button"
            className="new-int-nav__menu-btn"
            onClick={() => navigate('/dashboard')}
            title="Back to Dashboard"
            aria-label="Navigation Menu"
          >
            <svg width="20" height="15" viewBox="0 0 20 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1.5H19M1 7.5H19M1 13.5H19" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="new-int-nav__title-group">
            <h1 className="new-int-nav__title">{targetRole ? targetRole : (company ? `${company} Interview` : 'New Interview')}</h1>
          </div>
        </div>

        <div className="new-int-nav__right">
          {/* Chatbot Toggle Button */}
          <button
            type="button"
            className={`new-int-nav__icon-btn ${isChatOpen ? 'is-active' : ''}`}
            onClick={() => setIsChatOpen((prev) => !prev)}
            title="AI Coach Assistant"
            aria-label="Toggle AI Coach"
          >
            <img src={chatbotIcon} alt="Chatbot" className="new-int-nav__bot-icon" />
          </button>

          {/* Share Button */}
          <button
            type="button"
            className="new-int-nav__share-btn"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href)
                alert('Interview session link copied to clipboard!')
              }
            }}
            title="Share session"
          >
            <span>Share</span>
            <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 4.5C12 5.60457 11.1046 6.5 10 6.5C8.89543 6.5 8 5.60457 8 4.5C8 3.39543 8.89543 2.5 10 2.5C11.1046 2.5 12 3.39543 12 4.5Z"
                stroke="#94A3B8"
                strokeWidth="1.5"
              />
              <path
                d="M5 8.5C5 9.60457 4.10457 10.5 3 10.5C1.89543 10.5 1 9.60457 1 8.5C1 7.39543 1.89543 6.5 3 6.5C4.10457 6.5 5 7.39543 5 8.5Z"
                stroke="#94A3B8"
                strokeWidth="1.5"
              />
              <path
                d="M12 12.5C12 13.6046 11.1046 14.5 10 14.5C8.89543 14.5 8 13.6046 8 12.5C8 11.3954 8.89543 10.5 10 10.5C11.1046 10.5 12 11.3954 12 12.5Z"
                stroke="#94A3B8"
                strokeWidth="1.5"
              />
              <path d="M4.75 7.6L8.25 5.4M4.75 9.4L8.25 11.6" stroke="#94A3B8" strokeWidth="1.5" />
            </svg>
          </button>

          {/* User Profile Dropdown */}
          <ProfileDropdown />
        </div>
      </header>

      {/* Mobile View Switcher Tabs (Shown on small viewports <= 850px) */}
      <div className="new-int-mobile-tabs">
        <button
          type="button"
          className={`new-int-mobile-tab ${activeMobileTab === 'setup' ? 'is-active' : ''}`}
          onClick={() => setActiveMobileTab('setup')}
        >
          Interview Setup
        </button>
        <button
          type="button"
          className={`new-int-mobile-tab ${activeMobileTab === 'gauge' ? 'is-active' : ''}`}
          onClick={() => setActiveMobileTab('gauge')}
        >
          Setup Guide
        </button>
        <button
          type="button"
          className={`new-int-mobile-tab ${activeMobileTab === 'pipeline' ? 'is-active' : ''}`}
          onClick={() => setActiveMobileTab('pipeline')}
        >
          AI Pipeline
        </button>
      </div>

      {/* =====================================================================
          MAIN WORKSPACE (3 Columns: Setup, Sequential Guide HUD, Pipeline)
          ===================================================================== */}
      <div className="new-int-workspace">
        {/* ===================================================================
            COLUMN 1: Left Setup Panel & Session Controls
            =================================================================== */}
        <section
          className={`new-int-col new-int-col--setup ${
            activeMobileTab === 'setup' ? 'is-mobile-visible' : 'is-mobile-hidden'
          }`}
        >
          {/* Top Timer / Recording Bar */}
          <div className="new-int-ctrl-row">
            <div className={`new-int-rec-pill ${isRecording ? 'is-recording' : ''}`}>
              <span className="new-int-rec-dot-wrap">
                <img src={recordingDotIcon} alt="REC" className="new-int-rec-dot" />
              </span>
              <span className="new-int-rec-label">REC</span>
              <span className="new-int-rec-time">{formatTimer(secondsElapsed)}</span>
            </div>

            <button
              type="button"
              className={`new-int-start-btn ${isRecording ? 'is-active' : ''} ${isAnalyzingResume ? 'is-disabled' : ''}`}
              onClick={handleStartToggle}
              disabled={isAnalyzingResume || !isSetupComplete}
              title={
                isAnalyzingResume
                  ? 'Analyzing resume with AI agent... Start unlocks once analysis completes'
                  : !isSetupComplete
                  ? 'Complete all setup steps to enable Start'
                  : 'Start Interview'
              }
            >
              {isAnalyzingResume ? 'Parsing...' : isRecording ? 'Pause' : 'Start'}
            </button>
          </div>

          {/* Configuration Form Card */}
          <div className="new-int-card">
            {/* SIGNUP RESUME DETECTED BANNER */}
            {authUser?.resumeFileName && !uploadedResume && !useProfileResumeChoiceDismissed && (
              <div className="new-int-profile-resume-card">
                <div className="new-int-profile-resume-top">
                  <span className="new-int-profile-resume-dot" />
                  <span className="new-int-profile-resume-badge">SIGNUP RESUME DETECTED</span>
                </div>
                <div className="new-int-profile-resume-msg">
                  You uploaded <strong>{authUser.resumeFileName.replace(/^resumes\//, '')}</strong> during signup.
                  <br />
                  Would you like to analyze this resume or upload another?
                </div>
                <div className="new-int-profile-resume-actions-layout">
                  {/* Line 1: Full-width View Resume button */}
                  <button
                    type="button"
                    className="new-int-btn-profile-view new-int-btn-profile-view--full"
                    onClick={handleViewProfileResume}
                    title="View uploaded signup resume in a new tab"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <span>View Resume</span>
                  </button>

                  {/* Line 2: Use This Resume and Upload Another side-by-side */}
                  <div className="new-int-profile-resume-row">
                    <button
                      type="button"
                      className="new-int-btn-profile-use"
                      onClick={() => triggerResumeAnalysis(null, true)}
                      disabled={isAnalyzingResume}
                    >
                      {isAnalyzingResume ? 'Analyzing...' : 'Use This Resume'}
                    </button>
                    <button
                      type="button"
                      className="new-int-btn-profile-other"
                      onClick={() => {
                        setUseProfileResumeChoiceDismissed(true)
                        fileInputRef.current?.click()
                      }}
                      disabled={isAnalyzingResume}
                    >
                      Upload Another
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SELECTED RESUME */}
            <div className="new-int-field-group">
              <label className="new-int-label">SELECTED RESUME</label>
              <div
                className={`new-int-dropzone ${isAnalyzingResume ? 'is-analyzing' : ''} ${uploadedResume ? 'is-uploaded' : ''}`}
                onClick={() => !isAnalyzingResume && fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".pdf,.docx,.doc"
                  onChange={handleFileUpload}
                  disabled={isAnalyzingResume}
                />
                {isAnalyzingResume ? (
                  <div className="new-int-dropzone__loading">
                    <img src={jdSkillsIcon} alt="" className="new-int-pipe-icon--spin" width="26" height="26" />
                    <div className="new-int-dropzone__title">Analyzing Resume with AI Agent...</div>
                    <div className="new-int-dropzone__sub">Google ADK Agent & Qwen 14B extracting profile & skills</div>
                    <div className="new-int-dropzone__progress">
                      <div className="new-int-dropzone__bar" />
                    </div>
                  </div>
                ) : (
                  <>
                    <img src={attachmentIcon} alt="" className="new-int-dropzone__icon" />
                    <div className="new-int-dropzone__title">
                      {uploadedResume ? uploadedResume : 'Upload Resume'}
                    </div>
                    <div className="new-int-dropzone__sub">
                      {uploadedResume ? 'Click to change file (PDF, DOCX)' : 'Drag & Drop or Click to Browse (PDF, DOCX)'}
                    </div>
                    {uploadedResume && (
                      <div className="new-int-dropzone__actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="new-int-dropzone__view-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (currentResumeFile) {
                              const blobUrl = URL.createObjectURL(currentResumeFile)
                              window.open(blobUrl, '_blank', 'noopener,noreferrer')
                            } else {
                              handleViewProfileResume(e)
                            }
                          }}
                          title="View resume document in a new tab"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          <span>View Resume Document</span>
                        </button>
                        <button
                          type="button"
                          className="new-int-dropzone__remove-btn"
                          onClick={handleRemoveResume}
                          title="Remove selected resume"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                          <span>Remove CV</span>
                        </button>
                      </div>
                    )}
                    {resumeAnalysis?.skills?.technical?.length > 0 && (
                      <div className="new-int-dropzone__tags">
                        {resumeAnalysis.skills.technical.slice(0, 3).map((skill, idx) => (
                          <span key={idx} className="new-int-dropzone__tag">{skill}</span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* TARGET ROLE */}
            <div className="new-int-field-group">
              <label htmlFor="target-role" className="new-int-label">
                TARGET ROLE
              </label>
              <input
                id="target-role"
                type="text"
                className="new-int-input"
                placeholder="eg: Backend Developer"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              />
            </div>

            {/* COMPANY */}
            <div className="new-int-field-group">
              <label htmlFor="company-name" className="new-int-label">
                COMPANY
              </label>
              <input
                id="company-name"
                type="text"
                className="new-int-input"
                placeholder="eg: WSO2"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            {/* JOB DESCRIPTION */}
            <div className="new-int-field-group">
              <div className="new-int-label-row">
                <label htmlFor="job-desc" className="new-int-label">
                  JOB DESCRIPTION
                </label>
                <button
                  type="button"
                  className="new-int-paste-link"
                  onClick={() => setShowUrlModal(true)}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M8.5 2.5L13.5 7.5L6.5 14.5L1.5 9.5L8.5 2.5Z"
                      stroke="#38BDF8"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path d="M11 5L5 11" stroke="#38BDF8" strokeWidth="1.5" />
                  </svg>
                  <span>Paste URL</span>
                </button>
              </div>
              <textarea
                id="job-desc"
                className="new-int-textarea"
                rows="3"
                placeholder="Type Your Job Description"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>

            {/* INTERVIEW TYPE */}
            <div className="new-int-field-group">
              <label className="new-int-label">INTERVIEW TYPE</label>
              <div className="new-int-pills-row">
                {['Technical', 'HR', 'Coding', 'Mixed'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`new-int-pill ${interviewType === type ? 'is-active' : ''}`}
                    onClick={() => setInterviewType(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* DIFFICULTY */}
            <div className="new-int-field-group">
              <label className="new-int-label">DIFFICULTY</label>
              <div className="new-int-pills-row">
                {['Beginner', 'Intermediate', 'Advanced'].map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    className={`new-int-pill ${difficulty === diff ? 'is-active' : ''}`}
                    onClick={() => setDifficulty(diff)}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            {/* DURATION */}
            <div className="new-int-field-group">
              <label className="new-int-label">DURATION</label>
              <div className="new-int-pills-row">
                {['15 min', '30 min', '60 min'].map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    className={`new-int-pill ${duration === dur ? 'is-active' : ''}`}
                    onClick={() => setDuration(dur)}
                  >
                    {dur}
                  </button>
                ))}
              </div>
            </div>

            {/* GITHUB INTEGRATION */}
            <div className="new-int-github-card">
              <div className="new-int-github-info">
                <svg className="new-int-github-icon" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <div className="new-int-github-text">
                  <span className="new-int-github-name">GitHub</span>
                  <span className="new-int-github-sub">Connect repos for context</span>
                </div>
              </div>
              <button
                type="button"
                className={`new-int-github-btn ${isGithubConnected ? 'is-connected' : ''}`}
                onClick={() => setIsGithubConnected((prev) => !prev)}
                title={isGithubConnected ? 'Disconnect GitHub' : 'Select GitHub repository'}
              >
                {isGithubConnected ? (
                  <>
                    <span className="new-int-github-dot" />
                    CONNECTED
                  </>
                ) : (
                  'SELECT'
                )}
              </button>
            </div>
          </div>
        </section>

        {/* ===================================================================
            COLUMN 2: Center Interactive HUD & Sequential Calibration Progress
            =================================================================== */}
        <section
          className={`new-int-col new-int-col--hud ${
            activeMobileTab === 'gauge' ? 'is-mobile-visible' : 'is-mobile-hidden'
          }`}
        >
          <div className="new-int-hud-panel">
            {/* Top Interactive Banner / Stage Indicator */}
            <div className="new-int-hud-banner">
              <span className="new-int-hud-badge">
                <span className="new-int-hud-dot" />
                {stepDetails.badge}
              </span>
              <h2 className="new-int-hud-headline">{stepDetails.headline}</h2>
              <p className="new-int-hud-subtext">{stepDetails.subtext}</p>
            </div>

            {/* Circular Progress Gauge */}
            <div className="new-int-hud-gauge-wrap">
              <div className={`new-int-hud-circle ${isSetupComplete ? 'is-ready' : ''}`}>
                <svg className="new-int-hud-svg" viewBox="0 0 200 200">
                  {/* Track circle */}
                  <circle
                    className="new-int-hud-circle-bg"
                    cx="100"
                    cy="100"
                    r="86"
                    strokeWidth="10"
                  />
                  {/* Progress stroke */}
                  <circle
                    className="new-int-hud-circle-fg"
                    cx="100"
                    cy="100"
                    r="86"
                    strokeWidth="10"
                    strokeDasharray={540}
                    strokeDashoffset={540 - (540 * setupPercent) / 100}
                  />
                </svg>

                <div className="new-int-hud-content">
                  <div className="new-int-hud-percent">{setupPercent}%</div>
                  <div className="new-int-hud-status">
                    {isAnalyzingResume
                      ? 'ANALYZING...'
                      : analysisError
                      ? 'ACTION NEEDED'
                      : isSetupComplete
                      ? 'READY TO START'
                      : `${completedStepsCount} of 4 complete`}
                  </div>

                  <button
                    type="button"
                    className="new-int-hud-cta"
                    onClick={handleStartToggle}
                    disabled={isAnalyzingResume || !isSetupComplete}
                    title={
                      isAnalyzingResume
                        ? 'Analyzing resume with AI agent...'
                        : analysisError
                        ? 'Please resolve resume analysis error to enable Start'
                        : !isSetupComplete
                        ? 'Complete all setup steps to enable Start'
                        : 'Start Interview'
                    }
                  >
                    {isAnalyzingResume ? 'PARSING RESUME...' : 'START INTERVIEW'}
                  </button>
                </div>
              </div>
            </div>

            {/* Sequential Steps Track with Interactive Click Triggers */}
            <div className="new-int-steps-track">
              {/* Step 1: Upload Resume */}
              <div
                className={`new-int-step-item ${hasResumeReady ? 'is-done' : analysisError ? 'is-error' : currentStep === 1 ? 'is-active' : ''}`}
                onClick={() => !isAnalyzingResume && fileInputRef.current?.click()}
                title="Step 1: Upload Resume"
              >
                <div className="new-int-step-num">{hasResumeReady ? '✓' : analysisError ? '!' : '1'}</div>
                <div className="new-int-step-text">
                  <div className="new-int-step-title">1. Upload Resume</div>
                  <div className="new-int-step-sub">
                    {isAnalyzingResume
                      ? 'AI Agent analyzing file...'
                      : analysisError
                      ? 'Analysis error — click to retry or change file'
                      : hasResumeReady
                      ? uploadedResume
                      : 'Click to select or drag PDF / DOCX'}
                  </div>
                </div>
              </div>

              {/* Step 2: Target Role */}
              <div
                className={`new-int-step-item ${hasRole ? 'is-done' : currentStep === 2 ? 'is-active' : ''}`}
                onClick={() => document.getElementById('target-role')?.focus()}
                title="Step 2: Enter Target Role"
              >
                <div className="new-int-step-num">{hasRole ? '✓' : '2'}</div>
                <div className="new-int-step-text">
                  <div className="new-int-step-title">2. Target Role</div>
                  <div className="new-int-step-sub">
                    {hasRole ? targetRole : 'Specify position (e.g. Backend Developer)'}
                  </div>
                </div>
              </div>

              {/* Step 3: Company */}
              <div
                className={`new-int-step-item ${hasCompany ? 'is-done' : currentStep === 3 ? 'is-active' : ''}`}
                onClick={() => document.getElementById('company-name')?.focus()}
                title="Step 3: Enter Company Name"
              >
                <div className="new-int-step-num">{hasCompany ? '✓' : '3'}</div>
                <div className="new-int-step-text">
                  <div className="new-int-step-title">3. Company Name</div>
                  <div className="new-int-step-sub">
                    {hasCompany ? company : 'Company name (e.g. WSO2, Google)'}
                  </div>
                </div>
              </div>

              {/* Step 4: Job Description */}
              <div
                className={`new-int-step-item ${hasJd ? 'is-done' : currentStep === 4 ? 'is-active' : ''}`}
                onClick={() => document.getElementById('job-desc')?.focus()}
                title="Step 4: Job Description"
              >
                <div className="new-int-step-num">{hasJd ? '✓' : '4'}</div>
                <div className="new-int-step-text">
                  <div className="new-int-step-title">4. Job Description</div>
                  <div className="new-int-step-sub">
                    {hasJd ? 'Requirements & scope added' : 'Paste JD or import via URL'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            COLUMN 3: Right Pipeline Status Cards
            =================================================================== */}
        <section
          className={`new-int-col new-int-col--pipeline ${
            activeMobileTab === 'pipeline' ? 'is-mobile-visible' : 'is-mobile-hidden'
          }`}
        >
          <div className="new-int-pipeline-list">
            {/* Stage 1: Parsing Resume & Experience */}
            <div
              className={`new-int-pipe-card ${
                isAnalyzingResume
                  ? 'new-int-pipe-card--active'
                  : analysisError
                  ? 'new-int-pipe-card--error'
                  : hasResumeReady
                  ? 'new-int-pipe-card--done'
                  : 'new-int-pipe-card--queued'
              }`}
            >
              <div className="new-int-pipe-card__main-row">
                <div className="new-int-pipe-card__left">
                  <div
                    className={`new-int-pipe-card__icon-wrap ${
                      isAnalyzingResume
                        ? 'is-analyzing'
                        : analysisError
                        ? 'is-error'
                        : hasResumeReady
                        ? 'is-done'
                        : 'is-queued'
                    }`}
                  >
                    {analysisError && !isAnalyzingResume ? (
                      <span className="new-int-pipe-card__err-icon">✕</span>
                    ) : (
                      <img
                        src={isAnalyzingResume ? jdSkillsIcon : tick2Icon}
                        alt=""
                        className={`new-int-pipe-icon ${isAnalyzingResume ? 'new-int-pipe-icon--spin' : ''}`}
                      />
                    )}
                  </div>
                  <div className="new-int-pipe-card__title">
                    Parsing Resume & Experience
                    {analysisError && !isAnalyzingResume ? (
                      <div className="new-int-pipe-error-preview">
                        AI Service Unreachable / Failed
                      </div>
                    ) : hasResumeReady && resumeAnalysis?.skills?.technical?.length > 0 && !isAnalyzingResume ? (
                      <div className="new-int-pipe-skills-preview">
                        {resumeAnalysis.skills.technical.slice(0, 3).join(' • ')}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div
                  className={`new-int-pipe-badge ${
                    isAnalyzingResume
                      ? 'new-int-pipe-badge--analyzing'
                      : analysisError
                      ? 'new-int-pipe-badge--error'
                      : hasResumeReady
                      ? 'new-int-pipe-badge--done'
                      : 'new-int-pipe-badge--queued'
                  }`}
                >
                  {isAnalyzingResume ? 'ANALYZING' : analysisError ? 'ERROR' : hasResumeReady ? 'DONE' : 'WAITING'}
                </div>
              </div>

              {isAnalyzingResume && (
                <div className="new-int-progress-bar">
                  <div className="new-int-progress-fill is-pulsing" style={{ width: '75%' }} />
                </div>
              )}
            </div>

            {/* Stage 2: Extracting Key Skills from JD */}
            <div className={`new-int-pipe-card ${hasJd ? 'new-int-pipe-card--done' : hasResume ? 'new-int-pipe-card--active' : 'new-int-pipe-card--queued'}`}>
              <div className="new-int-pipe-card__main-row">
                <div className="new-int-pipe-card__left">
                  <div className={`new-int-pipe-card__icon-wrap ${hasJd ? 'is-done' : hasResume ? 'is-analyzing' : 'is-queued'}`}>
                    <img src={hasJd ? tick2Icon : jdSkillsIcon} alt="" className={`new-int-pipe-icon ${hasResume && !hasJd ? 'new-int-pipe-icon--spin' : ''}`} />
                  </div>
                  <div className="new-int-pipe-card__title">
                    Extracting Key Skills
                    <br />
                    from JD
                  </div>
                </div>
                <div className={`new-int-pipe-badge ${hasJd ? 'new-int-pipe-badge--done' : hasResume ? 'new-int-pipe-badge--analyzing' : 'new-int-pipe-badge--queued'}`}>
                  {hasJd ? 'DONE' : hasResume ? 'ANALYZING' : 'QUEUED'}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="new-int-progress-bar">
                <div className="new-int-progress-fill" style={{ width: hasJd ? '100%' : hasResume ? '45%' : '0%' }} />
              </div>
            </div>

            {/* Stage 3: Researching Engineering Culture */}
            <div className={`new-int-pipe-card ${hasCompany ? 'new-int-pipe-card--done' : 'new-int-pipe-card--queued'}`}>
              <div className="new-int-pipe-card__left">
                <div className={`new-int-pipe-card__icon-wrap ${hasCompany ? 'is-done' : 'is-queued'}`}>
                  <img src={hasCompany ? tick2Icon : researchEngIcon} alt="" className="new-int-pipe-icon" />
                </div>
                <div className="new-int-pipe-card__title">
                  Researching Engineering
                  <br />
                  Culture
                </div>
              </div>
              <div className={`new-int-pipe-badge ${hasCompany ? 'new-int-pipe-badge--done' : 'new-int-pipe-badge--queued'}`}>
                {hasCompany ? 'DONE' : 'QUEUED'}
              </div>
            </div>

            {/* Stage 4: Generating Custom Questions */}
            <div className={`new-int-pipe-card ${isSetupComplete ? 'new-int-pipe-card--active' : 'new-int-pipe-card--queued'}`}>
              <div className="new-int-pipe-card__left">
                <div className={`new-int-pipe-card__icon-wrap ${isSetupComplete ? 'is-analyzing' : 'is-queued'}`}>
                  <img src={genQuestionsIcon} alt="" className="new-int-pipe-icon" />
                </div>
                <div className="new-int-pipe-card__title">
                  Generating Custom
                  <br />
                  Questions
                </div>
              </div>
              <div className={`new-int-pipe-badge ${isSetupComplete ? 'new-int-pipe-badge--analyzing' : 'new-int-pipe-badge--queued'}`}>
                {isSetupComplete ? 'READY' : 'QUEUED'}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* URL Import Modal */}
      {showUrlModal && (
        <div className="new-int-modal-backdrop" onClick={() => setShowUrlModal(false)}>
          <div className="new-int-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="new-int-modal__title">Import Job Description from URL</h3>
            <p className="new-int-modal__desc">
              Paste the public job posting link (e.g. LinkedIn, Indeed, Company Careers).
            </p>
            <form onSubmit={handlePasteUrlSubmit}>
              <input
                type="url"
                required
                placeholder="https://company.com/careers/software-engineer"
                className="new-int-input new-int-modal__input"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                autoFocus
              />
              <div className="new-int-modal__actions">
                <button
                  type="button"
                  className="new-int-modal__cancel-btn"
                  onClick={() => setShowUrlModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="new-int-modal__submit-btn">
                  Fetch & Populate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating AI Chat Assistant Drawer (When Chatbot icon clicked) */}
      {isChatOpen && (
        <div className="new-int-chat-drawer">
          <div className="new-int-chat-header">
            <div className="new-int-chat-title">
              <img src={chatbotIcon} alt="" className="new-int-chat-bot-icon" />
              <span>HireMind AI Coach</span>
            </div>
            <button
              type="button"
              className="new-int-chat-close"
              onClick={() => setIsChatOpen(false)}
              aria-label="Close Chat"
            >
              ✕
            </button>
          </div>
          <div className="new-int-chat-body">
            <div className="new-int-chat-bubble bot">
              I am configuring your customized mock session for <strong>Software Engineer Intern</strong>. When you are ready, tap <strong>Start</strong> to begin simulated audio questions!
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
