import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import chatbotIcon from '../assets/icons/chatbot.svg'
import downloadIcon from '../assets/icons/download.svg'
import restartIcon from '../assets/icons/restart.svg'
import company1Icon from '../assets/icons/company1.svg'
import bulbIcon from '../assets/icons/bulb.svg'
import ProfileDropdown from '../components/ProfileDropdown'
import { generateInterviewId } from '../utils/interviewUtils'
import { getApiUrl } from '../config/api'
import './InterviewReport.css'

export default function InterviewReport() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const paramId = id || searchParams.get('id') || searchParams.get('sessionId')
  const sessionId = (paramId && paramId !== 'default') 
    ? paramId 
    : (localStorage.getItem('hiremind_last_interview_id') || 'latest')

  const [activeTimeRange, setActiveTimeRange] = useState('15M')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [session, setSession] = useState(null)
  const [evaluation, setEvaluation] = useState(null)
  const [chatMessages, setChatMessages] = useState([])

  // Ensure speech synthesis and audio are completely silent on report page
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        // Speech synthesis may be unavailable; nothing to stop
      }
    }
  }, [])

  // Fetch the evaluation from the backend. No placeholder report is ever shown:
  // if the evaluator is unavailable the page says so and offers a retry.
  useEffect(() => {
    let isMounted = true

    const fetchEvaluation = async () => {
      try {
        const token = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
        const res = await fetch(getApiUrl(`/api/interview/${sessionId}/evaluation`), {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
        const data = await res.json().catch(() => ({}))
        if (!isMounted) return

        if (res.ok && data.success && data.evaluation) {
          setEvaluation(data.evaluation)
          setSession(data.session)
          setChatMessages(data.chatMessages || [])
          setLoadError(null)
        } else {
          if (data.session) setSession(data.session)
          setLoadError({
            message:
              data.message ||
              (res.status === 404
                ? 'We could not find this interview report.'
                : 'Your interview report could not be loaded right now.'),
            retryable: res.status !== 404 && res.status !== 403,
          })
        }
      } catch {
        if (isMounted) {
          setLoadError({
            message: 'Could not reach the HireMind server. Please check your connection and try again.',
            retryable: true,
          })
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchEvaluation()
    return () => {
      isMounted = false
    }
  }, [sessionId, reloadKey])

  const handleRetry = () => {
    setIsLoading(true)
    setLoadError(null)
    setReloadKey((key) => key + 1)
  }

  // Values come only from the stored session / AI evaluation — no invented defaults
  const displayRole = session?.targetRole || 'Interview Report'
  const displayCompany = session?.company || ''
  const displayCandidate = session?.candidateName || 'Candidate'
  const overallScore = typeof evaluation?.overallScore === 'number' ? evaluation.overallScore : null
  const readinessBadge =
    evaluation?.readinessBadge ||
    (overallScore === null ? '' : overallScore >= 80 ? 'Interview Ready' : overallScore >= 65 ? 'Good Progress' : 'Needs Practice')

  const summaryText = evaluation?.summary || ''
  const technicalSkills = Array.isArray(evaluation?.technicalSkills) ? evaluation.technicalSkills : []
  const strongestSkill = evaluation?.strongestSkill || ''
  const needsAttentionSkill = evaluation?.needsAttentionSkill || ''
  const performanceBreakdown = Array.isArray(evaluation?.performanceBreakdown) ? evaluation.performanceBreakdown : []
  const communicationAnalysis = Array.isArray(evaluation?.communicationAnalysis) ? evaluation.communicationAnalysis : []
  const aiRecommendation =
    evaluation?.aiRecommendation && typeof evaluation.aiRecommendation === 'object' ? evaluation.aiRecommendation : {}
  const trendScores = Array.isArray(evaluation?.trendScores)
    ? evaluation.trendScores.filter((v) => typeof v === 'number')
    : []

  const buildTrendSvgPath = () => {
    if (trendScores.length < 2) {
      return { pathD: null, areaD: null, lastPoint: null, midPoint: null }
    }
    const width = 600
    const height = 200
    const pointsCount = trendScores.length
    const step = width / (pointsCount - 1)

    // Map score (40 to 100) to Y (180 down to 25)
    const points = trendScores.map((score, i) => {
      const x = Math.round(i * step)
      const clamped = Math.min(100, Math.max(40, score))
      const y = Math.round(180 - ((clamped - 40) / 60) * 150)
      return { x, y }
    })

    // Construct smooth cubic bezier path
    let d = `M ${points[0].x} ${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i]
      const p1 = points[i + 1]
      const mx = (p0.x + p1.x) / 2
      d += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`
    }

    const areaD = `${d} L ${width} ${height} L 0 ${height} Z`
    const lastPoint = points[points.length - 1]
    const midPoint = points[Math.floor(points.length / 2)]

    return { pathD: d, areaD, lastPoint, midPoint }
  }

  const { pathD, areaD, lastPoint, midPoint } = buildTrendSvgPath()

  // Real Interview Transcript Download
  const handleDownloadTranscript = () => {
    let transcriptText = `HIREMIND AI INTERVIEW EVALUATION REPORT\n`
    transcriptText += `=======================================================\n`
    transcriptText += `Candidate: ${displayCandidate}\n`
    transcriptText += `Target Role: ${displayRole}\n`
    transcriptText += `Company: ${displayCompany}\n`
    transcriptText += `Overall Readiness Score: ${overallScore ?? 'N/A'}%\n`
    transcriptText += `Status: ${readinessBadge}\n`
    transcriptText += `Generated At: ${new Date().toLocaleString()}\n\n`
    transcriptText += `EXECUTIVE SUMMARY\n`
    transcriptText += `-----------------\n`
    transcriptText += `${summaryText}\n\n`
    transcriptText += `PERFORMANCE EVALUATION OVERVIEW\n`
    transcriptText += `-------------------------------\n`
    transcriptText += `Strongest Competency: ${strongestSkill || 'Not assessed'}\n`
    transcriptText += `Needs Most Attention: ${needsAttentionSkill || 'Not assessed'}\n`
    transcriptText += `Primary AI Recommendation: ${aiRecommendation.headline || 'Not provided'}\n`
    transcriptText += `Insight: ${aiRecommendation.insight || 'Not provided'}\n\n`
    transcriptText += `INTERVIEW TRANSCRIPT\n`
    transcriptText += `--------------------\n`

    const visibleMessages = chatMessages.filter((m) => m.role === 'candidate' || m.role === 'interviewer')
    if (visibleMessages.length > 0) {
      visibleMessages.forEach((msg, idx) => {
        const speaker = msg.role === 'candidate' ? `${displayCandidate} (Candidate)` : 'HireMind AI Interviewer'
        const time = msg.timestamp
          ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : `Turn ${idx + 1}`
        transcriptText += `[${speaker} - ${time}]\n${msg.content}\n\n`
      })
    } else {
      transcriptText += `(No messages were recorded for this session)\n`
    }

    const blob = new Blob([transcriptText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `HireMind_Transcript_${displayRole.replace(/[^a-zA-Z0-9]/g, '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // AI Improvement Roadmap Download
  const handleDownloadRoadmap = () => {
    let roadmapText = `HIREMIND AI IMPROVEMENT & STUDY ROADMAP\n`
    roadmapText += `=======================================================\n`
    roadmapText += `Candidate: ${displayCandidate}\n`
    roadmapText += `Target Role: ${displayRole} @ ${displayCompany}\n`
    roadmapText += `Current Readiness Score: ${overallScore ?? 'N/A'}% (${readinessBadge || 'Not assessed'})\n\n`
    roadmapText += `1. EXECUTIVE EVALUATION\n`
    roadmapText += `   ${summaryText}\n\n`
    roadmapText += `2. KEY TECHNICAL FOCUS\n`
    roadmapText += `   - Top Strength: ${strongestSkill || 'Not assessed'}\n`
    roadmapText += `   - Growth Target: ${needsAttentionSkill || 'Not assessed'}\n\n`
    roadmapText += `3. ACTIONABLE AI RECOMMENDATION\n`
    roadmapText += `   ${aiRecommendation.headline || 'Not provided'}\n`
    roadmapText += `   ${aiRecommendation.insight || ''}\n\n`
    roadmapText += `4. 7-DAY ACTION PLAN FOR ${displayRole.toUpperCase()}\n`
    roadmapText += `   Day 1-2: Core fundamentals of ${needsAttentionSkill || 'your weakest topic from this interview'}.\n`
    roadmapText += `   Day 3-4: Trade-off and architecture design drills.\n`
    roadmapText += `   Day 5-6: Behavioral & structured communication (STAR technique).\n`
    roadmapText += `   Day 7: Re-attempt HireMind adaptive simulation.\n`

    const blob = new Blob([roadmapText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `HireMind_Roadmap_${displayRole.replace(/[^a-zA-Z0-9]/g, '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const visibleTranscript = chatMessages.filter(
    (m) => m.role === 'candidate' || m.role === 'interviewer' || m.role === 'system'
  )

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
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 className="rep-nav__title">{displayRole}</h1>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
              AI Evaluation Report {session?.status === 'ended_by_user' ? '• Concluded Early' : '• Completed'}
            </span>
          </div>
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
          <ProfileDropdown />
        </div>
      </header>

      {/* =====================================================================
          MAIN DASHBOARD REPORT GRID
          ===================================================================== */}
      <main className="rep-main">
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '16px', color: '#38bdf8', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span className="rep-loading-spinner" />
            <span>Preparing your comprehensive performance overview and metrics...</span>
          </div>
        )}

        {!isLoading && !evaluation && (
          <div className="rep-card" style={{ maxWidth: '560px', margin: '48px auto', textAlign: 'center', padding: '32px 24px' }}>
            <h3 className="rep-card-title" style={{ marginBottom: '10px' }}>Report not available yet</h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>
              {loadError?.message || 'Your interview report could not be loaded right now.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {loadError?.retryable !== false && (
                <button type="button" className="rep-btn rep-btn--download" onClick={handleRetry}>
                  <span>Try Again</span>
                </button>
              )}
              <button type="button" className="rep-btn rep-btn--restart" onClick={() => navigate('/dashboard')}>
                <span>Back to Dashboard</span>
              </button>
            </div>
          </div>
        )}

        {evaluation && (
        <>
        {/* ROW 1: Hero Readiness Card & Technical Skills */}
        <div className="rep-grid-top">
          {/* Top-Left Hero Card */}
          <div className="rep-hero-card">
            <div className="rep-hero-left">
              {readinessBadge && <span className="rep-hero-badge">{readinessBadge}</span>}
              <h2 className="rep-hero-role">{displayRole}</h2>
              {displayCompany && (
                <div className="rep-hero-company">
                  <img src={company1Icon} alt="" className="rep-hero-company-icon" />
                  <span>{displayCompany}</span>
                </div>
              )}

              {/* Dynamic Executive Summary Blurb */}
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.5', maxWidth: '480px' }}>
                {summaryText}
              </p>

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
                  onClick={() => navigate(`/new-interview/${generateInterviewId()}`)}
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
                <span className="rep-score-val">{overallScore ?? '—'}</span>
                <span className="rep-score-unit">%<br />SCORE</span>
              </div>
            </div>
          </div>

          {/* Top-Right: Technical Skills Card */}
          <div className="rep-card rep-card--tech">
            <h3 className="rep-card-title">Technical Skills</h3>

            <div className="rep-bars-list">
              {technicalSkills.length === 0 && <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Not assessed in this session.</p>}
              {technicalSkills.map((skill) => (
                <div key={skill.name} className="rep-bar-row">
                  <span className={`rep-bar-name ${skill.isFlagged ? 'is-flagged' : ''}`}>
                    {skill.name}
                  </span>
                  <div className="rep-bar-track">
                    <div
                      className={`rep-bar-fill ${skill.isFlagged ? 'is-flagged' : 'is-purple'}`}
                      style={{ width: `${Math.min(100, Math.max(10, skill.score))}%` }}
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
                <span className="rep-highlight-val">{strongestSkill || 'Not assessed'}</span>
              </div>
              <div className="rep-highlight-box rep-highlight-box--warning">
                <span className="rep-highlight-tag rep-highlight-tag--warning">NEEDS MOST ATTENTION</span>
                <span className="rep-highlight-val">{needsAttentionSkill || 'Not assessed'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: Performance Breakdown, Communication Analysis, Dynamic Transcript, Trend */}
        <div className="rep-grid-bottom">
          {/* Column A (Left): Performance Breakdown & Communication Analysis */}
          <div className="rep-col-left">
            {/* Performance Breakdown */}
            <div className="rep-card">
              <h3 className="rep-card-title">Performance Breakdown</h3>
              <div className="rep-bars-list">
                {performanceBreakdown.length === 0 && <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Not assessed in this session.</p>}
                {performanceBreakdown.map((item) => (
                  <div key={item.name} className="rep-bar-row">
                    <span className={`rep-bar-name ${item.isFlagged ? 'is-flagged' : ''}`}>
                      {item.name}
                    </span>
                    <div className="rep-bar-track">
                      <div
                        className={`rep-bar-fill ${item.isFlagged ? 'is-flagged' : 'is-purple'}`}
                        style={{ width: `${Math.min(100, Math.max(10, item.score))}%` }}
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
                {communicationAnalysis.length === 0 && <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Not assessed in this session.</p>}
                {communicationAnalysis.map((item) => (
                  <div key={item.name} className="rep-bar-row">
                    <span className={`rep-bar-name ${item.isFlagged ? 'is-flagged' : ''}`}>
                      {item.name}
                    </span>
                    <div className="rep-bar-track">
                      <div
                        className={`rep-bar-fill ${item.isFlagged ? 'is-flagged' : 'is-purple'}`}
                        style={{ width: `${Math.min(100, Math.max(10, item.score))}%` }}
                      />
                    </div>
                    <span className="rep-bar-score">{item.score}%</span>
                  </div>
                ))}
              </div>

              {/* Inset AI Recommendation */}
              {(aiRecommendation.headline || aiRecommendation.insight) && (
              <div className="rep-insight-card">
                <div className="rep-insight-header">
                  <span className="rep-insight-label">{aiRecommendation.primaryFocus || 'Core Assessment Focus'}</span>
                  <span className="rep-insight-tag">Key Recommendation</span>
                </div>
                <div className="rep-insight-body">
                  <img src={bulbIcon} alt="" className="rep-bulb-icon" />
                  <div className="rep-insight-content">
                    <h4 className="rep-insight-headline">{aiRecommendation.headline}</h4>
                    <p className="rep-insight-text">{aiRecommendation.insight}</p>
                  </div>
                </div>
              </div>
              )}
            </div>
          </div>

          {/* Column B (Right): Full Width Dynamic Transcript & Trend Chart (No Video Card) */}
          <div className="rep-col-right">
            <div className="rep-media-row">
              {/* Dynamic Interview Transcript Box */}
              <div className={`rep-card rep-card--transcript ${isTranscriptExpanded ? 'is-full-view' : ''}`}>
                <div className="rep-transcript-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 className="rep-card-title rep-card-title--sm">INTERVIEW TRANSCRIPT</h3>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      ({visibleTranscript.length} exchange{visibleTranscript.length === 1 ? '' : 's'})
                    </span>
                  </div>
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
                      <span>{isTranscriptExpanded ? 'COLLAPSE' : 'EXPAND'}</span>
                    </button>
                    <button
                      type="button"
                      className="rep-transcript-download"
                      onClick={handleDownloadTranscript}
                      title="Download Real Transcript"
                    >
                      <img src={downloadIcon} alt="Download" className="rep-download-icon" />
                    </button>
                  </div>
                </div>

                <div className={`rep-transcript-content ${isTranscriptExpanded ? 'is-expanded' : ''}`}>
                  {visibleTranscript.length > 0 ? (
                    visibleTranscript.map((msg, index) => {
                      const isCandidate = msg.role === 'candidate'
                      const isSystem = msg.role === 'system'
                      const speakerName = isCandidate
                        ? displayCandidate
                        : isSystem
                        ? 'System Notice'
                        : 'HireMind AI Interviewer'

                      const timeStr = msg.timestamp
                        ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''

                      return (
                        <div
                          key={msg._id || index}
                          className={`rep-transcript-bubble-row ${isCandidate ? 'is-candidate' : isSystem ? 'is-system' : 'is-ai'}`}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            marginBottom: '10px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#94a3b8' }}>
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 700,
                                background: isCandidate
                                  ? 'rgba(168, 85, 247, 0.15)'
                                  : isSystem
                                  ? 'rgba(239, 68, 68, 0.15)'
                                  : 'rgba(56, 189, 248, 0.15)',
                                color: isCandidate ? '#c084fc' : isSystem ? '#f87171' : '#38bdf8',
                                border: `1px solid ${isCandidate ? 'rgba(168, 85, 247, 0.3)' : isSystem ? 'rgba(239, 68, 68, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
                              }}
                            >
                              {speakerName}
                            </span>
                            {timeStr && <span>{timeStr}</span>}
                          </div>
                          <div
                            style={{
                              background: isCandidate ? 'rgba(88, 28, 135, 0.15)' : 'rgba(15, 23, 42, 0.65)',
                              border: `1px solid ${isCandidate ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.08)'}`,
                              borderRadius: '8px',
                              padding: '8px 12px',
                              color: '#e2e8f0',
                              fontSize: '12px',
                              lineHeight: 1.5,
                            }}
                          >
                            <p style={{ margin: 0, fontStyle: isSystem ? 'italic' : 'normal' }}>{msg.content}</p>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div style={{ padding: '20px 0', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                      <p style={{ fontStyle: 'normal' }}>
                        No messages were recorded in this session.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Performance Trend Graph */}
            <div className="rep-card rep-card--trend">
              <div className="rep-trend-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 className="rep-card-title">Performance Trend</h3>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Adaptive Session Velocity</span>
                </div>
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

              {/* Dynamic SVG Trend Graph Curve */}
              {!pathD ? (
                <p style={{ margin: '16px 0', fontSize: '12px', color: '#64748b' }}>
                  Not enough data points yet to show a trend.
                </p>
              ) : (
              <div className="rep-chart-container">
                <svg className="rep-chart-svg" viewBox="0 0 600 200" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Dynamic Area fill */}
                  <path d={areaD} fill="url(#chartGrad)" />

                  {/* Dynamic Main smooth curve */}
                  <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="3" />

                  {/* Scrubber pin in middle */}
                  {midPoint && (
                    <>
                      <line
                        x1={midPoint.x}
                        y1={midPoint.y - 12}
                        x2={midPoint.x}
                        y2={midPoint.y + 12}
                        stroke="#ffffff"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                      <circle cx={midPoint.x} cy={midPoint.y} r="4" fill="#ffffff" />
                    </>
                  )}

                  {/* Dynamic End node */}
                  {lastPoint && (
                    <circle cx={lastPoint.x} cy={lastPoint.y} r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
                  )}
                </svg>
              </div>
              )}
            </div>
          </div>
        </div>
        </>
        )}
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
              <strong>Evaluation Summary:</strong>
              <p style={{ margin: '6px 0' }}>{summaryText || 'No evaluation summary is available yet.'}</p>
              {aiRecommendation.headline && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <strong>Key Action Item:</strong> {aiRecommendation.headline}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
