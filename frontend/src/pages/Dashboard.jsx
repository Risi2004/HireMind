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
import './Dashboard.css'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // If authenticated user hasn't completed profile setup, navigate to profile setup
  useEffect(() => {
    if (user && !user.isProfileSetupCompleted) {
      navigate('/profile-setup')
    }
  }, [user, navigate])

  const candidateName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
    : 'Jazeel Jaufer'
  const candidateFirstName = user?.firstName || 'Jazeel'
  const candidateInitial = user?.firstName ? user.firstName[0].toUpperCase() : 'J'
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

  // Interview History items
  const recentHistory = [
    { id: 'r1', title: 'Software Engineer Intern', company: 'WSO2', track: 'Technical + HR', icon: company1Icon },
    { id: 'r2', title: 'Backend Developer', company: 'Sysco LABS', track: 'Technical Only', icon: company2Icon },
    { id: 'r3', title: 'Software Engineer Intern', company: 'WSO2', track: 'Technical + HR', icon: company1Icon },
    { id: 'r4', title: 'Backend Developer', company: 'Sysco LABS', track: 'Technical Only', icon: company2Icon },
  ]

  const last30DaysHistory = [
    { id: 'm1', title: 'Software Engineer Intern', company: 'WSO2', track: 'Technical + HR', icon: company1Icon },
    { id: 'm2', title: 'Backend Developer', company: 'Sysco LABS', track: 'Technical Only', icon: company2Icon },
    { id: 'm3', title: 'Software Engineer Intern', company: 'WSO2', track: 'Technical + HR', icon: company1Icon },
  ]

  // Recent Interview performance cards
  const performanceInterviews = [
    {
      id: 'p1',
      title: 'Software Engineer Intern',
      company: 'WSO2',
      track: 'Technical + HR',
      score: '84%',
      icon: company1Icon,
    },
    {
      id: 'p2',
      title: 'Backend Developer',
      company: 'Sysco LABS',
      track: 'Technical Only',
      score: '79%',
      icon: company2Icon,
    },
    {
      id: 'p3',
      title: 'Full Stack Engineer Intern',
      company: 'IFS',
      track: 'Technical',
      score: '94%',
      icon: company1Icon,
    },
  ]

  // Filter history based on search query
  const filteredRecent = recentHistory.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.track.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredLast30 = last30DaysHistory.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.track.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
                      onClick={() => navigate('/profile-setup')}
                    >
                      <div className="dash-history-card__icon-box">
                        <img src={item.icon} alt="" className="dash-company-icon" />
                      </div>
                      <div className="dash-history-card__info">
                        <span className="dash-history-card__title">{item.title}</span>
                        <span className="dash-history-card__subtitle">
                          {item.company} • {item.track}
                        </span>
                      </div>
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
                      onClick={() => navigate('/profile-setup')}
                    >
                      <div className="dash-history-card__icon-box">
                        <img src={item.icon} alt="" className="dash-company-icon" />
                      </div>
                      <div className="dash-history-card__info">
                        <span className="dash-history-card__title">{item.title}</span>
                        <span className="dash-history-card__subtitle">
                          {item.company} • {item.track}
                        </span>
                      </div>
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
            <h1 className="dash-welcome__title">Welcome Back, {candidateFirstName}</h1>
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
                  onClick={() => navigate('/new-interview')}
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
              {performanceInterviews.map((item) => (
                <div key={item.id} className="dash-interview-row">
                  <div className="dash-interview-row__left">
                    <div className="dash-interview-row__icon-box">
                      <img src={item.icon} alt="" className="dash-company-icon" />
                    </div>
                    <div className="dash-interview-row__details">
                      <span className="dash-interview-row__title">{item.title}</span>
                      <span className="dash-interview-row__subtitle">
                        {item.company} • {item.track}
                      </span>
                    </div>
                  </div>

                  <div className="dash-interview-row__right">
                    <span className="dash-score-pill">Score: {item.score}</span>
                    <button
                      type="button"
                      className="dash-action-circle-btn"
                      onClick={() => navigate('/profile-setup')}
                      title="Review Session"
                      aria-label="Review Session Details"
                    >
                      <img src={arrow2Icon} alt="" className="dash-arrow-diag" />
                    </button>
                  </div>
                </div>
              ))}
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
    </div>
  )
}
