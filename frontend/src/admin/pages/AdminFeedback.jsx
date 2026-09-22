import { useState, useMemo } from 'react'
import {
  FeedbackIcon,
  SparklesIcon,
  PilotAccessIcon,
  ClockIcon,
  XCircleIcon,
  CheckCircleIcon,
  CloseIcon,
  SearchIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  BotIcon,
} from '../AdminIcons'
import './AdminPage.css'
import './AdminFeedback.css'

export default function AdminFeedback() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Statuses')
  const [issueFilter, setIssueFilter] = useState('All')

  // Selected feedback for full details modal
  const [selectedFeedback, setSelectedFeedback] = useState(null)
  const [toastMessage, setToastMessage] = useState('')

  // ========================================================================
  // 1. SUMMARY CARDS (5 METRICS)
  // ========================================================================
  const summaryCards = [
    {
      label: 'Total Responses',
      value: '348',
      trend: '+28 this week',
      trendUp: true,
      subtext: 'verified submissions',
      icon: FeedbackIcon,
      colorClass: 'fb-summary-card__icon-wrap--cyan',
    },
    {
      label: 'Average Rating',
      value: '4.7 / 5',
      trend: '+0.15',
      trendUp: true,
      subtext: 'high satisfaction',
      icon: SparklesIcon,
      colorClass: 'fb-summary-card__icon-wrap--emerald',
    },
    {
      label: 'Pilot Responses',
      value: '42',
      trend: '88% rate',
      trendUp: true,
      subtext: 'enterprise trials',
      icon: PilotAccessIcon,
      colorClass: 'fb-summary-card__icon-wrap--purple',
    },
    {
      label: 'Feedback Pending',
      value: '16',
      trend: 'Awaiting',
      trendUp: false,
      subtext: 'interviews done',
      icon: ClockIcon,
      colorClass: 'fb-summary-card__icon-wrap--amber',
    },
    {
      label: 'Technical Issues Reported',
      value: '3',
      trend: '< 1%',
      trendUp: true,
      subtext: 'minor audio jitter',
      icon: XCircleIcon,
      colorClass: 'fb-summary-card__icon-wrap--rose',
    },
  ]

  // ========================================================================
  // 2. RATING OVERVIEW (8 CARDS)
  // ========================================================================
  const ratingOverviewCards = [
    { title: 'Overall Experience', score: '4.8', fillWidth: '96%' },
    { title: 'Interview Usefulness', score: '4.7', fillWidth: '94%' },
    { title: 'Interview Realism', score: '4.9', fillWidth: '98%' },
    { title: 'Question Relevance', score: '4.8', fillWidth: '96%' },
    { title: 'AI Feedback Quality', score: '4.6', fillWidth: '92%' },
    { title: 'Voice Experience', score: '4.5', fillWidth: '90%' },
    { title: 'Ease of Use', score: '4.9', fillWidth: '98%' },
    { title: 'Interview Preparedness', score: '4.7', fillWidth: '94%' },
  ]

  // ========================================================================
  // 3. CHARTS DATA
  // ========================================================================
  // Star Distribution
  const ratingDistribution = [
    { stars: '5 Stars', percent: 74, width: '74%' },
    { stars: '4 Stars', percent: 18, width: '18%' },
    { stars: '3 Stars', percent: 5, width: '5%' },
    { stars: '2 Stars', percent: 2, width: '2%' },
    { stars: '1 Star', percent: 1, width: '1%' },
  ]

  // Responses over time line SVG
  const responsePoints = [
    { label: 'Week 1', count: 42, x: 20, y: 130 },
    { label: 'Week 2', count: 65, x: 130, y: 95 },
    { label: 'Week 3', count: 88, x: 240, y: 65 },
    { label: 'Week 4', count: 112, x: 350, y: 40 },
    { label: 'Current', count: 141, x: 460, y: 18 },
  ]
  const responseAreaPath = 'M 20,130 L 130,95 L 240,65 L 350,40 L 460,18 L 460,160 L 20,160 Z'
  const responseStrokePath = 'M 20,130 L 130,95 L 240,65 L 350,40 L 460,18'

  // Recommendation NPS distribution
  const npsDistribution = [
    { category: 'Promoters (9-10)', percent: 82, color: '#10b981', desc: 'Loyal advocates' },
    { category: 'Passives (7-8)', percent: 14, color: '#38bdf8', desc: 'Satisfied' },
    { category: 'Detractors (1-6)', percent: 4, color: '#f43f5e', desc: 'Need attention' },
  ]

  // ========================================================================
  // 4. FEEDBACK TABLE DATA
  // ========================================================================
  const [feedbackList, setFeedbackList] = useState([
    {
      id: 'FB-901',
      participant: 'Elena Rostova',
      email: 'elena.r@databricks.com',
      avatar: 'E',
      isPilot: true,
      targetRole: 'Distributed Systems Lead',
      company: 'Databricks',
      interviewId: 'INT-9820',
      submissionDate: 'Sep 22, 2026',
      overallRating: 5.0,
      usefulnessText: 'Extremely Useful',
      technicalIssueText: 'None',
      hasIssue: false,
      status: 'Reviewed',
      answers: {
        overallExperience: '5.0 / 5 (Exceptional)',
        usefulness: 'Extremely Useful',
        realism: '4.9 / 5 (Felt like a Principal Architect interview)',
        questionRelevance: '5.0 / 5 (Tailored perfectly to consensus protocols)',
        aiFeedbackUsefulness: '4.8 / 5 (Very insightful analysis)',
        voiceExperience: '4.8 / 5 (Low latency, crisp audio)',
        easeOfUse: '5.0 / 5 (Seamless web onboarding)',
        preparedness: '4.8 / 5 (Significantly boosted confidence)',
        wouldUseAgain: 'Yes, definitely',
        recommendationScore: '10 / 10',
        likedMost:
          'The real-time follow-up challenges on Raft consensus and write amplification in LSM storage engines were astonishingly accurate. The interviewer sounded natural and gave constructive feedback.',
        shouldBeImproved:
          'Provide downloadable architecture whiteboard sketches alongside the transcript.',
        technicalProblem: 'No',
        technicalProblemDesc: 'None encountered. Audio and video streams were rock solid.',
      },
    },
    {
      id: 'FB-902',
      participant: 'Jazeel K.',
      email: 'jazeel@example.com',
      avatar: 'J',
      isPilot: false,
      targetRole: 'Senior Backend Engineer',
      company: 'Microsoft',
      interviewId: 'INT-9821',
      submissionDate: 'Sep 22, 2026',
      overallRating: 4.8,
      usefulnessText: 'Very Useful',
      technicalIssueText: 'None',
      hasIssue: false,
      status: 'Reviewed',
      answers: {
        overallExperience: '4.8 / 5 (Very Good)',
        usefulness: 'Very Useful',
        realism: '4.8 / 5 (High technical depth)',
        questionRelevance: '4.9 / 5 (Spring Boot & Redis cache focus)',
        aiFeedbackUsefulness: '4.7 / 5 (Clear strength identification)',
        voiceExperience: '4.5 / 5 (Natural conversational cadence)',
        easeOfUse: '5.0 / 5 (Clean dashboard & room controls)',
        preparedness: '4.7 / 5 (Ready for Microsoft rounds)',
        wouldUseAgain: 'Yes, definitely',
        recommendationScore: '10 / 10',
        likedMost:
          'The question on distributed lock leasing pushed me to articulate my thinking properly. The readiness report gave me actionable steps for memory sizing.',
        shouldBeImproved:
          'Allow candidates to pause or take a 30-second breath before answering complicated system design inquiries.',
        technicalProblem: 'No',
        technicalProblemDesc: 'Zero connection drops during the 34-minute session.',
      },
    },
    {
      id: 'FB-903',
      participant: 'Marcus Sterling',
      email: 'marcus.s@snowflake.com',
      avatar: 'M',
      isPilot: true,
      targetRole: 'Data Platform Architect',
      company: 'Snowflake',
      interviewId: 'INT-9819',
      submissionDate: 'Sep 21, 2026',
      overallRating: 4.7,
      usefulnessText: 'Extremely Useful',
      technicalIssueText: 'Minor Audio Lag (Q2)',
      hasIssue: true,
      status: 'Pending',
      answers: {
        overallExperience: '4.7 / 5 (Great)',
        usefulness: 'Extremely Useful',
        realism: '4.8 / 5 (Realistic enterprise inquiries)',
        questionRelevance: '4.8 / 5 (Accurate SQL optimization questions)',
        aiFeedbackUsefulness: '4.6 / 5 (Helpful rubric)',
        voiceExperience: '4.2 / 5 (Brief 200ms lag on Question 2)',
        easeOfUse: '4.9 / 5 (Quick start without installation)',
        preparedness: '4.7 / 5 (Very relevant to our team)',
        wouldUseAgain: 'Yes, definitely',
        recommendationScore: '9 / 10',
        likedMost:
          'The depth of evaluation on query optimization and columnar storage. It questioned partitioning trade-offs effectively.',
        shouldBeImproved:
          'Improve audio buffer handling when candidate speaks immediately after the question finishes.',
        technicalProblem: 'Yes (Minor)',
        technicalProblemDesc:
          'Audio playback experienced a small stutter during Question 2, but self-resolved in 3 seconds.',
      },
    },
    {
      id: 'FB-904',
      participant: 'Sarah Jenkins',
      email: 'sarah.j@outlook.com',
      avatar: 'S',
      isPilot: false,
      targetRole: 'Engineering Manager',
      company: 'Uber',
      interviewId: 'INT-9818',
      submissionDate: 'Sep 21, 2026',
      overallRating: 4.6,
      usefulnessText: 'Very Useful',
      technicalIssueText: 'None',
      hasIssue: false,
      status: 'Reviewed',
      answers: {
        overallExperience: '4.6 / 5 (Good)',
        usefulness: 'Very Useful',
        realism: '4.7 / 5 (Good behavioral scenario probes)',
        questionRelevance: '4.8 / 5 (Relevant leadership situations)',
        aiFeedbackUsefulness: '4.5 / 5 (Good feedback on communication)',
        voiceExperience: '4.6 / 5 (Pleasant tone)',
        easeOfUse: '4.9 / 5 (Intuitive UI)',
        preparedness: '4.6 / 5 (Helped rehearse STAR method)',
        wouldUseAgain: 'Yes, definitely',
        recommendationScore: '9 / 10',
        likedMost:
          'The interviewer followed up on how I handled conflict resolution between engineering and product management without feeling robotic.',
        shouldBeImproved:
          'Add a metric to gauge candidate emotional intelligence (EQ) alongside technical answers.',
        technicalProblem: 'No',
        technicalProblemDesc: 'Smooth video and audio stream.',
      },
    },
    {
      id: 'FB-905',
      participant: 'David Kim',
      email: 'dkim99@gmail.com',
      avatar: 'D',
      isPilot: false,
      targetRole: 'Junior Full Stack Developer',
      company: 'Meta',
      interviewId: 'INT-9815',
      submissionDate: 'Sep 20, 2026',
      overallRating: 3.5,
      usefulnessText: 'Moderately Useful',
      technicalIssueText: 'Disconnection (Q2)',
      hasIssue: true,
      status: 'Pending',
      answers: {
        overallExperience: '3.5 / 5 (Fair)',
        usefulness: 'Moderately Useful',
        realism: '4.0 / 5',
        questionRelevance: '4.2 / 5',
        aiFeedbackUsefulness: '3.5 / 5 (Session was cut short)',
        voiceExperience: '3.8 / 5 (STT misunderstood "Postgres")',
        easeOfUse: '4.5 / 5',
        preparedness: '3.5 / 5',
        wouldUseAgain: 'Yes, if connection is stable',
        recommendationScore: '6 / 10',
        likedMost:
          'The first question was very clear and the hints helped me explain the React Virtual DOM.',
        shouldBeImproved:
          'Allow auto-reconnecting if Wi-Fi drops out instead of ending the session immediately.',
        technicalProblem: 'Yes',
        technicalProblemDesc:
          'Browser disconnected due to Wi-Fi blip on Question 2. Could not resume the session.',
      },
    },
    {
      id: 'FB-906',
      participant: 'Chloe Vance',
      email: 'chloe@stripe.com',
      avatar: 'C',
      isPilot: true,
      targetRole: 'Payments Infrastructure Engineer',
      company: 'Stripe',
      interviewId: 'INT-9812',
      submissionDate: 'Sep 19, 2026',
      overallRating: 5.0,
      usefulnessText: 'Extremely Useful',
      technicalIssueText: 'None',
      hasIssue: false,
      status: 'Reviewed',
      answers: {
        overallExperience: '5.0 / 5 (Superb)',
        usefulness: 'Extremely Useful',
        realism: '5.0 / 5 (Very Stripe-calibrated)',
        questionRelevance: '5.0 / 5 (Payment idempotency focus)',
        aiFeedbackUsefulness: '4.9 / 5 (Accurate rubric)',
        voiceExperience: '4.9 / 5 (Clear and responsive)',
        easeOfUse: '5.0 / 5 (Delightful)',
        preparedness: '4.9 / 5 (Highly recommended)',
        wouldUseAgain: 'Yes, absolutely',
        recommendationScore: '10 / 10',
        likedMost:
          'The question correctly challenged state machine transitions during delayed webhook execution.',
        shouldBeImproved: 'Nothing major, ready for full rollout.',
        technicalProblem: 'No',
        technicalProblemDesc: 'Zero issues.',
      },
    },
  ])

  // Filter logic
  const filteredFeedback = useMemo(() => {
    return feedbackList.filter((fb) => {
      const matchesSearch =
        fb.participant.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fb.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fb.targetRole.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fb.company.toLowerCase().includes(searchQuery.toLowerCase())

      let matchesStatus = true
      if (statusFilter !== 'All Statuses') {
        matchesStatus = fb.status === statusFilter
      }

      let matchesIssue = true
      if (issueFilter === 'Has Issues') {
        matchesIssue = fb.hasIssue === true
      } else if (issueFilter === 'No Issues') {
        matchesIssue = fb.hasIssue === false
      }

      return matchesSearch && matchesStatus && matchesIssue
    })
  }, [feedbackList, searchQuery, statusFilter, issueFilter])

  // Toggle Review Status handler
  const handleToggleStatus = (feedbackId) => {
    setFeedbackList((prev) =>
      prev.map((item) =>
        item.id === feedbackId
          ? { ...item, status: item.status === 'Reviewed' ? 'Pending' : 'Reviewed' }
          : item
      )
    )

    if (selectedFeedback?.id === feedbackId) {
      setSelectedFeedback((prev) => ({
        ...prev,
        status: prev.status === 'Reviewed' ? 'Pending' : 'Reviewed',
      }))
    }

    setToastMessage('Feedback status updated successfully')
    setTimeout(() => setToastMessage(''), 2500)
  }

  return (
    <div>
      {/* ==================================================================
          1. HEADER
          ================================================================== */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
          User Feedback
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', margin: '3px 0 0' }}>
          Review feedback collected directly through HireMind.
        </p>
      </div>

      {/* ==================================================================
          2. SUMMARY CARDS (5 METRICS)
          ================================================================== */}
      <div className="fb-summary-grid">
        {summaryCards.map((c, i) => {
          const Icon = c.icon
          return (
            <div key={i} className="fb-summary-card">
              <div className="fb-summary-card__top">
                <span className="fb-summary-card__label">{c.label}</span>
                <span className={`fb-summary-card__icon-wrap ${c.colorClass}`}>
                  <Icon size={16} />
                </span>
              </div>
              <div className="fb-summary-card__value">{c.value}</div>
              <div className="fb-summary-card__bottom">
                <span
                  style={{
                    fontWeight: 600,
                    color: c.trendUp ? 'var(--admin-accent-emerald)' : 'var(--admin-accent-rose)',
                  }}
                >
                  {c.trend}
                </span>
                <span style={{ color: 'var(--admin-text-muted)' }}>{c.subtext}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ==================================================================
          3. RATING OVERVIEW (8 CARDS)
          ================================================================== */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
            Rating Overview
          </h3>
          <span style={{ fontSize: '11.5px', color: 'var(--admin-accent-cyan)', fontWeight: 600 }}>
            Aggregated Across All Pilot Submissions
          </span>
        </div>

        <div className="fb-rating-overview-grid">
          {ratingOverviewCards.map((card, idx) => (
            <div key={idx} className="fb-rating-card">
              <span className="fb-rating-card__title">{card.title}</span>
              <div className="fb-rating-card__score-row">
                <span className="fb-rating-card__score-big">{card.score}</span>
                <span className="fb-rating-card__score-denom">/ 5</span>
                <span className="fb-rating-card__stars">★★★★★</span>
              </div>
              <div className="fb-rating-card__bar">
                <div className="fb-rating-card__fill" style={{ width: card.fillWidth }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ==================================================================
          4. CHARTS SECTION (4 CHARTS)
          ================================================================== */}
      <div className="fb-charts-grid">
        {/* Chart 1: Overall Rating Distribution */}
        <div className="fb-chart-card">
          <div className="fb-chart-header">
            <div>
              <h4 className="fb-chart-title">Overall Rating Distribution</h4>
              <p className="fb-chart-desc">Score distribution across candidate responses</p>
            </div>
            <span className="admin-badge admin-badge--emerald">92% Top Box</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '0.5rem' }}>
            {ratingDistribution.map((row) => (
              <div key={row.stars} className="fb-dist-row">
                <span className="fb-dist-label">{row.stars}</span>
                <div className="fb-dist-bar-wrap">
                  <div className="fb-dist-bar-fill" style={{ width: row.width }} />
                </div>
                <span className="fb-dist-percent">{row.percent}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Feedback Responses Over Time */}
        <div className="fb-chart-card">
          <div className="fb-chart-header">
            <div>
              <h4 className="fb-chart-title">Feedback Responses Over Time</h4>
              <p className="fb-chart-desc">Weekly submission velocity during pilot phase</p>
            </div>
            <span className="admin-badge admin-badge--cyan">+42% Growth</span>
          </div>

          <div className="dash-svg-chart-wrap" style={{ height: '140px' }}>
            <svg viewBox="0 0 480 160" style={{ width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="fbAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <line x1="20" y1="50" x2="460" y2="50" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <line x1="20" y1="100" x2="460" y2="100" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <line x1="20" y1="150" x2="460" y2="150" stroke="rgba(255,255,255,0.1)" />

              <path d={responseAreaPath} fill="url(#fbAreaGrad)" />
              <path d={responseStrokePath} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />

              {responsePoints.map((pt, idx) => (
                <circle key={idx} cx={pt.x} cy={pt.y} r="4" fill="#070c18" stroke="#38bdf8" strokeWidth="2.5" />
              ))}
            </svg>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--admin-text-muted)' }}>
            {responsePoints.map((p) => (
              <span key={p.label}>{p.label}</span>
            ))}
          </div>
        </div>

        {/* Chart 3: Would Use HireMind Again */}
        <div className="fb-chart-card">
          <div className="fb-chart-header">
            <div>
              <h4 className="fb-chart-title">Would Use HireMind Again</h4>
              <p className="fb-chart-desc">Candidate retention & satisfaction intent</p>
            </div>
            <span className="admin-badge admin-badge--emerald">Super Majority</span>
          </div>

          <div className="fb-use-again-box">
            <div className="fb-use-again-stat">
              <span className="fb-use-again-stat__val" style={{ color: 'var(--admin-accent-emerald)' }}>
                96%
              </span>
              <span className="fb-use-again-stat__label">Yes, Definitely</span>
            </div>

            <div style={{ width: '1px', height: '45px', background: 'rgba(255,255,255,0.08)' }} />

            <div className="fb-use-again-stat">
              <span className="fb-use-again-stat__val" style={{ color: 'var(--admin-text-dim)' }}>
                4%
              </span>
              <span className="fb-use-again-stat__label">Undecided / No</span>
            </div>
          </div>

          <p style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)', textAlign: 'center', marginTop: '0.85rem', margin: 0 }}>
            Based on 348 verified post-interview exit surveys.
          </p>
        </div>

        {/* Chart 4: Recommendation Score Distribution (NPS) */}
        <div className="fb-chart-card">
          <div className="fb-chart-header">
            <div>
              <h4 className="fb-chart-title">Recommendation Score Distribution</h4>
              <p className="fb-chart-desc">Net Promoter Score (NPS) Breakdown</p>
            </div>
            <span className="admin-badge admin-badge--purple">NPS: +78</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            {npsDistribution.map((item) => (
              <div key={item.category}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                    {item.category}
                  </span>
                  <span style={{ color: 'var(--admin-text-muted)' }}>
                    {item.percent}% ({item.desc})
                  </span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${item.percent}%`, height: '100%', background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ==================================================================
          5. FEEDBACK TABLE
          ================================================================== */}
      <div className="admin-card">
        <div className="int-toolbar">
          <div className="int-toolbar__left">
            <div className="users-search-box">
              <span className="users-search-box__icon">
                <SearchIcon size={14} />
              </span>
              <input
                type="text"
                className="users-search-input"
                placeholder="Search participant, role, company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)', fontWeight: 500 }}>
                Status:
              </span>
              <select
                className="admin-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All Statuses">All Statuses</option>
                <option value="Reviewed">Reviewed</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)', fontWeight: 500 }}>
                Issues:
              </span>
              <select
                className="admin-select"
                value={issueFilter}
                onChange={(e) => setIssueFilter(e.target.value)}
              >
                <option value="All">All Feedback</option>
                <option value="Has Issues">Technical Issues Only</option>
                <option value="No Issues">Zero Issues</option>
              </select>
            </div>
          </div>

          <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
            Showing: <strong style={{ color: 'var(--admin-text-primary)' }}>{filteredFeedback.length}</strong> responses
          </span>
        </div>

        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Target Role</th>
                <th>Overall Rating</th>
                <th>Usefulness</th>
                <th>Technical Issue</th>
                <th>Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredFeedback.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--admin-text-muted)' }}>
                    No feedback matching criteria.
                  </td>
                </tr>
              ) : (
                filteredFeedback.map((fb) => (
                  <tr key={fb.id}>
                    {/* Participant */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                            border: fb.isPilot
                              ? '1.5px solid rgba(168, 85, 247, 0.6)'
                              : '1.5px solid rgba(56, 189, 248, 0.35)',
                            color: fb.isPilot ? 'var(--admin-accent-purple)' : 'var(--admin-accent-cyan)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '12px',
                            flexShrink: 0,
                          }}
                        >
                          {fb.avatar}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                              {fb.participant}
                            </span>
                            {fb.isPilot && (
                              <span
                                className="admin-badge"
                                style={{
                                  fontSize: '10px',
                                  padding: '1px 5px',
                                  background: 'rgba(168, 85, 247, 0.15)',
                                  color: 'var(--admin-accent-purple)',
                                  border: '1px solid rgba(168, 85, 247, 0.3)',
                                }}
                              >
                                Pilot
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
                            {fb.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Target Role & Company */}
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--admin-text-primary)' }}>
                        {fb.targetRole}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--admin-accent-cyan)' }}>
                        @{fb.company}
                      </div>
                    </td>

                    {/* Overall Rating */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: '#fbbf24', fontSize: '12.5px' }}>★</span>
                        <span style={{ fontWeight: 700, color: 'var(--admin-text-primary)', fontSize: '13px' }}>
                          {fb.overallRating.toFixed(1)}
                        </span>
                      </div>
                    </td>

                    {/* Usefulness */}
                    <td>
                      <span style={{ fontSize: '12.5px', color: 'var(--admin-text-secondary)', fontWeight: 500 }}>
                        {fb.usefulnessText}
                      </span>
                    </td>

                    {/* Technical Issue */}
                    <td>
                      {fb.hasIssue ? (
                        <span className="fb-tech-issue-tag">
                          ▲ {fb.technicalIssueText}
                        </span>
                      ) : (
                        <span className="fb-tech-clean-tag">None</span>
                      )}
                    </td>

                    {/* Date */}
                    <td style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                      {fb.submissionDate}
                    </td>

                    {/* Status */}
                    <td>
                      <span
                        className={`admin-badge ${
                          fb.status === 'Reviewed' ? 'fb-status-reviewed' : 'fb-status-pending'
                        }`}
                      >
                        {fb.status}
                      </span>
                    </td>

                    {/* Action: View Feedback */}
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="admin-btn admin-btn--secondary admin-btn--sm"
                        onClick={() => setSelectedFeedback(fb)}
                        style={{ padding: '0 10px', fontSize: '12px' }}
                      >
                        View Feedback
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================================================================
          6. FEEDBACK DETAILS MODAL (LARGE DRAWER)
          ================================================================== */}
      {selectedFeedback && (
        <div className="modal-overlay" onClick={() => setSelectedFeedback(null)}>
          <div className="fb-details-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="fb-details-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--admin-accent-cyan)' }}>
                  {selectedFeedback.id}
                </span>
                <span
                  className={`admin-badge ${
                    selectedFeedback.status === 'Reviewed' ? 'fb-status-reviewed' : 'fb-status-pending'
                  }`}
                >
                  {selectedFeedback.status}
                </span>
                {selectedFeedback.isPilot && (
                  <span className="admin-badge admin-badge--purple">Enterprise Pilot</span>
                )}
              </div>

              <button
                type="button"
                className="admin-sidebar__collapse-btn"
                onClick={() => setSelectedFeedback(null)}
              >
                <CloseIcon size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="fb-details-body">
              {/* Profile & Session Context */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                      border: '2px solid var(--admin-accent-cyan)',
                      color: 'var(--admin-accent-cyan)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '18px',
                    }}
                  >
                    {selectedFeedback.avatar}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
                      {selectedFeedback.participant}
                    </h3>
                    <div style={{ fontSize: '12.5px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                      {selectedFeedback.email} • {selectedFeedback.targetRole} @ {selectedFeedback.company}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
                    Interview Session ID
                  </div>
                  <div style={{ fontFamily: 'monospace', color: 'var(--admin-accent-cyan)', fontWeight: 600 }}>
                    {selectedFeedback.interviewId}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--admin-text-dim)', marginTop: '2px' }}>
                    Submitted: {selectedFeedback.submissionDate}
                  </div>
                </div>
              </div>

              {/* Complete 8 Rating Matrix Scores */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 10px', color: 'var(--admin-text-primary)' }}>
                  Evaluated Dimensions
                </h4>
                <div className="fb-scores-matrix">
                  <div className="fb-score-tile">
                    <span className="fb-score-tile__label">Overall Experience</span>
                    <span className="fb-score-tile__val">{selectedFeedback.answers.overallExperience}</span>
                  </div>
                  <div className="fb-score-tile">
                    <span className="fb-score-tile__label">Usefulness</span>
                    <span className="fb-score-tile__val">{selectedFeedback.answers.usefulness}</span>
                  </div>
                  <div className="fb-score-tile">
                    <span className="fb-score-tile__label">Realism</span>
                    <span className="fb-score-tile__val">{selectedFeedback.answers.realism}</span>
                  </div>
                  <div className="fb-score-tile">
                    <span className="fb-score-tile__label">Question Relevance</span>
                    <span className="fb-score-tile__val">{selectedFeedback.answers.questionRelevance}</span>
                  </div>
                  <div className="fb-score-tile">
                    <span className="fb-score-tile__label">AI Feedback Quality</span>
                    <span className="fb-score-tile__val">{selectedFeedback.answers.aiFeedbackUsefulness}</span>
                  </div>
                  <div className="fb-score-tile">
                    <span className="fb-score-tile__label">Voice Experience</span>
                    <span className="fb-score-tile__val">{selectedFeedback.answers.voiceExperience}</span>
                  </div>
                  <div className="fb-score-tile">
                    <span className="fb-score-tile__label">Ease of Use</span>
                    <span className="fb-score-tile__val">{selectedFeedback.answers.easeOfUse}</span>
                  </div>
                  <div className="fb-score-tile">
                    <span className="fb-score-tile__label">Preparedness</span>
                    <span className="fb-score-tile__val">{selectedFeedback.answers.preparedness}</span>
                  </div>
                </div>
              </div>

              {/* Recommendation & Retention */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div style={{ background: 'rgba(7, 12, 24, 0.65)', border: '1px solid var(--admin-border-subtle)', borderRadius: '8px', padding: '0.85rem' }}>
                  <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>Would Use HireMind Again?</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--admin-accent-emerald)', marginTop: '3px' }}>
                    ✓ {selectedFeedback.answers.wouldUseAgain}
                  </div>
                </div>
                <div style={{ background: 'rgba(7, 12, 24, 0.65)', border: '1px solid var(--admin-border-subtle)', borderRadius: '8px', padding: '0.85rem' }}>
                  <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>Recommendation Score (NPS)</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--admin-accent-cyan)', marginTop: '3px' }}>
                    ★ {selectedFeedback.answers.recommendationScore}
                  </div>
                </div>
              </div>

              {/* What They Liked Most */}
              <div className="fb-feedback-text-card">
                <span className="fb-feedback-text-card__label">
                  <SparklesIcon size={15} /> What They Liked Most
                </span>
                <p className="fb-feedback-text-card__content">
                  "{selectedFeedback.answers.likedMost}"
                </p>
              </div>

              {/* What Should Be Improved */}
              <div className="fb-feedback-text-card">
                <span className="fb-feedback-text-card__label" style={{ color: 'var(--admin-accent-amber)' }}>
                  ▲ What Should Be Improved
                </span>
                <p className="fb-feedback-text-card__content">
                  "{selectedFeedback.answers.shouldBeImproved}"
                </p>
              </div>

              {/* Technical Problem Card */}
              <div
                style={{
                  background: selectedFeedback.hasIssue
                    ? 'rgba(244, 63, 94, 0.08)'
                    : 'rgba(16, 185, 129, 0.05)',
                  border: `1px solid ${
                    selectedFeedback.hasIssue
                      ? 'rgba(244, 63, 94, 0.3)'
                      : 'rgba(16, 185, 129, 0.2)'
                  }`,
                  borderRadius: '8px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 700,
                      color: selectedFeedback.hasIssue
                        ? 'var(--admin-accent-rose)'
                        : 'var(--admin-accent-emerald)',
                    }}
                  >
                    Technical Problem: {selectedFeedback.answers.technicalProblem}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.4 }}>
                  {selectedFeedback.answers.technicalProblemDesc}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="fb-details-footer">
              <button
                type="button"
                className="admin-btn admin-btn--secondary admin-btn--sm"
                onClick={() => handleToggleStatus(selectedFeedback.id)}
              >
                {selectedFeedback.status === 'Reviewed'
                  ? 'Mark as Pending Review'
                  : '✓ Mark as Reviewed'}
              </button>

              <button
                type="button"
                className="admin-btn admin-btn--primary admin-btn--sm"
                onClick={() => setSelectedFeedback(null)}
              >
                Close Feedback Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: '#0f172a',
            border: '1px solid rgba(56, 189, 248, 0.5)',
            color: '#f8fafc',
            padding: '12px 18px',
            borderRadius: '10px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <span style={{ color: 'var(--admin-accent-emerald)' }}>✓</span>
          {toastMessage}
        </div>
      )}
    </div>
  )
}
