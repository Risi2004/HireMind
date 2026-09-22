import { useState } from 'react'
import {
  PilotAccessIcon,
  UsersIcon,
  InterviewsIcon,
  CheckCircleIcon,
  FeedbackIcon,
  BotIcon,
  ReportsIcon,
  ClockIcon,
  SparklesIcon,
  CloseIcon,
} from '../AdminIcons'
import './AdminPage.css'
import './AdminReports.css'

export default function AdminReports() {
  const [generateModalOpen, setGenerateModalOpen] = useState(false)
  const [previewReport, setPreviewReport] = useState(null)
  const [toastMessage, setToastMessage] = useState('')

  // Generate Report Modal form state
  const [reportType, setReportType] = useState('Pilot Testing Report')
  const [startDate, setStartDate] = useState('2026-09-01')
  const [endDate, setEndDate] = useState('2026-09-22')

  const triggerToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }

  // ========================================================================
  // 1. REPORT CARDS (6 CARDS)
  // ========================================================================
  const reportCards = [
    {
      id: 'REP-PILOT',
      title: 'Pilot Testing Report',
      icon: PilotAccessIcon,
      colorClass: 'rp-card__icon-wrap--purple',
      badge: 'Cohort Alpha',
      badgeColor: 'admin-badge--purple',
      description:
        'End-to-end telemetry on target participant activation, demo accounts, interview completion, and verified feedback ratings.',
      lastGenerated: 'Today at 14:30',
      period: 'Sep 01 – Sep 22, 2026',
    },
    {
      id: 'REP-USERS',
      title: 'User Activity Report',
      icon: UsersIcon,
      colorClass: 'rp-card__icon-wrap--cyan',
      badge: 'Monthly',
      badgeColor: 'admin-badge--cyan',
      description:
        'Talent acquisition velocity, registration conversion, profile completeness, and weekly candidate practice active hours.',
      lastGenerated: 'Yesterday at 18:00',
      period: 'Past 30 Days',
    },
    {
      id: 'REP-USAGE',
      title: 'Interview Usage Report',
      icon: InterviewsIcon,
      colorClass: 'rp-card__icon-wrap--blue',
      badge: 'Weekly',
      badgeColor: 'admin-badge--cyan',
      description:
        'Aggregated mock interview rounds by technical domain, popular roles, questions evaluated, and peak hour velocity.',
      lastGenerated: 'Sep 20, 2026',
      period: 'Past 7 Days',
    },
    {
      id: 'REP-COMPLETION',
      title: 'Interview Completion Report',
      icon: CheckCircleIcon,
      colorClass: 'rp-card__icon-wrap--emerald',
      badge: 'Health',
      badgeColor: 'admin-badge--emerald',
      description:
        'Detailed audit of session completion rates, drop-off questions, abandoned rounds, and candidate retry patterns.',
      lastGenerated: 'Sep 19, 2026',
      period: 'Sep 01 – Sep 19, 2026',
    },
    {
      id: 'REP-FEEDBACK',
      title: 'Feedback Report',
      icon: FeedbackIcon,
      colorClass: 'rp-card__icon-wrap--amber',
      badge: 'Survey',
      badgeColor: 'admin-badge--amber',
      description:
        'Post-interview candidate experience metrics, audio/speech realism scores, and qualitative improvement recommendations.',
      lastGenerated: 'Today at 11:15',
      period: 'All Submissions',
    },
    {
      id: 'REP-AI',
      title: 'AI Usage Report',
      icon: BotIcon,
      colorClass: 'rp-card__icon-wrap--rose',
      badge: 'Infrastructure',
      badgeColor: 'admin-badge--rose',
      description:
        'LLM token utilization, Speech-to-Text inference times, TTS synthesis latency, and daily estimated API consumption cost.',
      lastGenerated: 'Today at 09:00',
      period: 'Current Billing Cycle',
    },
  ]

  // ========================================================================
  // 2. MOCK PILOT TESTING REPORT DATA FOR PREVIEW
  // ========================================================================
  const pilotReportData = {
    title: 'HireMind Pilot Testing Report',
    dateRange: 'Sep 01, 2026 – Sep 22, 2026',
    generatedAt: 'Sep 22, 2026 at 14:30 UTC',
    participants: 15,
    demoAccounts: 12,
    interviewsStarted: 10,
    interviewsCompleted: 9,
    completionRate: '90.0%',
    overallCompletionRate: '60.0%',
    feedbackSubmitted: 8,
    averageRating: '4.8 / 5',
    funnel: [
      { label: 'Participants', count: 15, percent: '100%', fill: '#a855f7' },
      { label: 'Demo Accounts', count: 12, percent: '80.0%', fill: '#38bdf8' },
      { label: 'Interviews Started', count: 10, percent: '66.7%', fill: '#f59e0b' },
      { label: 'Interviews Completed', count: 9, percent: '60.0%', fill: '#10b981' },
      { label: 'Feedback Submitted', count: 8, percent: '53.3%', fill: '#ec4899' },
    ],
    ratingBreakdown: [
      { category: 'Interview Realism', score: '4.9 / 5', percent: 98 },
      { category: 'Interview Usefulness', score: '4.8 / 5', percent: 96 },
      { category: 'AI Feedback Quality', score: '4.7 / 5', percent: 94 },
      { category: 'Voice Synthesis & Timing', score: '4.6 / 5', percent: 92 },
      { category: 'Platform Ease of Use', score: '4.9 / 5', percent: 98 },
    ],
    candidateList: [
      { name: 'Marcus Sterling', role: 'Data Platform Architect', company: 'Snowflake', status: 'Completed', rating: '4.7 / 5', feedback: 'Extremely realistic query optimization probes.' },
      { name: 'Sarah Jenkins', role: 'Engineering Manager', company: 'Uber', status: 'Completed', rating: '4.8 / 5', feedback: 'Great behavioral STAR follow-up questions.' },
      { name: 'Elena Rostova', role: 'Senior ML Engineer', company: 'Palantir', status: 'Completed', rating: '4.9 / 5', feedback: 'Impressive grounding in transformer architecture.' },
      { name: 'David Kim', role: 'Full Stack Engineer', company: 'Meta', status: 'Completed', rating: '4.5 / 5', feedback: 'React Virtual DOM deep dive was insightful.' },
      { name: 'Chloe Vance', role: 'Distributed Systems Lead', company: 'Datadog', status: 'Completed', rating: '4.8 / 5', feedback: 'Raft consensus questions were industry-grade.' },
    ],
  }

  const handleOpenGenerate = () => {
    setGenerateModalOpen(true)
  }

  const handleGenerateSubmit = (e) => {
    e.preventDefault()
    setGenerateModalOpen(false)
    triggerToast(`Generated ${reportType} (${startDate} to ${endDate})`)
    // Open preview for the selected report (defaulting to Pilot Testing structure)
    setPreviewReport({
      type: reportType,
      startDate,
      endDate,
    })
  }

  const handleViewReportCard = (card) => {
    setPreviewReport({
      type: card.title,
      startDate: '2026-09-01',
      endDate: '2026-09-22',
    })
  }

  const handleExportMock = (title) => {
    triggerToast(`Exporting ${title} (PDF/CSV digest)...`)
  }

  return (
    <div>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid var(--admin-accent-cyan)',
            color: 'var(--admin-accent-cyan)',
            padding: '10px 18px',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircleIcon size={16} />
          {toastMessage}
        </div>
      )}

      {/* ===================================================================
          1. TOP BAR WITH GENERATE REPORT ACTION
          =================================================================== */}
      <div className="rp-header-bar">
        <div className="rp-header-left">
          <div className="rp-header-icon">
            <ReportsIcon size={20} />
          </div>
          <div>
            <h1 className="rp-header-title">Executive Reports & Audits</h1>
            <p className="rp-header-subtitle">
              Structured summaries for pilot testing, candidate readiness metrics, and platform telemetry.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={handleOpenGenerate}
        >
          <SparklesIcon size={15} /> Generate Report
        </button>
      </div>

      {/* ===================================================================
          2. REPORT CARDS GRID (6 CARDS)
          =================================================================== */}
      <div className="rp-cards-grid">
        {reportCards.map((card) => {
          const CardIcon = card.icon
          return (
            <div key={card.id} className="rp-card">
              <div className="rp-card__header">
                <div className={`rp-card__icon-wrap ${card.colorClass}`}>
                  <CardIcon size={20} />
                </div>
                <div className="rp-card__body">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 className="rp-card__title">{card.title}</h2>
                    <span className={`admin-badge ${card.badgeColor}`}>{card.badge}</span>
                  </div>
                  <p className="rp-card__desc">{card.description}</p>
                </div>
              </div>

              <div>
                <div className="rp-card__meta">
                  <span>Last Generated: <strong>{card.lastGenerated}</strong></span>
                  <span>{card.period}</span>
                </div>

                <div className="rp-card__actions" style={{ marginTop: '0.85rem' }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn--primary admin-btn--sm rp-card__btn-view"
                    onClick={() => handleViewReportCard(card)}
                  >
                    View Report
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary admin-btn--sm rp-card__btn-export"
                    onClick={() => handleExportMock(card.title)}
                  >
                    Export
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ===================================================================
          3. GENERATE REPORT MODAL
          =================================================================== */}
      {generateModalOpen && (
        <div className="rp-gen-modal-overlay" onClick={() => setGenerateModalOpen(false)}>
          <div className="rp-gen-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="rp-gen-modal-header">
              <h3 className="rp-gen-modal-title">Generate Custom Report</h3>
              <button
                type="button"
                className="admin-sidebar__collapse-btn"
                onClick={() => setGenerateModalOpen(false)}
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <form className="rp-gen-modal-form" onSubmit={handleGenerateSubmit}>
              {/* Report Type */}
              <div className="rp-gen-modal-field">
                <label className="rp-gen-modal-label">Report Type</label>
                <select
                  className="admin-select"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="Pilot Testing Report">Pilot Testing Report</option>
                  <option value="User Activity Report">User Activity Report</option>
                  <option value="Interview Usage Report">Interview Usage Report</option>
                  <option value="Interview Completion Report">Interview Completion Report</option>
                  <option value="Feedback Report">Feedback Report</option>
                  <option value="AI Usage Report">AI Usage Report</option>
                </select>
              </div>

              {/* Start Date */}
              <div className="rp-gen-modal-field">
                <label className="rp-gen-modal-label">Start Date</label>
                <input
                  type="date"
                  className="admin-search-input"
                  style={{ width: '100%' }}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              {/* End Date */}
              <div className="rp-gen-modal-field">
                <label className="rp-gen-modal-label">End Date</label>
                <input
                  type="date"
                  className="admin-search-input"
                  style={{ width: '100%' }}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>

              <div className="rp-gen-modal-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  onClick={() => setGenerateModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn--primary">
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          4. MOCK REPORT PREVIEW MODAL
          =================================================================== */}
      {previewReport && (
        <div className="rp-preview-overlay" onClick={() => setPreviewReport(null)}>
          <div className="rp-preview-container" onClick={(e) => e.stopPropagation()}>
            {/* Preview Header */}
            <div className="rp-preview-header">
              <div className="rp-preview-header-left">
                <span className="rp-preview-badge">Official Report</span>
                <div>
                  <h2 className="rp-preview-header-title">
                    {previewReport.type || 'Pilot Testing Report'}
                  </h2>
                  <p className="rp-preview-header-meta">
                    Period: {previewReport.startDate} to {previewReport.endDate} • Generated: {pilotReportData.generatedAt}
                  </p>
                </div>
              </div>

              <div className="rp-preview-header-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary admin-btn--sm"
                  onClick={() => triggerToast('Exporting PDF document (UI Demo)...')}
                >
                  Export PDF
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary admin-btn--sm"
                  onClick={() => triggerToast('Exporting CSV raw dataset (UI Demo)...')}
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  className="admin-sidebar__collapse-btn"
                  onClick={() => setPreviewReport(null)}
                >
                  <CloseIcon size={16} />
                </button>
              </div>
            </div>

            {/* Preview Scrollable Body */}
            <div className="rp-preview-body">
              {/* Required Pilot Metrics Cards (Participants, Demo Accounts, Started, Completed, Rate, Feedback, Avg Rating) */}
              <div className="rp-pilot-metrics-grid">
                <div className="rp-pilot-metric-chip">
                  <span className="rp-pilot-metric-label">Participants</span>
                  <span className="rp-pilot-metric-val" style={{ color: 'var(--admin-accent-purple)' }}>
                    {pilotReportData.participants}
                  </span>
                  <span className="rp-pilot-metric-sub">target cohort size</span>
                </div>

                <div className="rp-pilot-metric-chip">
                  <span className="rp-pilot-metric-label">Demo Accounts</span>
                  <span className="rp-pilot-metric-val" style={{ color: 'var(--admin-accent-cyan)' }}>
                    {pilotReportData.demoAccounts}
                  </span>
                  <span className="rp-pilot-metric-sub">activated privileges</span>
                </div>

                <div className="rp-pilot-metric-chip">
                  <span className="rp-pilot-metric-label">Interviews Started</span>
                  <span className="rp-pilot-metric-val" style={{ color: 'var(--admin-accent-amber)' }}>
                    {pilotReportData.interviewsStarted}
                  </span>
                  <span className="rp-pilot-metric-sub">initiated rounds</span>
                </div>

                <div className="rp-pilot-metric-chip">
                  <span className="rp-pilot-metric-label">Interviews Completed</span>
                  <span className="rp-pilot-metric-val" style={{ color: 'var(--admin-accent-emerald)' }}>
                    {pilotReportData.interviewsCompleted}
                  </span>
                  <span className="rp-pilot-metric-sub">evaluated sessions</span>
                </div>

                <div className="rp-pilot-metric-chip">
                  <span className="rp-pilot-metric-label">Completion Rate</span>
                  <span className="rp-pilot-metric-val" style={{ color: 'var(--admin-accent-emerald)' }}>
                    {pilotReportData.completionRate}
                  </span>
                  <span className="rp-pilot-metric-sub">started vs completed (90%)</span>
                </div>

                <div className="rp-pilot-metric-chip">
                  <span className="rp-pilot-metric-label">Feedback Submitted</span>
                  <span className="rp-pilot-metric-val" style={{ color: '#ec4899' }}>
                    {pilotReportData.feedbackSubmitted}
                  </span>
                  <span className="rp-pilot-metric-sub">completed reviews</span>
                </div>

                <div className="rp-pilot-metric-chip" style={{ gridColumn: 'span 2' }}>
                  <span className="rp-pilot-metric-label">Average Rating</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="rp-pilot-metric-val" style={{ color: 'var(--admin-accent-cyan)' }}>
                      {pilotReportData.averageRating}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--admin-accent-emerald)', fontWeight: 600 }}>
                      ★★★★★ (High Pilot Satisfaction)
                    </span>
                  </div>
                  <span className="rp-pilot-metric-sub">across 8 comprehensive feedback questionnaires</span>
                </div>
              </div>

              {/* Visual Mock Charts Inside Preview */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.25rem' }}>
                {/* Funnel Progress Chart */}
                <div className="rp-preview-funnel-card">
                  <h3 className="rp-preview-funnel-title">Pilot Progression & Conversion Funnel</h3>
                  <div className="rp-preview-funnel-bars">
                    {pilotReportData.funnel.map((item, idx) => (
                      <div key={idx} className="rp-preview-funnel-item">
                        <span className="rp-preview-funnel-label">{item.label}</span>
                        <div className="rp-preview-funnel-bar-track">
                          <div
                            className="rp-preview-funnel-bar-fill"
                            style={{ width: item.percent, background: item.fill }}
                          >
                            {item.count}
                          </div>
                        </div>
                        <span className="rp-preview-funnel-stat">{item.percent}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rating Dimensions Breakdown */}
                <div className="rp-preview-funnel-card">
                  <h3 className="rp-preview-funnel-title">Evaluation Dimensions Breakdown</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {pilotReportData.ratingBreakdown.map((r, idx) => (
                      <div key={idx}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                          <span style={{ color: 'var(--admin-text-primary)', fontWeight: 600 }}>{r.category}</span>
                          <span style={{ color: 'var(--admin-accent-cyan)', fontWeight: 700 }}>{r.score}</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${r.percent}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #10b981)' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sample Pilot Participants Digest Table */}
              <div style={{ background: 'rgba(7, 12, 24, 0.65)', border: '1px solid var(--admin-border-subtle)', borderRadius: '8px', padding: '1rem' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 10px', color: 'var(--admin-text-primary)' }}>
                  Verified Pilot Candidate Submissions
                </h3>
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Participant</th>
                        <th>Target Role</th>
                        <th>Status</th>
                        <th>Rating</th>
                        <th>Key Feedback Quoted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pilotReportData.candidateList.map((c, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                            {c.name}
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                            {c.role} @ {c.company}
                          </td>
                          <td>
                            <span className="admin-badge admin-badge--emerald">
                              {c.status}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--admin-accent-cyan)' }}>
                            {c.rating}
                          </td>
                          <td style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)', fontStyle: 'italic', maxWidth: '280px' }}>
                            "{c.feedback}"
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
