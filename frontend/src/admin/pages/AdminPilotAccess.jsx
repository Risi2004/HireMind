import { useState } from 'react'
import {
  PilotAccessIcon,
  UsersIcon,
  InterviewsIcon,
  FeedbackIcon,
  SearchIcon,
  CloseIcon,
  SparklesIcon,
  CheckCircleIcon,
  ClockIcon,
} from '../AdminIcons'
import './AdminPage.css'
import './AdminPilotAccess.css'

export default function AdminPilotAccess() {
  // Summary counts
  const pilotTarget = 15
  const demoAccounts = 12
  const interviewsCompleted = 9
  const feedbackReceived = 8
  const progressPercent = Math.round((interviewsCompleted / pilotTarget) * 100) // 60%

  // ========================================================================
  // PARTICIPANTS DATASET
  // ========================================================================
  const [participants, setParticipants] = useState([
    {
      id: 'PLT-01',
      name: 'Elena Rostova',
      email: 'elena.r@databricks.com',
      avatar: 'E',
      company: 'Databricks',
      role: 'Distributed Systems Lead',
      demoStatus: 'Active',
      startDate: '2025-02-01',
      expiryDate: '2025-03-03',
      interviewsCount: '3 / 5',
      interviewStatus: 'Completed',
      feedback: 'Submitted',
      notes: 'Evaluating for campus engineering recruitment batch of 150 grads.',
      durationLimit: '45 min',
      feedbackScore: '5/5 (NPS: 10)',
      feedbackComment:
        'The Spring Boot distributed cache follow-ups felt authentic and deep. Very impressed with low audio latency.',
      timeline: [
        { title: 'Demo Access Granted', desc: 'Provisioned 5 mock interview passes', time: 'Feb 01, 2025' },
        { title: 'Completed Technical Round', desc: 'Evaluated for Distributed Systems Lead (Score: 91%)', time: 'Feb 10, 2025' },
        { title: 'Feedback Survey Submitted', desc: 'Rated 5/5 Stars with qualitative review', time: 'Feb 12, 2025' },
      ],
    },
    {
      id: 'PLT-02',
      name: 'Marcus Sterling',
      email: 'marcus.s@snowflake.com',
      avatar: 'M',
      company: 'Snowflake',
      role: 'Data Platform Architect',
      demoStatus: 'Active',
      startDate: '2025-02-05',
      expiryDate: '2025-03-07',
      interviewsCount: '2 / 5',
      interviewStatus: 'Completed',
      feedback: 'Submitted',
      notes: 'Testing customized SQL & System Design mock interview scoring.',
      durationLimit: '45 min',
      feedbackScore: '4.8/5 (NPS: 9)',
      feedbackComment:
        'Great technical rigor on SQL query plans. Will recommend to our engineering directors.',
      timeline: [
        { title: 'Demo Access Granted', desc: 'Enterprise pilot trial activated', time: 'Feb 05, 2025' },
        { title: 'Interview Completed', desc: 'Evaluated for Data Platform Lead (Score: 89%)', time: 'Feb 14, 2025' },
        { title: 'Feedback Submitted', desc: 'Provided recruiter evaluation checklist', time: 'Feb 16, 2025' },
      ],
    },
    {
      id: 'PLT-03',
      name: 'Chloe Vance',
      email: 'chloe@stripe.com',
      avatar: 'C',
      company: 'Stripe',
      role: 'Payments Infrastructure Engineer',
      demoStatus: 'Active',
      startDate: '2025-02-10',
      expiryDate: '2025-03-12',
      interviewsCount: '2 / 5',
      interviewStatus: 'Completed',
      feedback: 'Submitted',
      notes: 'Integration with internal recruiter ATS portal in progress.',
      durationLimit: '45 min',
      feedbackScore: '5/5 (NPS: 10)',
      feedbackComment:
        'Accurately questioned webhook retry storms. Candidate score breakdown was thorough.',
      timeline: [
        { title: 'Demo Provisioned', desc: 'Invited by Stripe Talent Team', time: 'Feb 10, 2025' },
        { title: 'Interview Completed', desc: 'Payments Infrastructure round (Score: 90%)', time: 'Feb 18, 2025' },
        { title: 'Feedback Logged', desc: 'Positive validation on ATS integration', time: 'Feb 19, 2025' },
      ],
    },
    {
      id: 'PLT-04',
      name: 'Liam O’Connor',
      email: 'liam@atlassian.com',
      avatar: 'L',
      company: 'Atlassian',
      role: 'Principal Architect',
      demoStatus: 'Active',
      startDate: '2025-02-12',
      expiryDate: '2025-03-14',
      interviewsCount: '1 / 5',
      interviewStatus: 'Completed',
      feedback: 'Submitted',
      notes: 'Approved pilot for Sydney & Bengaluru engineering hubs.',
      durationLimit: '60 min',
      feedbackScore: '5/5 (NPS: 10)',
      feedbackComment:
        'The candidate grounding in verified GitHub repos makes HireMind stand out.',
      timeline: [
        { title: 'Trial Access Issued', desc: 'Granted 60-minute duration sessions', time: 'Feb 12, 2025' },
        { title: 'Interview Session Done', desc: 'Principal Architect round (Score: 94%)', time: 'Feb 19, 2025' },
      ],
    },
    {
      id: 'PLT-05',
      name: 'Sophia Martin',
      email: 'smartin@databricks.com',
      avatar: 'S',
      company: 'Databricks',
      role: 'Engineering Director',
      demoStatus: 'Active',
      startDate: '2025-02-15',
      expiryDate: '2025-03-17',
      interviewsCount: '1 / 5',
      interviewStatus: 'Pending',
      feedback: 'Pending',
      notes: 'Reviewing pilot team results before quarterly procurement review.',
      durationLimit: '45 min',
      feedbackScore: 'Pending',
      feedbackComment: 'Waiting for round completion.',
      timeline: [
        { title: 'Trial Pass Provisioned', desc: 'Active for 30 days', time: 'Feb 15, 2025' },
        { title: 'Interview Scheduled', desc: 'Technical trial session in progress', time: 'Feb 21, 2025' },
      ],
    },
    {
      id: 'PLT-06',
      name: 'Alexander Chen',
      email: 'alex.chen@tech.org',
      avatar: 'A',
      company: 'Google Cloud (Pilot)',
      role: 'Staff Infrastructure Architect',
      demoStatus: 'Active',
      startDate: '2025-01-20',
      expiryDate: '2025-03-22',
      interviewsCount: '4 / 5',
      interviewStatus: 'Completed',
      feedback: 'Submitted',
      notes: 'Multi-region Kubernetes latency and microservices assessment.',
      durationLimit: '45 min',
      feedbackScore: '5/5 (NPS: 10)',
      feedbackComment:
        'Hands down the most realistic AI interviewer I have tested. Probed Paxos vs Raft nicely.',
      timeline: [
        { title: 'Pilot Activated', desc: 'VIP enterprise demo granted', time: 'Jan 20, 2025' },
        { title: 'Interviews Completed', desc: '4 complex rounds finished', time: 'Feb 15, 2025' },
      ],
    },
    {
      id: 'PLT-07',
      name: 'Devon Miles',
      email: 'devon.m@stanford.edu',
      avatar: 'D',
      company: 'Stanford University (Pilot Lab)',
      role: 'Computer Science Research Fellow',
      demoStatus: 'Active',
      startDate: '2025-02-18',
      expiryDate: '2025-03-20',
      interviewsCount: '0 / 5',
      interviewStatus: 'Not Started',
      feedback: 'Pending',
      notes: 'Testing benchmark accuracy for graduate research cohort.',
      durationLimit: '30 min',
      feedbackScore: 'Pending',
      feedbackComment: 'Session not started yet.',
      timeline: [{ title: 'Demo Key Issued', desc: 'Welcome email and OTP sent', time: 'Feb 18, 2025' }],
    },
    {
      id: 'PLT-08',
      name: 'Maya Patel',
      email: 'mpatel@cloudflare.com',
      avatar: 'M',
      company: 'Cloudflare',
      role: 'Senior SRE',
      demoStatus: 'Expired',
      startDate: '2025-01-10',
      expiryDate: '2025-02-10',
      interviewsCount: '3 / 3',
      interviewStatus: 'Completed',
      feedback: 'Submitted',
      notes: 'Pilot completed. Upgraded to annual enterprise contract.',
      durationLimit: '45 min',
      feedbackScore: '4.9/5 (NPS: 10)',
      feedbackComment:
        'Edge network failure scenarios were handled accurately.',
      timeline: [
        { title: 'Demo Started', desc: '14-day evaluation window', time: 'Jan 10, 2025' },
        { title: 'Demo Window Expired', desc: 'Trial completed successfully', time: 'Feb 10, 2025' },
      ],
    },
    {
      id: 'PLT-09',
      name: 'Vikram Joshi',
      email: 'vjoshi@uber.com',
      avatar: 'V',
      company: 'Uber',
      role: 'Tech Lead Manager',
      demoStatus: 'Revoked',
      startDate: '2025-01-05',
      expiryDate: '2025-01-20',
      interviewsCount: '1 / 3',
      interviewStatus: 'Pending',
      feedback: 'Pending',
      notes: 'Revoked on request due to team reorganization.',
      durationLimit: '45 min',
      feedbackScore: 'N/A',
      feedbackComment: 'Access revoked early.',
      timeline: [
        { title: 'Demo Issued', desc: 'Uber pilot trial', time: 'Jan 05, 2025' },
        { title: 'Demo Revoked', desc: 'Admin revoked privileges', time: 'Jan 18, 2025' },
      ],
    },
  ])

  // Mock candidates available for "Search User"
  const candidatePool = [
    { name: 'Jazeel K.', email: 'jazeel@example.com', avatar: 'J', account: 'Candidate Free' },
    { name: 'Sarah Jenkins', email: 'sarah.j@outlook.com', avatar: 'S', account: 'Candidate Pro' },
    { name: 'David Kim', email: 'dkim99@gmail.com', avatar: 'D', account: 'Candidate Free' },
    { name: 'Priya Sharma', email: 'priya.s@design.io', avatar: 'P', account: 'Candidate Pro' },
    { name: 'Marcus Brody', email: 'mbrody@berkeley.edu', avatar: 'M', account: 'Candidate Free' },
    { name: 'Hannah Brooks', email: 'hannah.b@gmail.com', avatar: 'H', account: 'Candidate Free' },
  ]

  // UI Modal State
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('')
  const [configModalUser, setConfigModalUser] = useState(null)
  const [viewParticipantDetails, setViewParticipantDetails] = useState(null)
  const [actionMenuId, setActionMenuId] = useState(null)
  const [toastMessage, setToastMessage] = useState('')

  // Configure Demo Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    startDate: '2025-02-22',
    expiryDate: '2025-03-24',
    interviewLimit: '5',
    maxDuration: '45 min',
    notes: 'Enterprise pilot test pass for engineering team review.',
  })

  // Toast trigger helper
  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 2500)
  }

  // Handle opening Upgrade to Demo form
  const handleSelectCandidateToUpgrade = (candidate) => {
    setConfigModalUser(candidate)
    setFormData({
      name: candidate.name,
      email: candidate.email,
      startDate: '2025-02-22',
      expiryDate: '2025-03-24',
      interviewLimit: '5',
      maxDuration: '45 min',
      notes: `Enterprise pilot access for ${candidate.name}.`,
    })
    setShowSearchModal(false)
  }

  // Confirm Demo Access UI action
  const handleConfirmDemoAccess = (e) => {
    e.preventDefault()

    // Add or update participant
    const newParticipant = {
      id: `PLT-${String(participants.length + 1).padStart(2, '0')}`,
      name: formData.name,
      email: formData.email,
      avatar: formData.name.charAt(0).toUpperCase(),
      company: 'Enterprise Pilot Org',
      role: 'Candidate Trial',
      demoStatus: 'Active',
      startDate: formData.startDate,
      expiryDate: formData.expiryDate,
      interviewsCount: `0 / ${formData.interviewLimit}`,
      interviewStatus: 'Not Started',
      feedback: 'Pending',
      notes: formData.notes,
      durationLimit: formData.maxDuration,
      feedbackScore: 'Pending',
      feedbackComment: 'Trial newly provisioned.',
      timeline: [
        {
          title: 'Demo Access Granted',
          desc: `Provisioned with ${formData.interviewLimit} passes until ${formData.expiryDate}`,
          time: 'Just now',
        },
      ],
    }

    setParticipants((prev) => [newParticipant, ...prev])
    setConfigModalUser(null)
    showToast(`Demo access provisioned for ${formData.name}!`)
  }

  // Action: Extend Demo (adds 14 days)
  const handleExtendDemo = (participant) => {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.id === participant.id) {
          return {
            ...p,
            demoStatus: 'Active',
            expiryDate: '2025-04-10',
            timeline: [
              { title: 'Demo Extended', desc: 'Extended trial window by 14 days', time: 'Just now' },
              ...p.timeline,
            ],
          }
        }
        return p
      })
    )
    setActionMenuId(null)
    showToast(`Demo window extended for ${participant.name}!`)
  }

  // Action: Revoke Demo
  const handleRevokeDemo = (participant) => {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.id === participant.id) {
          return {
            ...p,
            demoStatus: 'Revoked',
            timeline: [
              { title: 'Demo Revoked', desc: 'Admin revoked pilot privileges', time: 'Just now' },
              ...p.timeline,
            ],
          }
        }
        return p
      })
    )
    setActionMenuId(null)
    showToast(`Demo access revoked for ${participant.name}`)
  }

  // Filtered candidate pool
  const filteredCandidates = candidatePool.filter(
    (c) =>
      c.name.toLowerCase().includes(candidateSearchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(candidateSearchQuery.toLowerCase())
  )

  return (
    <div>
      {/* ==================================================================
          1. HEADER & ADD PARTICIPANT BUTTON
          ================================================================== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
            Pilot / Demo Access
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', margin: '3px 0 0' }}>
            Manage participants and demo access for HireMind pilot testing.
          </p>
        </div>

        {/* Prominent Add Pilot Participant Button */}
        <button
          type="button"
          className="pilot-add-btn"
          onClick={() => {
            setCandidateSearchQuery('')
            setShowSearchModal(true)
          }}
        >
          <SparklesIcon size={16} />
          Add Pilot Participant
        </button>
      </div>

      {/* ==================================================================
          2. SUMMARY CARDS & PROGRESS CARD
          ================================================================== */}
      <div className="pilot-summary-grid">
        {/* Pilot Target */}
        <div className="pilot-stat-box">
          <div className="pilot-stat-box__top">
            <span className="pilot-stat-box__label">Pilot Target</span>
            <span className="pilot-stat-box__icon-wrap pilot-stat-box__icon-wrap--cyan">
              <UsersIcon size={18} />
            </span>
          </div>
          <div className="pilot-stat-box__val">{pilotTarget}</div>
          <span style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)' }}>Cohort Goal</span>
        </div>

        {/* Demo Accounts */}
        <div className="pilot-stat-box">
          <div className="pilot-stat-box__top">
            <span className="pilot-stat-box__label">Demo Accounts</span>
            <span className="pilot-stat-box__icon-wrap pilot-stat-box__icon-wrap--purple">
              <PilotAccessIcon size={18} />
            </span>
          </div>
          <div className="pilot-stat-box__val" style={{ color: 'var(--admin-accent-purple)' }}>
            {demoAccounts}
          </div>
          <span style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)' }}>Active & Provisioned</span>
        </div>

        {/* Interviews Completed */}
        <div className="pilot-stat-box">
          <div className="pilot-stat-box__top">
            <span className="pilot-stat-box__label">Interviews Completed</span>
            <span className="pilot-stat-box__icon-wrap pilot-stat-box__icon-wrap--emerald">
              <InterviewsIcon size={18} />
            </span>
          </div>
          <div className="pilot-stat-box__val" style={{ color: 'var(--admin-accent-emerald)' }}>
            {interviewsCompleted}
          </div>
          <span style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)' }}>AI Sessions Evaluated</span>
        </div>

        {/* Feedback Received */}
        <div className="pilot-stat-box">
          <div className="pilot-stat-box__top">
            <span className="pilot-stat-box__label">Feedback Received</span>
            <span className="pilot-stat-box__icon-wrap pilot-stat-box__icon-wrap--amber">
              <FeedbackIcon size={18} />
            </span>
          </div>
          <div className="pilot-stat-box__val" style={{ color: 'var(--admin-accent-amber)' }}>
            {feedbackReceived}
          </div>
          <span style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)' }}>NPS & Quality Surveys</span>
        </div>
      </div>

      {/* Attractive Pilot Progress Card */}
      <div className="pilot-hero-progress">
        <div className="pilot-hero-progress__header">
          <div className="pilot-hero-progress__title-group">
            <h3 className="pilot-hero-progress__title">Pilot Testing Progress</h3>
            <span className="pilot-hero-progress__sub">
              {interviewsCompleted} / {pilotTarget} completed
            </span>
          </div>
          <span className="admin-badge admin-badge--emerald">
            {progressPercent}% Cohort Completion
          </span>
        </div>

        <div className="pilot-hero-progress__track">
          <div
            className="pilot-hero-progress__fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="pilot-hero-progress__markers">
          <span>0 (Start)</span>
          <span>3 (20%)</span>
          <span>6 (40%)</span>
          <span style={{ color: 'var(--admin-accent-cyan)', fontWeight: 600 }}>9 (Current)</span>
          <span>12 (80%)</span>
          <span>15 (Cohort Target)</span>
        </div>
      </div>

      {/* ==================================================================
          3. PILOT PARTICIPANTS TABLE
          ================================================================== */}
      <div className="admin-card">
        <div className="admin-card__header">
          <div className="admin-card__title-group">
            <h3 className="admin-card__title">Pilot Participants</h3>
            <p className="admin-card__subtitle">Roster of candidates and enterprise trial users</p>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
            Total Participants: <strong style={{ color: 'var(--admin-text-primary)' }}>{participants.length}</strong>
          </span>
        </div>

        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Email</th>
                <th>Demo Status</th>
                <th>Start Date</th>
                <th>Expiry Date</th>
                <th>Interviews</th>
                <th>Interview Status</th>
                <th>Feedback</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id}>
                  {/* Participant (Avatar + Name) */}
                  <td>
                    <div className="pilot-table-user">
                      <div className="pilot-table-avatar">{p.avatar}</div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
                          {p.company}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td>
                    <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                      {p.email}
                    </span>
                  </td>

                  {/* Demo Status (Active, Expired, Revoked) */}
                  <td>
                    <span
                      className={`admin-badge ${
                        p.demoStatus === 'Active'
                          ? 'pilot-status-active'
                          : p.demoStatus === 'Expired'
                          ? 'pilot-status-expired'
                          : 'pilot-status-revoked'
                      }`}
                    >
                      {p.demoStatus}
                    </span>
                  </td>

                  {/* Start Date */}
                  <td style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                    {p.startDate}
                  </td>

                  {/* Expiry Date */}
                  <td style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                    {p.expiryDate}
                  </td>

                  {/* Interviews Count */}
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                      {p.interviewsCount}
                    </span>
                  </td>

                  {/* Interview Status (Completed, Pending, Not Started) */}
                  <td>
                    <span
                      className={`admin-badge ${
                        p.interviewStatus === 'Completed'
                          ? 'interview-status-completed'
                          : p.interviewStatus === 'Pending'
                          ? 'interview-status-pending'
                          : 'interview-status-notstarted'
                      }`}
                    >
                      {p.interviewStatus}
                    </span>
                  </td>

                  {/* Feedback (Submitted, Pending) */}
                  <td>
                    <span
                      className={`admin-badge ${
                        p.feedback === 'Submitted'
                          ? 'feedback-submitted'
                          : 'feedback-pending'
                      }`}
                    >
                      {p.feedback}
                    </span>
                  </td>

                  {/* Actions Menu */}
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        type="button"
                        className="user-action-trigger-btn"
                        onClick={() => setActionMenuId((prev) => (prev === p.id ? null : p.id))}
                        title="Actions"
                      >
                        •••
                      </button>

                      {actionMenuId === p.id && (
                        <div className="user-action-menu">
                          <button
                            type="button"
                            className="user-action-menu-item"
                            onClick={() => {
                              setViewParticipantDetails(p)
                              setActionMenuId(null)
                            }}
                          >
                            <UsersIcon size={14} />
                            View Participant
                          </button>

                          <button
                            type="button"
                            className="user-action-menu-item"
                            onClick={() => {
                              setConfigModalUser(p)
                              setFormData({
                                name: p.name,
                                email: p.email,
                                startDate: p.startDate,
                                expiryDate: p.expiryDate,
                                interviewLimit: p.interviewsCount.split('/')[1]?.trim() || '5',
                                maxDuration: p.durationLimit,
                                notes: p.notes,
                              })
                              setActionMenuId(null)
                            }}
                          >
                            <PilotAccessIcon size={14} />
                            Edit Demo Access
                          </button>

                          <button
                            type="button"
                            className="user-action-menu-item"
                            onClick={() => handleExtendDemo(p)}
                          >
                            <ClockIcon size={14} />
                            Extend Demo
                          </button>

                          <button
                            type="button"
                            className="user-action-menu-item"
                            style={{ color: 'var(--admin-accent-rose)' }}
                            onClick={() => handleRevokeDemo(p)}
                          >
                            <CloseIcon size={14} />
                            Revoke Demo
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================================================================
          MODAL 1: SEARCH USER TO ADD PILOT PARTICIPANT
          ================================================================== */}
      {showSearchModal && (
        <div className="modal-overlay" onClick={() => setShowSearchModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-box__header">
              <h3 className="modal-box__title">Search User for Pilot Access</h3>
              <button
                type="button"
                className="admin-sidebar__collapse-btn"
                onClick={() => setShowSearchModal(false)}
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div className="modal-box__body">
              {/* Search Box */}
              <div className="users-search-box" style={{ maxWidth: '100%' }}>
                <span className="users-search-box__icon">
                  <SearchIcon size={15} />
                </span>
                <input
                  type="text"
                  className="users-search-input"
                  placeholder="Search User by name or email..."
                  value={candidateSearchQuery}
                  onChange={(e) => setCandidateSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Search Results List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {filteredCandidates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--admin-text-muted)', fontSize: '13px' }}>
                    No users matching "{candidateSearchQuery}"
                  </div>
                ) : (
                  filteredCandidates.map((c, idx) => (
                    <div key={idx} className="search-candidate-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="pilot-table-avatar">{c.avatar}</div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--admin-text-primary)', fontSize: '13.5px' }}>
                            {c.name}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)' }}>
                            {c.email}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="admin-badge admin-badge--gray">{c.account}</span>
                        <button
                          type="button"
                          className="admin-btn admin-btn--primary admin-btn--sm"
                          onClick={() => handleSelectCandidateToUpgrade(c)}
                        >
                          Upgrade to Demo
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="modal-box__footer">
              <button
                type="button"
                className="admin-btn admin-btn--secondary admin-btn--sm"
                onClick={() => setShowSearchModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================
          MODAL 2: CONFIGURE DEMO ACCESS
          ================================================================== */}
      {configModalUser && (
        <div className="modal-overlay" onClick={() => setConfigModalUser(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-box__header">
              <h3 className="modal-box__title">Configure Demo Access</h3>
              <button
                type="button"
                className="admin-sidebar__collapse-btn"
                onClick={() => setConfigModalUser(null)}
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmDemoAccess}>
              <div className="modal-box__body">
                {/* Participant Name */}
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--admin-text-primary)', display: 'block', marginBottom: '5px' }}>
                    Participant Name
                  </label>
                  <input
                    type="text"
                    className="admin-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--admin-text-primary)', display: 'block', marginBottom: '5px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="admin-input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                {/* Dates Split */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--admin-text-primary)', display: 'block', marginBottom: '5px' }}>
                      Demo Start Date
                    </label>
                    <input
                      type="date"
                      className="admin-input"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--admin-text-primary)', display: 'block', marginBottom: '5px' }}>
                      Demo Expiry Date
                    </label>
                    <input
                      type="date"
                      className="admin-input"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Interview Limits Split */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--admin-text-primary)', display: 'block', marginBottom: '5px' }}>
                      Interview Limit
                    </label>
                    <select
                      className="admin-select"
                      style={{ width: '100%' }}
                      value={formData.interviewLimit}
                      onChange={(e) => setFormData({ ...formData, interviewLimit: e.target.value })}
                    >
                      <option value="3">3 Mock Rounds</option>
                      <option value="5">5 Mock Rounds (Recommended)</option>
                      <option value="10">10 Mock Rounds</option>
                      <option value="Unlimited">Unlimited Evaluation</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--admin-text-primary)', display: 'block', marginBottom: '5px' }}>
                      Maximum Interview Duration
                    </label>
                    <select
                      className="admin-select"
                      style={{ width: '100%' }}
                      value={formData.maxDuration}
                      onChange={(e) => setFormData({ ...formData, maxDuration: e.target.value })}
                    >
                      <option value="30 min">30 Minutes</option>
                      <option value="45 min">45 Minutes (Standard)</option>
                      <option value="60 min">60 Minutes</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--admin-text-primary)', display: 'block', marginBottom: '5px' }}>
                    Notes / Pilot Objective
                  </label>
                  <textarea
                    className="admin-input"
                    style={{ height: '75px', padding: '0.65rem 0.85rem', resize: 'none' }}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-box__footer">
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary admin-btn--sm"
                  onClick={() => setConfigModalUser(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn--primary admin-btn--sm">
                  Confirm Demo Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================
          MODAL 3: PARTICIPANT DETAILS PANEL / MODAL
          ================================================================== */}
      {viewParticipantDetails && (
        <div className="modal-overlay" onClick={() => setViewParticipantDetails(null)}>
          <div className="modal-box details-panel-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-box__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-accent-cyan)' }}>
                  Participant Details
                </span>
                <span
                  className={`admin-badge ${
                    viewParticipantDetails.demoStatus === 'Active'
                      ? 'pilot-status-active'
                      : viewParticipantDetails.demoStatus === 'Expired'
                      ? 'pilot-status-expired'
                      : 'pilot-status-revoked'
                  }`}
                >
                  {viewParticipantDetails.demoStatus} Demo
                </span>
              </div>

              <button
                type="button"
                className="admin-sidebar__collapse-btn"
                onClick={() => setViewParticipantDetails(null)}
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div className="modal-box__body">
              {/* Profile Hero */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="pilot-table-avatar" style={{ width: '50px', height: '50px', fontSize: '19px' }}>
                  {viewParticipantDetails.avatar}
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
                    {viewParticipantDetails.name}
                  </h3>
                  <div style={{ fontSize: '12.5px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                    {viewParticipantDetails.email} • {viewParticipantDetails.role} @ {viewParticipantDetails.company}
                  </div>
                </div>
              </div>

              {/* Demo Access Information Grid */}
              <div className="user-details-grid-meta">
                <div className="user-details-meta-item">
                  <span className="user-details-meta-item__label">Start Date</span>
                  <span className="user-details-meta-item__val">{viewParticipantDetails.startDate}</span>
                </div>
                <div className="user-details-meta-item">
                  <span className="user-details-meta-item__label">Expiry Date</span>
                  <span className="user-details-meta-item__val">{viewParticipantDetails.expiryDate}</span>
                </div>
                <div className="user-details-meta-item">
                  <span className="user-details-meta-item__label">Interview Quota</span>
                  <span className="user-details-meta-item__val" style={{ color: 'var(--admin-accent-cyan)' }}>
                    {viewParticipantDetails.interviewsCount}
                  </span>
                </div>
                <div className="user-details-meta-item">
                  <span className="user-details-meta-item__label">Max Duration</span>
                  <span className="user-details-meta-item__val">{viewParticipantDetails.durationLimit}</span>
                </div>
                <div className="user-details-meta-item">
                  <span className="user-details-meta-item__label">Interview Status</span>
                  <span className="user-details-meta-item__val" style={{ color: 'var(--admin-accent-emerald)' }}>
                    {viewParticipantDetails.interviewStatus}
                  </span>
                </div>
                <div className="user-details-meta-item">
                  <span className="user-details-meta-item__label">Feedback Status</span>
                  <span className="user-details-meta-item__val">{viewParticipantDetails.feedback}</span>
                </div>
              </div>

              {/* Notes */}
              <div style={{ background: 'var(--admin-bg-card-subtle)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--admin-border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Pilot Objectives / Recruiter Notes
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--admin-text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                  {viewParticipantDetails.notes}
                </div>
              </div>

              {/* Feedback Survey Block */}
              {viewParticipantDetails.feedback === 'Submitted' && (
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.06)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '8px',
                    padding: '0.85rem 1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--admin-accent-emerald)' }}>
                      ✓ Feedback Submitted ({viewParticipantDetails.feedbackScore})
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>
                    "{viewParticipantDetails.feedbackComment}"
                  </p>
                </div>
              )}

              {/* Pilot Activity Timeline */}
              <div>
                <h4 style={{ fontSize: '13.5px', fontWeight: 700, margin: '0 0 10px', color: 'var(--admin-text-primary)' }}>
                  Pilot Activity Timeline
                </h4>
                <div className="timeline-feed">
                  {viewParticipantDetails.timeline?.map((entry, idx) => (
                    <div key={idx} className="timeline-entry">
                      <span className="timeline-entry__title">{entry.title}</span>
                      <span className="timeline-entry__desc">{entry.desc}</span>
                      <span className="timeline-entry__time">{entry.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-box__footer">
              <button
                type="button"
                className="admin-btn admin-btn--primary admin-btn--sm"
                onClick={() => setViewParticipantDetails(null)}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Feedback Toast */}
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
