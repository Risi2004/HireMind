import { useState, useMemo } from 'react'
import {
  LogsIcon,
  SearchIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CloseIcon,
  SparklesIcon,
  UsersIcon,
  PilotAccessIcon,
  SettingsIcon,
  BotIcon,
} from '../AdminIcons'
import './AdminPage.css'
import './AdminLogs.css'

export default function AdminLogs() {
  const [activeTab, setActiveTab] = useState('system') // 'system' | 'audit'

  // System Logs Filters
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('All Dates')
  const [statusFilter, setStatusFilter] = useState('All Statuses')

  // Selected log for View Details Modal
  const [selectedLog, setSelectedLog] = useState(null)

  // ========================================================================
  // 1. MOCK SYSTEM LOGS DATA
  // ========================================================================
  const mockSystemLogs = [
    {
      id: 'LOG-9101',
      timestamp: '2026-09-22 14:28:12',
      dateCategory: 'Today',
      category: 'AI',
      event: 'LLM Inference Completed',
      user: 'marcus.s@snowflake.com',
      status: 'Success',
      session: 'INT-9821',
      description:
        'Successfully generated tailored technical question for Data Platform Architect role with query optimization parameters.',
      additionalInfo: {
        latencyMs: 642,
        modelEngine: 'Gemini 1.5 Pro',
        tokensPrompt: 412,
        tokensGenerated: 148,
        clientIpCountry: 'US (Oregon)',
        httpStatus: 200,
        cachedEvaluation: false,
      },
    },
    {
      id: 'LOG-9102',
      timestamp: '2026-09-22 14:24:05',
      dateCategory: 'Today',
      category: 'Speech',
      event: 'Voice Synthesis Streamed',
      user: 'marcus.s@snowflake.com',
      status: 'Success',
      session: 'INT-9821',
      description:
        'ElevenLabs Neural voice chunks synthesized and delivered via WebSocket with 240ms first-chunk audio playback.',
      additionalInfo: {
        voiceProfile: 'Neural-Expressive Low-Latency',
        audioFormat: 'PCM 24kHz Mono',
        durationSec: 8.4,
        streamJitterMs: 14,
        httpStatus: 200,
      },
    },
    {
      id: 'LOG-9103',
      timestamp: '2026-09-22 13:58:30',
      dateCategory: 'Today',
      category: 'Authentication',
      event: 'User Login 2FA Verified',
      user: 'sarah.j@uber.com',
      status: 'Success',
      session: 'None (Auth Gate)',
      description:
        'Candidate successfully authenticated with email credentials and validated time-based OTP token.',
      additionalInfo: {
        authMethod: 'Password + TOTP',
        deviceOs: 'macOS 15.0 / Chrome 129',
        clientIpCountry: 'US (California)',
        mfaAttemptCount: 1,
        httpStatus: 200,
      },
    },
    {
      id: 'LOG-9104',
      timestamp: '2026-09-22 13:12:44',
      dateCategory: 'Today',
      category: 'Errors',
      event: 'RateLimitWarning (429)',
      user: 'System Service',
      status: 'Warning',
      session: 'INT-9818',
      description:
        'LLM API request encountered upstream 429 concurrency throttle. Automatically backed off and resolved on retry 1.',
      additionalInfo: {
        upstreamEndpoint: '/v1beta/models/gemini-pro:generateContent',
        retryAfterMs: 450,
        retryOutcome: 'Success on Attempt 2',
        impact: 'Zero candidate disruption',
        httpStatus: 429,
      },
    },
    {
      id: 'LOG-9105',
      timestamp: '2026-09-22 12:40:19',
      dateCategory: 'Today',
      category: 'Interview',
      event: 'Mock Session Initialized',
      user: 'elena.rostova@palantir.com',
      status: 'Success',
      session: 'INT-9816',
      description:
        'AI interview session started for Senior ML Engineer. Curriculum mapped to PyTorch, transformers, and model inference.',
      additionalInfo: {
        assignedInterviewer: 'HireMind Technical AI Core',
        totalQuestionsScheduled: 5,
        estimatedDurationMins: 35,
        webcamEnabled: true,
        micSampleRateHz: 48000,
      },
    },
    {
      id: 'LOG-9106',
      timestamp: '2026-09-22 11:15:02',
      dateCategory: 'Today',
      category: 'System',
      event: 'Database Health Check',
      user: 'System Service',
      status: 'Success',
      session: 'Global',
      description:
        'Automated database cluster pool telemetry verified. Read replication lag below 3ms across all nodes.',
      additionalInfo: {
        activePoolConnections: 18,
        idleConnections: 42,
        avgQueryLatencyMs: 1.8,
        storageFreePct: '84.2%',
        clusterStatus: 'HEALTHY_GREEN',
      },
    },
    {
      id: 'LOG-9107',
      timestamp: '2026-09-21 16:45:11',
      dateCategory: 'Yesterday',
      category: 'Speech',
      event: 'Microphone Jitter Compensated',
      user: 'dkim99@gmail.com',
      status: 'Warning',
      session: 'INT-9815',
      description:
        'Candidate audio feed experienced temporary buffer underrun (packet latency 110ms). Audio compensation filter engaged.',
      additionalInfo: {
        packetLossPct: '1.4%',
        sttConfidence: 0.91,
        autoCompensated: true,
        droppedFrames: 3,
      },
    },
    {
      id: 'LOG-9108',
      timestamp: '2026-09-21 14:10:00',
      dateCategory: 'Yesterday',
      category: 'Errors',
      event: 'Socket Disconnection',
      user: 'dkim99@gmail.com',
      status: 'Error',
      session: 'INT-9815',
      description:
        'WebSocket connection closed prematurely by candidate client. Session saved into pending recovery state.',
      additionalInfo: {
        closeCode: 1006,
        reason: 'Abnormal Closure (Local network drop)',
        sessionProgress: '2 of 5 Questions completed',
        recoveryLinkIssued: true,
      },
    },
    {
      id: 'LOG-9109',
      timestamp: '2026-09-20 10:22:30',
      dateCategory: 'Last 7 Days',
      category: 'Admin Actions',
      event: 'Demo Access Granted',
      user: 'admin@hiremind.ai',
      status: 'Success',
      session: 'None (Admin Portal)',
      description:
        'Enterprise pilot demo privileges granted to Marcus Sterling (Snowflake) with 3 full practice sessions.',
      additionalInfo: {
        authorizedBy: 'admin@hiremind.ai',
        targetUser: 'marcus.s@snowflake.com',
        allocatedInterviews: 3,
        validityDays: 14,
        roleAssigned: 'Demo / Pilot Participant',
      },
    },
  ]

  // ========================================================================
  // 2. MOCK ADMIN AUDIT LOG DATA
  // ========================================================================
  const mockAuditLogs = [
    {
      id: 'AUD-501',
      timestamp: '2026-09-22 14:15:30',
      adminUser: 'admin@hiremind.ai',
      event: 'Demo Access Granted',
      target: 'Marcus Sterling (marcus.s@snowflake.com)',
      details: 'Assigned 3 mock interviews for Enterprise Pilot evaluation.',
      ip: '192.168.1.42 (Internal VPN)',
      status: 'Success',
    },
    {
      id: 'AUD-502',
      timestamp: '2026-09-22 11:30:10',
      adminUser: 'admin@hiremind.ai',
      event: 'AI Control Changed',
      target: 'Runtime Model: Gemini 1.5 Pro',
      details: 'Switched primary inference model to Gemini 1.5 Pro and capped max questions at 5.',
      ip: '192.168.1.42 (Internal VPN)',
      status: 'Success',
    },
    {
      id: 'AUD-503',
      timestamp: '2026-09-21 17:05:44',
      adminUser: 'secops@hiremind.ai',
      event: 'Settings Updated',
      target: 'Platform Security Policy',
      details: 'Updated maximum candidate idle timeout from 45 mins to 30 mins.',
      ip: '10.0.4.18 (DevOps Bastion)',
      status: 'Success',
    },
    {
      id: 'AUD-504',
      timestamp: '2026-09-21 14:20:15',
      adminUser: 'audit_lead@hiremind.ai',
      event: 'User Viewed',
      target: 'Candidate Profile: Sarah Jenkins (sarah.j@uber.com)',
      details: 'Accessed user profile and interview evaluation history for Pilot QA check.',
      ip: '192.168.1.88 (Internal VPN)',
      status: 'Success',
    },
    {
      id: 'AUD-505',
      timestamp: '2026-09-20 09:12:00',
      adminUser: 'admin@hiremind.ai',
      event: 'Demo Access Revoked',
      target: 'Johnathan Reed (j.reed@temp-trial.com)',
      details: 'Revoked demo access upon trial expiration date.',
      ip: '192.168.1.42 (Internal VPN)',
      status: 'Success',
    },
  ]

  // Category pills list for System Logs
  const categories = [
    'All',
    'System',
    'Authentication',
    'Interview',
    'AI',
    'Speech',
    'Admin Actions',
    'Errors',
  ]

  // Filtered system logs logic
  const filteredSystemLogs = useMemo(() => {
    return mockSystemLogs.filter((log) => {
      // Category Filter
      if (selectedCategory !== 'All') {
        if (selectedCategory === 'Errors') {
          if (log.status !== 'Error' && log.category !== 'Errors') return false
        } else if (log.category !== selectedCategory) {
          return false
        }
      }

      // Date Filter
      if (dateFilter !== 'All Dates') {
        if (log.dateCategory !== dateFilter) return false
      }

      // Status Filter
      if (statusFilter !== 'All Statuses') {
        if (log.status !== statusFilter) return false
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchEvent = log.event.toLowerCase().includes(q)
        const matchUser = log.user.toLowerCase().includes(q)
        const matchDesc = log.description.toLowerCase().includes(q)
        const matchSession = log.session.toLowerCase().includes(q)
        if (!matchEvent && !matchUser && !matchDesc && !matchSession) return false
      }

      return true
    })
  }, [mockSystemLogs, selectedCategory, dateFilter, statusFilter, searchQuery])

  return (
    <div>
      {/* ===================================================================
          1. TABS HEADER (SYSTEM LOGS vs ADMIN AUDIT LOG)
          =================================================================== */}
      <div className="lg-tabs-bar">
        <div className="lg-tabs-group">
          <button
            type="button"
            className={`lg-tab-btn ${activeTab === 'system' ? 'lg-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            <LogsIcon size={16} />
            System Logs ({filteredSystemLogs.length})
          </button>
          <button
            type="button"
            className={`lg-tab-btn ${activeTab === 'audit' ? 'lg-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <SparklesIcon size={16} />
            Admin Audit Log ({mockAuditLogs.length})
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span className="admin-badge admin-badge--emerald">
            ✓ Log Stream Online (Zero Data Leakage)
          </span>
        </div>
      </div>

      {/* ===================================================================
          TAB 1: SYSTEM LOGS
          =================================================================== */}
      {activeTab === 'system' && (
        <div>
          {/* Category Filter Pills */}
          <div className="lg-categories-bar">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`lg-cat-pill ${
                  selectedCategory === cat ? 'lg-cat-pill--active' : ''
                } ${cat === 'Errors' ? 'lg-cat-pill--error' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat === 'Errors' ? '⚠️ ' : ''}
                {cat}
              </button>
            ))}
          </div>

          {/* Search & Filter Toolbar */}
          <div className="lg-toolbar">
            <div className="lg-toolbar-left">
              <div className="admin-search-wrap" style={{ flex: 1 }}>
                <SearchIcon className="admin-search-icon" size={15} />
                <input
                  type="text"
                  placeholder="Search logs by event, user, session, or description..."
                  className="admin-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="lg-toolbar-right">
              {/* Date Filter */}
              <select
                className="admin-select"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{ fontSize: '12px' }}
              >
                <option value="All Dates">All Dates</option>
                <option value="Today">Today</option>
                <option value="Yesterday">Yesterday</option>
                <option value="Last 7 Days">Last 7 Days</option>
              </select>

              {/* Status Filter */}
              <select
                className="admin-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ fontSize: '12px' }}
              >
                <option value="All Statuses">All Statuses</option>
                <option value="Success">Success</option>
                <option value="Warning">Warning</option>
                <option value="Error">Error</option>
              </select>
            </div>
          </div>

          {/* System Logs Table */}
          <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Category</th>
                    <th>Event</th>
                    <th>User</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSystemLogs.length > 0 ? (
                    filteredSystemLogs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ fontFamily: 'monospace', color: 'var(--admin-text-muted)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {log.timestamp}
                        </td>
                        <td>
                          <span
                            className={`admin-badge ${
                              log.category === 'AI'
                                ? 'admin-badge--cyan'
                                : log.category === 'Speech'
                                ? 'admin-badge--purple'
                                : log.category === 'Authentication'
                                ? 'admin-badge--amber'
                                : log.category === 'Errors'
                                ? 'admin-badge--rose'
                                : 'admin-badge--cyan'
                            }`}
                          >
                            {log.category}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                            {log.event}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--admin-text-dim)', marginTop: '2px' }}>
                            {log.session !== 'None' ? `Session: ${log.session}` : ''}
                          </div>
                        </td>
                        <td style={{ fontSize: '12.5px', color: 'var(--admin-text-secondary)' }}>
                          {log.user}
                        </td>
                        <td>
                          {log.status === 'Success' ? (
                            <span className="lg-badge-success">
                              <CheckCircleIcon size={12} /> Success
                            </span>
                          ) : log.status === 'Warning' ? (
                            <span className="lg-badge-warning">
                              ▲ Warning
                            </span>
                          ) : (
                            <span className="lg-badge-error">
                              <XCircleIcon size={12} /> Error
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="admin-btn admin-btn--secondary admin-btn--sm"
                            onClick={() => setSelectedLog(log)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--admin-text-muted)' }}>
                        No logs match your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 2: ADMIN AUDIT LOG
          =================================================================== */}
      {activeTab === 'audit' && (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
              Administrative Governance & Audit Trail
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '2px 0 0' }}>
              Immutable record of permissions granted, configuration updates, and admin investigations
            </p>
          </div>

          <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Admin User</th>
                    <th>Action / Event</th>
                    <th>Target Resource</th>
                    <th>Details</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mockAuditLogs.map((audit) => (
                    <tr key={audit.id}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--admin-text-muted)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {audit.timestamp}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                        {audit.adminUser}
                      </td>
                      <td>
                        <span className="admin-badge admin-badge--purple">
                          {audit.event}
                        </span>
                      </td>
                      <td style={{ color: 'var(--admin-accent-cyan)', fontSize: '12.5px', fontWeight: 600 }}>
                        {audit.target}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', maxWidth: '340px' }}>
                        {audit.details}
                      </td>
                      <td>
                        <span className="lg-badge-success">
                          ✓ {audit.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          LOG DETAILS MODAL (WHEN VIEW IS CLICKED)
          =================================================================== */}
      {selectedLog && (
        <div className="lg-modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="lg-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="lg-modal-header">
              <h3 className="lg-modal-title">
                <LogsIcon size={18} />
                Log Event Details ({selectedLog.id})
              </h3>
              <button
                type="button"
                className="admin-sidebar__collapse-btn"
                onClick={() => setSelectedLog(null)}
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div className="lg-modal-body">
              {/* Event & Status Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
                    {selectedLog.event}
                  </h4>
                  <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                    Category: <strong style={{ color: 'var(--admin-text-primary)' }}>{selectedLog.category}</strong>
                  </div>
                </div>

                <div>
                  {selectedLog.status === 'Success' ? (
                    <span className="lg-badge-success" style={{ fontSize: '12px', padding: '4px 10px' }}>
                      ✓ Success
                    </span>
                  ) : selectedLog.status === 'Warning' ? (
                    <span className="lg-badge-warning" style={{ fontSize: '12px', padding: '4px 10px' }}>
                      ▲ Warning
                    </span>
                  ) : (
                    <span className="lg-badge-error" style={{ fontSize: '12px', padding: '4px 10px' }}>
                      ✕ Error
                    </span>
                  )}
                </div>
              </div>

              {/* 4-Item Grid */}
              <div className="lg-detail-grid">
                <div className="lg-detail-item">
                  <div className="lg-detail-label">Timestamp</div>
                  <div className="lg-detail-val lg-detail-val--code">{selectedLog.timestamp}</div>
                </div>
                <div className="lg-detail-item">
                  <div className="lg-detail-label">User / Initiator</div>
                  <div className="lg-detail-val">{selectedLog.user}</div>
                </div>
                <div className="lg-detail-item">
                  <div className="lg-detail-label">Related Session</div>
                  <div className="lg-detail-val lg-detail-val--code">{selectedLog.session}</div>
                </div>
                <div className="lg-detail-item">
                  <div className="lg-detail-label">Log ID</div>
                  <div className="lg-detail-val lg-detail-val--code">{selectedLog.id}</div>
                </div>
              </div>

              {/* Description */}
              <div className="lg-detail-box">
                <div className="lg-detail-label">Description</div>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--admin-text-primary)', lineHeight: 1.5 }}>
                  {selectedLog.description}
                </p>
              </div>

              {/* Additional Information (Sanitized Metadata - NO SECRETS/KEYS) */}
              <div className="lg-detail-box">
                <div className="lg-detail-label">Additional Information & Telemetry (Sanitized)</div>
                <pre className="lg-json-block">
                  {JSON.stringify(selectedLog.additionalInfo, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
