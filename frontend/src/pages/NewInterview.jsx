import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import recordingDotIcon from '../assets/icons/recording.svg'
import attachmentIcon from '../assets/icons/attachment.svg'
import chatbotIcon from '../assets/icons/chatbot.svg'
import jdSkillsIcon from '../assets/icons/jdskills.svg'
import researchEngIcon from '../assets/icons/research engineering.svg'
import genQuestionsIcon from '../assets/icons/generating questions.svg'
import tick2Icon from '../assets/icons/tick2.svg'
import ProfileDropdown from '../components/ProfileDropdown'
import './NewInterview.css'

export default function NewInterview() {
  const navigate = useNavigate()

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
  const [isGithubConnected, setIsGithubConnected] = useState(false)
  const [showUrlModal, setShowUrlModal] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [activeMobileTab, setActiveMobileTab] = useState('setup') // 'setup' | 'gauge' | 'pipeline'

  const fileInputRef = useRef(null)

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
    navigate('/new-interview/token')
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedResume(file.name)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setUploadedResume(file.name)
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
            <h1 className="new-int-nav__title">Software Engineer Intern</h1>
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
          AI Stage
        </button>
        <button
          type="button"
          className={`new-int-mobile-tab ${activeMobileTab === 'pipeline' ? 'is-active' : ''}`}
          onClick={() => setActiveMobileTab('pipeline')}
        >
          Analysis Pipeline
        </button>
      </div>

      {/* =====================================================================
          MAIN COCKPIT WORKSPACE (3 Columns: Setup, Gauge, Pipeline)
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
              className={`new-int-start-btn ${isRecording ? 'is-active' : ''}`}
              onClick={handleStartToggle}
            >
              {isRecording ? 'Pause' : 'Start'}
            </button>
          </div>

          {/* Configuration Form Card */}
          <div className="new-int-card">
            {/* SELECTED RESUME */}
            <div className="new-int-field-group">
              <label className="new-int-label">SELECTED RESUME</label>
              <div
                className="new-int-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".pdf,.docx,.doc"
                  onChange={handleFileUpload}
                />
                <img src={attachmentIcon} alt="" className="new-int-dropzone__icon" />
                <div className="new-int-dropzone__title">
                  {uploadedResume ? uploadedResume : 'Upload Resume'}
                </div>
                <div className="new-int-dropzone__sub">
                  {uploadedResume ? 'Click to change file' : 'Drag & Drop or Click to Browse (PDF, DOCX)'}
                </div>
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

            {/* GitHub Card */}
            <div className="new-int-github-card">
              <div className="new-int-github-info">
                <svg className="new-int-github-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <span className="new-int-github-name">GitHub</span>
              </div>
              <button
                type="button"
                className={`new-int-github-btn ${isGithubConnected ? 'is-connected' : ''}`}
                onClick={() => setIsGithubConnected((prev) => !prev)}
              >
                {isGithubConnected ? 'CONNECTED' : 'SELECT'}
              </button>
            </div>
          </div>
        </section>

        {/* ===================================================================
            COLUMN 2: Center Stage AI Listening Gauge HUD
            =================================================================== */}
        <section
          className={`new-int-col new-int-col--gauge ${
            activeMobileTab === 'gauge' ? 'is-mobile-visible' : 'is-mobile-hidden'
          }`}
        >
          <div className="new-int-gauge-wrapper">
            <div className="new-int-listening-title">
              <span className="new-int-listening-dot" />
              AI is Listening...
            </div>

            {/* Circular Gauge Canvas / SVG Meter */}
            <div className={`new-int-gauge-circle ${isRecording ? 'is-pulsing' : ''}`}>
              <svg className="new-int-gauge-svg" viewBox="0 0 280 280" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Outermost ambient glow circle */}
                <circle cx="140" cy="140" r="136" stroke="rgba(56, 189, 248, 0.15)" strokeWidth="1" />

                {/* Dashed outer calibration ring */}
                <circle
                  cx="140"
                  cy="140"
                  r="124"
                  stroke="rgba(255, 255, 255, 0.35)"
                  strokeWidth="1.5"
                  strokeDasharray="4 6"
                />

                {/* Inner smooth ring */}
                <circle
                  cx="140"
                  cy="140"
                  r="108"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="1"
                />

                {/* Central Horizontal Axis Line */}
                <line
                  x1="26"
                  y1="140"
                  x2="254"
                  y2="140"
                  stroke="rgba(255, 255, 255, 0.65)"
                  strokeWidth="1.5"
                />

                {/* Left Origin Pivot Marker */}
                <circle cx="28" cy="140" r="3.5" fill="#E2E8F0" />

                {/* Center Pivot Marker */}
                <circle cx="140" cy="140" r="2.5" fill="rgba(255, 255, 255, 0.7)" />

                {/* Center Right Value: 0% */}
                <text
                  x="238"
                  y="134"
                  textAnchor="end"
                  fill="#E2E8F0"
                  fontSize="13"
                  fontFamily="inherit"
                  fontWeight="600"
                >
                  {isRecording ? `${Math.min(100, Math.floor((secondsElapsed % 30) * 3.3))}%` : '0%'}
                </text>
              </svg>

              {/* Gauge Center Wave Overlay when recording */}
              {isRecording && (
                <div className="new-int-gauge-wave" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              )}
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
            {/* Stage 1: Parsing Resume & Experience (DONE) */}
            <div className="new-int-pipe-card new-int-pipe-card--done">
              <div className="new-int-pipe-card__left">
                <div className="new-int-pipe-card__icon-wrap is-done">
                  <img src={tick2Icon} alt="" className="new-int-pipe-icon" />
                </div>
                <div className="new-int-pipe-card__title">Parsing Resume & Experience</div>
              </div>
              <div className="new-int-pipe-badge new-int-pipe-badge--done">DONE</div>
            </div>

            {/* Stage 2: Extracting Key Skills from JD (ANALYZING - ACTIVE) */}
            <div className="new-int-pipe-card new-int-pipe-card--active">
              <div className="new-int-pipe-card__main-row">
                <div className="new-int-pipe-card__left">
                  <div className="new-int-pipe-card__icon-wrap is-analyzing">
                    <img src={jdSkillsIcon} alt="" className="new-int-pipe-icon new-int-pipe-icon--spin" />
                  </div>
                  <div className="new-int-pipe-card__title">
                    Extracting Key Skills
                    <br />
                    from JD
                  </div>
                </div>
                <div className="new-int-pipe-badge new-int-pipe-badge--analyzing">ANALYZING</div>
              </div>

              {/* Gradient Progress Bar */}
              <div className="new-int-progress-bar">
                <div className="new-int-progress-fill" style={{ width: '68%' }} />
              </div>
            </div>

            {/* Stage 3: Researching Engineering Culture (QUEUED) */}
            <div className="new-int-pipe-card new-int-pipe-card--queued">
              <div className="new-int-pipe-card__left">
                <div className="new-int-pipe-card__icon-wrap is-queued">
                  <img src={researchEngIcon} alt="" className="new-int-pipe-icon" />
                </div>
                <div className="new-int-pipe-card__title">
                  Researching Engineering
                  <br />
                  Culture
                </div>
              </div>
              <div className="new-int-pipe-badge new-int-pipe-badge--queued">QUEUED</div>
            </div>

            {/* Stage 4: Generating Custom Questions (QUEUED) */}
            <div className="new-int-pipe-card new-int-pipe-card--queued">
              <div className="new-int-pipe-card__left">
                <div className="new-int-pipe-card__icon-wrap is-queued">
                  <img src={genQuestionsIcon} alt="" className="new-int-pipe-icon" />
                </div>
                <div className="new-int-pipe-card__title">
                  Generating Custom
                  <br />
                  Questions
                </div>
              </div>
              <div className="new-int-pipe-badge new-int-pipe-badge--queued">QUEUED</div>
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
