import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import chatbotIcon from '../assets/icons/chatbot.svg'
import downloadIcon from '../assets/icons/download.svg'
import restartIcon from '../assets/icons/restart.svg'
import company1Icon from '../assets/icons/company1.svg'
import bulbIcon from '../assets/icons/bulb.svg'
import ProfileDropdown from '../components/ProfileDropdown'
import './InterviewReport.css'

export default function InterviewReport() {
  const navigate = useNavigate()
  const [activeTimeRange, setActiveTimeRange] = useState('15M')
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false)

  // Technical Skills Data
  const technicalSkills = [
    { name: 'REST APIs', score: 88, isFlagged: false },
    { name: 'Spring Boot', score: 82, isFlagged: false },
    { name: 'React', score: 80, isFlagged: false },
    { name: '!Database Design', score: 64, isFlagged: true },
    { name: '!System Design', score: 58, isFlagged: true },
  ]

  // Performance Breakdown Data
  const performanceBreakdown = [
    { name: 'Technical Knowledge', score: 82, isFlagged: false },
    { name: '!Communication', score: 68, isFlagged: true },
    { name: 'Problem Solving', score: 84, isFlagged: false },
    { name: 'Confidence', score: 72, isFlagged: false },
    { name: 'Behavioral', score: 80, isFlagged: false },
  ]

  // Communication Analysis Data
  const communicationAnalysis = [
    { name: 'Clarity', score: 78, isFlagged: false },
    { name: '!Answer Structure', score: 62, isFlagged: true },
    { name: 'Speaking Pace', score: 81, isFlagged: false },
    { name: 'Vocabulary', score: 74, isFlagged: false },
    { name: 'Confidence', score: 65, isFlagged: false },
  ]

  const handleDownloadTranscript = () => {
    const transcriptText = `INTERVIEW TRANSCRIPT - Software Engineer Intern (Backend Developer) - Microsoft
Score: 78% Readiness Score

"good morning, jazeel. thank you for joining the interview today. to begin, could you briefly introduce yourself and tell me about your experience in backend development?"
"i'm currently studying software engineering and have worked on several full-stack and backend-focused projects. i have experience working with node.js, express, mongodb, java, and spring boot. one of my recent projects involved building an ai-powered cloud deployment platform."

"that sounds interesting. can you explain one technical challenge you faced while developing that project and how you approached solving it?"
"one of the main challenges was handling deployment failures and identifying the actual cause from deployment logs. i designed a workflow that analyzes the logs, identifies possible issues, and suggests solutions based on available technical documentation."
`
    const blob = new Blob([transcriptText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'Interview_Transcript_Microsoft_Backend_Developer.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadRoadmap = () => {
    alert('Preparing your customized AI Improvement Roadmap (PDF)...')
  }

  return (
    <div className="rep-page">
      {/* Background Ambience */}
      <div className="rep-bg" aria-hidden="true" />
      <div className="rep-glow-orb rep-glow-orb--top" aria-hidden="true" />
      <div className="rep-glow-orb rep-glow-orb--bottom" aria-hidden="true" />

      {/* =====================================================================
          TOP NAVIGATION BAR
          ===================================================================== */}
      <header className="rep-nav">
        <div className="rep-nav__left">
          <button
            type="button"
            className="rep-nav__menu-btn"
            onClick={() => navigate('/dashboard')}
            title="Back to Dashboard"
            aria-label="Navigation Menu"
          >
            <svg width="20" height="15" viewBox="0 0 20 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1.5H19M1 7.5H19M1 13.5H19" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <h1 className="rep-nav__title">Software Engineer Intern</h1>
        </div>

        <div className="rep-nav__right">
          {/* Chatbot Toggle Button */}
          <button
            type="button"
            className={`rep-nav__icon-btn ${isChatOpen ? 'is-active' : ''}`}
            onClick={() => setIsChatOpen((prev) => !prev)}
            title="AI Coach Assistant"
            aria-label="Toggle AI Coach"
          >
            <img src={chatbotIcon} alt="Chatbot" className="rep-nav__bot-icon" />
          </button>

          {/* Share Button */}
          <button
            type="button"
            className="rep-nav__share-btn"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href)
                alert('Interview Report link copied to clipboard!')
              }
            }}
            title="Share report"
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
          <ProfileDropdown initial="J" name="Jazeel Jaufer" email="jazeel.jaufer@example.com" />
        </div>
      </header>

      {/* =====================================================================
          MAIN DASHBOARD REPORT GRID
          ===================================================================== */}
      <main className="rep-main">
        {/* ROW 1: Hero Readiness Card & Technical Skills */}
        <div className="rep-grid-top">
          {/* Top-Left Hero Card */}
          <div className="rep-hero-card">
            <div className="rep-hero-left">
              <span className="rep-hero-badge">Good Progress</span>
              <h2 className="rep-hero-role">Backend Developer</h2>
              <div className="rep-hero-company">
                <img src={company1Icon} alt="" className="rep-hero-company-icon" />
                <span>Microsoft</span>
              </div>

              {/* Action Buttons */}
              <div className="rep-hero-actions">
                <button
                  type="button"
                  className="rep-btn rep-btn--download"
                  onClick={handleDownloadRoadmap}
                >
                  <img src={downloadIcon} alt="" className="rep-btn-icon" />
                  <span>Download Roadmap</span>
                </button>

                <button
                  type="button"
                  className="rep-btn rep-btn--restart"
                  onClick={() => navigate('/new-interview')}
                >
                  <img src={restartIcon} alt="" className="rep-btn-icon" />
                  <span>Start Re-Interview</span>
                </button>
              </div>
            </div>

            {/* Inset Score Badge */}
            <div className="rep-score-box">
              <span className="rep-score-label">Readiness Score</span>
              <div className="rep-score-num-wrap">
                <span className="rep-score-val">78</span>
                <span className="rep-score-unit">%<br />SCORE</span>
              </div>
            </div>
          </div>

          {/* Top-Right: Technical Skills Card */}
          <div className="rep-card rep-card--tech">
            <h3 className="rep-card-title">Technical Skills</h3>

            <div className="rep-bars-list">
              {technicalSkills.map((skill) => (
                <div key={skill.name} className="rep-bar-row">
                  <span className={`rep-bar-name ${skill.isFlagged ? 'is-flagged' : ''}`}>
                    {skill.name}
                  </span>
                  <div className="rep-bar-track">
                    <div
                      className={`rep-bar-fill ${skill.isFlagged ? 'is-flagged' : 'is-purple'}`}
                      style={{ width: `${skill.score}%` }}
                    />
                  </div>
                  <span className="rep-bar-score">{skill.score}%</span>
                </div>
              ))}
            </div>

            {/* Bottom Highlights */}
            <div className="rep-tech-highlights">
              <div className="rep-highlight-box">
                <span className="rep-highlight-tag">STRONGEST</span>
                <span className="rep-highlight-val">REST API Dev</span>
              </div>
              <div className="rep-highlight-box rep-highlight-box--warning">
                <span className="rep-highlight-tag rep-highlight-tag--warning">NEEDS MOST ATTENTION</span>
                <span className="rep-highlight-val">System Design</span>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: Performance Breakdown, Communication Analysis, Video, Transcript, Trend */}
        <div className="rep-grid-bottom">
          {/* Column A (Left): Performance Breakdown & Communication Analysis */}
          <div className="rep-col-left">
            {/* Performance Breakdown */}
            <div className="rep-card">
              <h3 className="rep-card-title">Performance Breakdown</h3>
              <div className="rep-bars-list">
                {performanceBreakdown.map((item) => (
                  <div key={item.name} className="rep-bar-row">
                    <span className={`rep-bar-name ${item.isFlagged ? 'is-flagged' : ''}`}>
                      {item.name}
                    </span>
                    <div className="rep-bar-track">
                      <div
                        className={`rep-bar-fill ${item.isFlagged ? 'is-flagged' : 'is-purple'}`}
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                    <span className="rep-bar-score">{item.score}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Communication Analysis */}
            <div className="rep-card">
              <h3 className="rep-card-title">Communication Analysis</h3>
              <div className="rep-bars-list">
                {communicationAnalysis.map((item) => (
                  <div key={item.name} className="rep-bar-row">
                    <span className={`rep-bar-name ${item.isFlagged ? 'is-flagged' : ''}`}>
                      {item.name}
                    </span>
                    <div className="rep-bar-track">
                      <div
                        className={`rep-bar-fill ${item.isFlagged ? 'is-flagged' : 'is-purple'}`}
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                    <span className="rep-bar-score">{item.score}%</span>
                  </div>
                ))}
              </div>

              {/* Inset Filler Words & AI Recommendation */}
              <div className="rep-insight-card">
                <div className="rep-insight-header">
                  <span className="rep-insight-label">Filler Words</span>
                  <span className="rep-insight-tag">Needs Improvement</span>
                </div>
                <div className="rep-insight-body">
                  <img src={bulbIcon} alt="" className="rep-bulb-icon" />
                  <div className="rep-insight-content">
                    <h4 className="rep-insight-headline">Primary Focus: Structure Your Answers</h4>
                    <p className="rep-insight-text">
                      AI Insight: You tend to lose structure during complex technical questions. Focus on the STAR method (Situation, Task, Action, Result) to keep your answers concise and impactful.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column B (Right): Video Snapshot, Transcript, Performance Trend */}
          <div className="rep-col-right">
            <div className="rep-media-row">
              {/* Candidate Video Recording Preview */}
              <div className="rep-video-card">
                <div className="rep-video-inner">
                  <img
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=640&auto=format&fit=crop"
                    alt="Interview Recording"
                    className="rep-video-thumb"
                  />
                  <button
                    type="button"
                    className="rep-video-play-btn"
                    onClick={() => setIsVideoPlaying((prev) => !prev)}
                    title="Play recording"
                    aria-label="Play recording"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Interview Transcript Box */}
              <div className={`rep-card rep-card--transcript ${isTranscriptExpanded ? 'is-full-view' : ''}`}>
                <div className="rep-transcript-header">
                  <h3 className="rep-card-title rep-card-title--sm">INTERVIEW TRANSCRIPT</h3>
                  <div className="rep-transcript-actions">
                    <button
                      type="button"
                      className="rep-transcript-expand-btn"
                      onClick={() => setIsTranscriptExpanded((prev) => !prev)}
                      title={isTranscriptExpanded ? 'Compact View' : 'Full Card View'}
                      aria-label="Toggle Full View"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        {isTranscriptExpanded ? (
                          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                        ) : (
                          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                        )}
                      </svg>
                      <span>{isTranscriptExpanded ? 'COLLAPSE' : 'FULL'}</span>
                    </button>
                    <button
                      type="button"
                      className="rep-transcript-download"
                      onClick={handleDownloadTranscript}
                      title="Download Transcript"
                    >
                      <img src={downloadIcon} alt="Download" className="rep-download-icon" />
                    </button>
                  </div>
                </div>

                <div className={`rep-transcript-content ${isTranscriptExpanded ? 'is-expanded' : ''}`}>
                  <p>
                    &ldquo;good morning, jazeel. thank you for joining the interview today. to begin, could you briefly introduce yourself and tell me about your experience in backend development?&rdquo;
                  </p>
                  <p>
                    &ldquo;i&apos;m currently studying software engineering and have worked on several full-stack and backend-focused projects. i have experience working with node.js, express, mongodb, java, and spring boot. one of my recent projects involved building an ai-powered cloud deployment platform.&rdquo;
                  </p>
                  <p>
                    &ldquo;that sounds interesting. can you explain one technical challenge you faced while developing that project and how you approached solving it?&rdquo;
                  </p>
                  <p>
                    &ldquo;one of the main challenges was handling deployment failures and identifying the actual cause from deployment logs. i designed a workflow that analyzes the logs, identifies possible issues, and suggests solutions based on available technical documentation.&rdquo;
                  </p>
                  <p>
                    &ldquo;for the ui, title it &quot;interview transcript&quot; or &quot;session transcript&quot;, not &quot;live transcript&quot;.&rdquo;
                  </p>
                </div>
              </div>
            </div>

            {/* Performance Trend Graph */}
            <div className="rep-card rep-card--trend">
              <div className="rep-trend-header">
                <h3 className="rep-card-title">Performance Trend</h3>
                <div className="rep-time-pills">
                  {['1M', '3M', '6M', '9M', '12M', '15M'].map((range) => (
                    <button
                      key={range}
                      type="button"
                      className={`rep-time-pill ${activeTimeRange === range ? 'is-active' : ''}`}
                      onClick={() => setActiveTimeRange(range)}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              {/* SVG Trend Graph Curve */}
              <div className="rep-chart-container">
                <svg className="rep-chart-svg" viewBox="0 0 600 200" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Area fill */}
                  <path
                    d="M 0 190 Q 200 180 320 120 T 600 45 L 600 200 L 0 200 Z"
                    fill="url(#chartGrad)"
                  />

                  {/* Main smooth curve */}
                  <path
                    d="M 0 190 Q 200 180 320 120 T 600 45"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="3"
                  />

                  {/* Scrubber pin in middle */}
                  <line x1="320" y1="110" x2="320" y2="130" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="320" cy="120" r="4" fill="#ffffff" />

                  {/* End node at 600, 45 */}
                  <circle cx="596" cy="46" r="4.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Chat Assistant Drawer */}
      {isChatOpen && (
        <div className="rep-chat-drawer">
          <div className="rep-chat-header">
            <div className="rep-chat-title">
              <img src={chatbotIcon} alt="" className="rep-chat-bot-icon" />
              <span>HireMind AI Coach</span>
            </div>
            <button
              type="button"
              className="rep-chat-close"
              onClick={() => setIsChatOpen(false)}
              aria-label="Close Chat"
            >
              ✕
            </button>
          </div>
          <div className="rep-chat-body">
            <div className="rep-chat-bubble bot">
              Great work on scoring <strong>88%</strong> in REST APIs! Your primary growth area is <strong>System Design</strong> and <strong>Answer Structure</strong>. Want to practice a focused 15-minute simulation?
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
