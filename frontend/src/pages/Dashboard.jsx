import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import brandMarkImg from '../assets/images/3.png'
import userAvatarImg from '../assets/images/Frame 230.png'
import company1Icon from '../assets/icons/company1.svg'
import company2Icon from '../assets/icons/company2.svg'
import searchIcon from '../assets/icons/search.svg'
import tickIcon from '../assets/icons/tick.svg'
import arrowIcon from '../assets/icons/arrow.svg'
import arrow2Icon from '../assets/icons/arrow2.svg'
import problemSolvingIcon from '../assets/icons/problem solving.svg'
import profileIcon from '../assets/icons/profile.svg'
import communicationIcon from '../assets/icons/communication.svg'
import languageIcon from '../assets/icons/language.svg'
import chatbotIcon from '../assets/icons/chatbot.svg'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { getAllInterviewSessions, createInterviewSession, deleteInterviewSession } from '../utils/interviewUtils'
import './Dashboard.css'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Delete modal state
  const [sessionToDelete, setSessionToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // If authenticated user hasn't completed profile setup, navigate to profile setup
  useEffect(() => {
    if (user && !user.isProfileSetupCompleted) {
      navigate('/profile-setup')
    }
  }, [user, navigate])

  const candidateFullName = (() => {
    if (!user) return 'Jazeel Jaufer'
    const nameParts = [user.firstName, user.lastName]
      .filter(Boolean)
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0)
    if (nameParts.length > 0) {
      return nameParts.join(' ')
    }
    if (user.name && typeof user.name === 'string' && user.name.trim()) {
      return user.name.trim().replace(/\s+/g, ' ')
    }
    return user.email || 'Candidate'
  })()
  const candidateName = candidateFullName
  const candidateFirstName = user?.firstName?.trim() || candidateFullName.split(' ')[0] || 'Jazeel'
  const candidateInitial = candidateFirstName ? candidateFirstName[0].toUpperCase() : 'J'
  const candidateEmail = user?.email || 'jazeel.jaufer@example.com'

  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: `Hi ${candidateFirstName}! I've analyzed your recent 84% score at WSO2. Want to discuss how to improve your Communication score?`,
      time: 'Just now',
    },
  ])

  // Dynamic Interview History sessions from persistent storage
  const [interviews, setInterviews] = useState(() => getAllInterviewSessions())

  useEffect(() => {
    const handleUpdate = () => {
      setInterviews(getAllInterviewSessions())
    }
    window.addEventListener('hiremind_interviews_updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('hiremind_interviews_updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  // Recent Interview performance cards derived from persistent sessions
  const performanceInterviews = interviews.slice(0, 3).map((item, idx) => ({
    ...item,
    score: item.score || (idx === 0 ? '84%' : idx === 1 ? '79%' : '94%'),
  }))

  // Filter history based on search query
  const filteredInterviews = interviews.filter((item) => {
    const q = searchQuery.toLowerCase()
    return (
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.targetRole && item.targetRole.toLowerCase().includes(q)) ||
      (item.company && item.company.toLowerCase().includes(q)) ||
      (item.track && item.track.toLowerCase().includes(q))
    )
  })

  const filteredRecent = filteredInterviews.slice(0, 4)
  const filteredLast30 = filteredInterviews.slice(4)

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!chatInput.trim()) return

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: chatInput,
      time: 'Now',
    }

    setChatMessages((prev) => [...prev, userMsg])
    const currentQuestion = chatInput
    setChatInput('')

    // Simulated intelligent AI response
    setTimeout(() => {
      let botReply =
        "Great question! In technical behavioral rounds, structure your answers using the STAR method (Situation, Task, Action, Result). Focus especially on the quantifiable impact of your 'Action'."
      if (currentQuestion.toLowerCase().includes('score') || currentQuestion.toLowerCase().includes('wso2')) {
        botReply =
          'Your technical accuracy on system design was strong (89%). To raise communication to 95%, reduce pauses and summarize your solution before diving into code.'
      } else if (currentQuestion.toLowerCase().includes('spring') || currentQuestion.toLowerCase().includes('backend')) {
        botReply =
          'For Spring Boot, expect questions on Inversion of Control, transaction propagation, and Hibernate N+1 query resolution.'
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: botReply,
          time: 'Just now',
        },
      ])
    }, 900)
  }

  const handleDeleteClick = (e, item) => {
    e.stopPropagation()
    setSessionToDelete(item)
  }

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return
    setIsDeleting(true)
    try {
      await deleteInterviewSession(sessionToDelete.id)
      setSessionToDelete(null)
    } catch (err) {
      console.error('Failed to delete interview:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancelDelete = () => {
    if (isDeleting) return
    setSessionToDelete(null)
  }

  return (
    <div className="dash-page">
      {/* Top Application Header */}
      <Navbar
        logoRedirect="/"
        showChatBot={true}
        isChatOpen={isChatOpen}
        onChatToggle={() => setIsChatOpen((prev) => !prev)}
        initial={candidateInitial}
        userName={candidateName}
        userEmail={candidateEmail}
      />

      {/* Main Dashboard Workspace (3-Column Grid Frame) */}
      <main className="dash-workspace">
        {/* ===================================================================
            COLUMN 1: Left History & Quick Search Sidebar
            =================================================================== */}
        <aside className="dash-sidebar" aria-label="Interview History">
          <div className="dash-search-box">
            <img src={searchIcon} alt="" className="dash-search-icon" aria-hidden="true" />
            <input
              type="text"
              className="dash-search-input"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="dash-history-scroll">
            {/* Section: Recent */}
            <div className="dash-history-section">
              <h3 className="dash-section-title">Recent</h3>
              <div className="dash-history-list">
                {filteredRecent.length > 0 ? (
                  filteredRecent.map((item) => (
                    <div
                      key={item.id}
                      className="dash-history-card"
                      onClick={() => navigate(item.lastVisitedPath || `/new-interview/${item.id}`)}
                      title={`Resume: ${item.title || item.targetRole} (${item.company || 'HireMind'})`}
                    >
                      <div className="dash-history-card__icon-box">
                        <img src={item.icon || company1Icon} alt="" className="dash-company-icon" />
                      </div>
                      <div className="dash-history-card__info">
                        <span className="dash-history-card__title">{item.title || item.targetRole}</span>
                        <span className="dash-history-card__subtitle">
                          {item.company} • {item.track || item.interviewType || 'Technical'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="dash-history-card__delete-btn"
                        onClick={(e) => handleDeleteClick(e, item)}
                        title={`Delete interview: ${item.title || item.targetRole}`}
                        aria-label="Delete interview"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="dash-history-empty">No recent matches</p>
                )}
              </div>
            </div>

            {/* Section: Last 30 days */}
            <div className="dash-history-section">
              <h3 className="dash-section-title">Last 30 days</h3>
              <div className="dash-history-list">
                {filteredLast30.length > 0 ? (
                  filteredLast30.map((item) => (
                    <div
                      key={item.id}
                      className="dash-history-card"
                      onClick={() => navigate(item.lastVisitedPath || `/new-interview/${item.id}`)}
                      title={`Resume: ${item.title || item.targetRole} (${item.company || 'HireMind'})`}
                    >
                      <div className="dash-history-card__icon-box">
                        <img src={item.icon || company1Icon} alt="" className="dash-company-icon" />
                      </div>
                      <div className="dash-history-card__info">
                        <span className="dash-history-card__title">{item.title || item.targetRole}</span>
                        <span className="dash-history-card__subtitle">
                          {item.company} • {item.track || item.interviewType || 'Technical'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="dash-history-card__delete-btn"
                        onClick={(e) => handleDeleteClick(e, item)}
                        title={`Delete interview: ${item.title || item.targetRole}`}
                        aria-label="Delete interview"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="dash-history-empty">No interviews found</p>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* ===================================================================
            COLUMN 2: Center Content (Hero Simulation Banner & Recent List)
            =================================================================== */}
        <section className="dash-main-col">
          {/* Welcome Headline */}
          <div className="dash-welcome">
            <h1 className="dash-welcome__title">Welcome Back, {candidateFullName}</h1>
            <p className="dash-welcome__desc">
              Ready to take another step toward your next opportunity? Your personalized dashboard is updated with your latest progress.
            </p>
          </div>

          {/* Hero Simulation Banner Card */}
          <div className="dash-hero-card">
            <div className="dash-hero-card__glow" aria-hidden="true" />
            <div className="dash-hero-card__content">
              <h2 className="dash-hero-card__headline">
                Ready for Your Next
                <br />
                Interview?
              </h2>
              <p className="dash-hero-card__subtext">
                Create a personalized interview simulation using your profile, target role, company, and specific job requirements.
              </p>

              <div className="dash-hero-card__actions">
                <button
                  type="button"
                  className="dash-hero-btn"
                  onClick={() => {
                    const newSession = createInterviewSession()
                    navigate(newSession.lastVisitedPath)
                  }}
                >
                  START NEW INTERVIEW
                  <img src={arrowIcon} alt="" className="dash-btn-arrow" aria-hidden="true" />
                </button>

                <div className="dash-hero-badges">
                  <span className="dash-pill-badge">
                    <img src={tickIcon} alt="" className="dash-tick-icon" />
                    RESUME
                  </span>
                  <span className="dash-pill-badge">
                    <img src={tickIcon} alt="" className="dash-tick-icon" />
                    LINKEDIN
                  </span>
                  <span className="dash-pill-badge">
                    <img src={tickIcon} alt="" className="dash-tick-icon" />
                    GITHUB
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Interviews Card List */}
          <div className="dash-recent-panel">
            <div className="dash-recent-panel__header">
              <h3 className="dash-recent-title">Recent Interviews</h3>
              <span className="dash-view-all-link" onClick={() => navigate('/profile-setup')}>
                VIEW ALL &gt;
              </span>
            </div>

            <div className="dash-recent-list">
              {performanceInterviews.length > 0 ? (
                performanceInterviews.map((item) => (
                  <div
                    key={item.id}
                    className="dash-interview-row"
                    onClick={() => navigate(item.lastVisitedPath || `/new-interview/${item.id}`)}
                    style={{ cursor: 'pointer' }}
                    title={`Resume: ${item.title || item.targetRole}`}
                  >
                    <div className="dash-interview-row__left">
                      <div className="dash-interview-row__icon-box">
                        <img src={item.icon || company1Icon} alt="" className="dash-company-icon" />
                      </div>
                      <div className="dash-interview-row__details">
                        <span className="dash-interview-row__title">{item.title || item.targetRole}</span>
                        <span className="dash-interview-row__subtitle">
                          {item.company} • {item.track || item.interviewType || 'Technical'}
                        </span>
                      </div>
                    </div>

                    <div className="dash-interview-row__right">
                      <span className="dash-score-pill">Score: {item.score}</span>
                      <button
                        type="button"
                        className="dash-action-circle-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(item.lastVisitedPath || `/new-interview/${item.id}`)
                        }}
                        title="Review / Resume Session"
                        aria-label="Review Session Details"
                      >
                        <img src={arrow2Icon} alt="" className="dash-arrow-diag" />
                      </button>
                      <button
                        type="button"
                        className="dash-delete-btn"
                        onClick={(e) => handleDeleteClick(e, item)}
                        title="Delete Interview & all related data"
                        aria-label={`Delete interview for ${item.title || item.targetRole}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748B' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>No recent interviews created yet.</p>
                  <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#475569' }}>
                    Click <strong>START NEW INTERVIEW</strong> above to begin your first session.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ===================================================================
            COLUMN 3: Right Panel (Continue Improving & Docked AI Chat Widget)
            =================================================================== */}
        <aside className="dash-insights-col" aria-label="Recommendations and Assistant">
          {/* Section: Continue Improving */}
          <div className="dash-improving-section">
            <h3 className="dash-improving-title">Continue Improving</h3>

            <div className="dash-improving-cards">
              {/* Card 1: Communication */}
              <div className="dash-improving-card dash-improving-card--red">
                <div className="dash-improving-card__header">
                  <span className="dash-improving-card__icon dash-improving-card__icon--red">
                    <img src={communicationIcon} alt="" className="dash-card-icon-img" />
                  </span>
                  <span className="dash-improving-card__tag dash-improving-card__tag--red">
                    Communication
                  </span>
                </div>
                <p className="dash-improving-card__body">
                  Improve answer structure and focus on reducing filler words.
                </p>
              </div>

              {/* Card 2: Spring Boot */}
              <div className="dash-improving-card dash-improving-card--blue">
                <div className="dash-improving-card__header">
                  <span className="dash-improving-card__icon dash-improving-card__icon--blue">
                    <img src={languageIcon} alt="" className="dash-card-icon-img" />
                  </span>
                  <span className="dash-improving-card__tag dash-improving-card__tag--blue">
                    Spring Boot
                  </span>
                </div>
                <p className="dash-improving-card__body">
                  Review dependency injection principles and REST API concepts.
                </p>
              </div>

              {/* Card 3: Problem Solving */}
              <div className="dash-improving-card dash-improving-card--light">
                <div className="dash-improving-card__header">
                  <span className="dash-improving-card__icon dash-improving-card__icon--gray">
                    <img src={problemSolvingIcon} alt="" className="dash-card-icon-img" />
                  </span>
                  <span className="dash-improving-card__tag dash-improving-card__tag--dark">
                    Problem Solving
                  </span>
                </div>
                <p className="dash-improving-card__body dash-improving-card__body--dark">
                  Practice explaining your thought process out loud before coding.
                </p>
                <button
                  type="button"
                  className="dash-practice-now-btn"
                  onClick={() => navigate('/profile-setup')}
                >
                  Practice Now
                </button>
              </div>
            </div>
          </div>

          {/* Docked AI Assistant Chatbot Widget */}
          {isChatOpen && (
            <div className="dash-chat-widget">
              <div className="dash-chat-widget__header">
                <div className="dash-chat-widget__header-bot">
                  <img src={chatbotIcon} alt="" className="dash-chat-bot-icon" />
                  <span className="dash-chat-title">AI Coach</span>
                </div>
                <button
                  type="button"
                  className="dash-chat-close-btn"
                  onClick={() => setIsChatOpen(false)}
                  aria-label="Close chat"
                  title="Close chat"
                >
                  ✕
                </button>
              </div>

              <div className="dash-chat-widget__body">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`dash-chat-bubble ${
                      msg.sender === 'user' ? 'dash-chat-bubble--user' : 'dash-chat-bubble--bot'
                    }`}
                  >
                    <p className="dash-chat-bubble__text">{msg.text}</p>
                  </div>
                ))}
              </div>

              <form className="dash-chat-widget__footer" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  className="dash-chat-input"
                  placeholder="Type here..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="dash-chat-send-btn"
                  aria-label="Send message"
                  title="Send"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </form>
            </div>
          )}
        </aside>
      </main>

      {/* Delete Confirmation Modal */}
      {sessionToDelete && (
        <div className="dash-modal-backdrop" onClick={handleCancelDelete}>
          <div className="dash-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dash-delete-modal__icon-wrap">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>

            <h3 className="dash-delete-modal__title">Delete Interview?</h3>
            <p className="dash-delete-modal__desc">
              Are you sure you want to delete <strong>{sessionToDelete.title || sessionToDelete.targetRole || 'this interview'}</strong>?
              <br />
              All associated data—including resume analysis, job description, chat history, and evaluation scores—will be permanently deleted from the database.
            </p>

            <div className="dash-delete-modal__actions">
              <button
                type="button"
                className="dash-delete-modal__cancel-btn"
                onClick={handleCancelDelete}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="dash-delete-modal__confirm-btn"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <span className="dash-delete-spinner" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    <span>Delete All Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
