import { useState, useMemo } from 'react'
import {
  InterviewsIcon,
  CheckCircleIcon,
  ActivityIcon,
  XCircleIcon,
  ClockIcon,
  SearchIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  CloseIcon,
  SparklesIcon,
  BotIcon,
} from '../AdminIcons'
import './AdminPage.css'
import './AdminInterviews.css'

export default function AdminInterviews() {
  // State for filters & search
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Statuses')
  const [dateFilter, setDateFilter] = useState('All Time')
  const [demoUserFilter, setDemoUserFilter] = useState('All Users')

  // Selected interview for details drawer/modal
  const [selectedSession, setSelectedSession] = useState(null)

  // ========================================================================
  // 1. SUMMARY CARDS DATA (5 CARDS)
  // ========================================================================
  const summaryCards = [
    {
      label: 'Total Interviews',
      value: '1,420',
      trend: '+22.4%',
      trendUp: true,
      subtext: 'MoM sessions',
      icon: InterviewsIcon,
      colorClass: 'int-summary-card__icon-wrap--cyan',
    },
    {
      label: 'Completed',
      value: '1,296',
      trend: '91.3%',
      trendUp: true,
      subtext: 'high pass finish',
      icon: CheckCircleIcon,
      colorClass: 'int-summary-card__icon-wrap--emerald',
    },
    {
      label: 'In Progress',
      value: '86',
      trend: 'Live Rooms',
      trendUp: true,
      subtext: 'active streaming',
      icon: ActivityIcon,
      colorClass: 'int-summary-card__icon-wrap--purple',
    },
    {
      label: 'Failed',
      value: '26',
      trend: '-2.1%',
      trendUp: false,
      subtext: 'network/drop-off',
      icon: XCircleIcon,
      colorClass: 'int-summary-card__icon-wrap--rose',
    },
    {
      label: 'Average Duration',
      value: '31.4 min',
      trend: '+1.8m',
      trendUp: true,
      subtext: 'target 30-45m',
      icon: ClockIcon,
      colorClass: 'int-summary-card__icon-wrap--amber',
    },
  ]

  // ========================================================================
  // MOCK INTERVIEW SESSIONS DATASET
  // ========================================================================
  const mockSessions = [
    {
      id: 'SES-8901',
      participant: 'Jazeel K.',
      email: 'jazeel@example.com',
      avatar: 'J',
      isDemo: false,
      role: 'Senior Backend Engineer',
      company: 'Microsoft',
      type: 'Technical',
      date: 'Sep 22, 2026',
      rawDate: '2026-09-22',
      startTime: '14:15 UTC',
      duration: '34 min',
      questionsCount: '5 / 5',
      status: 'Completed',
      overallScore: 82,
      evaluation: {
        communication: 86,
        answerRelevance: 84,
        technicalKnowledge: 82,
        overallPerformance: 84,
      },
      conversation: [
        {
          qNum: 1,
          question:
            'Welcome Jazeel! Could you briefly introduce yourself and highlight a complex backend architecture you designed recently?',
          answer:
            'Hello! I am a software engineer specializing in high-throughput backend services. Recently, I built an asynchronous data ingestion platform using Spring Boot and Kafka that processes 25,000 webhook events per second with Redis caching for idempotent deduplication.',
        },
        {
          qNum: 2,
          question:
            'How did you guarantee zero message loss and handle write amplification when Redis cache evictions occur?',
          answer:
            'We implemented a write-behind pattern with a Dead Letter Queue (DLQ) in Kafka. For write amplification, we batched Redis pipeline writes into chunks of 100 keys and used TTL-based expiration with probabilistic early expiration to avoid cache stampedes.',
        },
        {
          qNum: 3,
          question:
            'Let us discuss concurrency: How would you architect a distributed lock across multiple Spring Boot microservice replicas?',
          answer:
            'I would leverage Redlock algorithm with Redis or distributed leases via PostgreSQL advisory locks if Redis persistence is insufficient. We also enforce token renewal heartbeats to guard against slow network partitions prematurely releasing the lock.',
        },
      ],
      feedbackSummary:
        'Candidate demonstrated strong command over distributed caching principles, concurrency controls, and asynchronous messaging pipelines with Spring Boot. Articulated trade-offs clearly under probing questions.',
      strengths: [
        'Deep architectural understanding of Redis write patterns & cache stampede mitigation',
        'Structured and calm reasoning when challenged on concurrency failure modes',
        'High technical fluency matching Senior Staff expectations',
      ],
      improvements: [
        'Could provide more concrete memory sizing calculations when configuring Redis clusters',
        'Mention distributed tracing (OpenTelemetry/Jaeger) during failure recovery walkthroughs',
      ],
      recommendation: 'Strong Hire • Proceed to Onsite Loop',
    },
    {
      id: 'SES-8902',
      participant: 'Alexander Chen',
      email: 'alex.chen@tech.org',
      avatar: 'A',
      isDemo: true,
      role: 'Staff Infrastructure Architect',
      company: 'Google Cloud',
      type: 'System Design',
      date: 'Sep 22, 2026',
      rawDate: '2026-09-22',
      startTime: '12:30 UTC',
      duration: '48 min',
      questionsCount: '6 / 6',
      status: 'Completed',
      overallScore: 92,
      evaluation: {
        communication: 94,
        answerRelevance: 95,
        technicalKnowledge: 90,
        overallPerformance: 93,
      },
      conversation: [
        {
          qNum: 1,
          question:
            'Welcome Alexander. Design a globally distributed key-value store that supports multi-region read replicas with configurable consistency.',
          answer:
            'To meet this requirement, I would structure the cluster into primary consensus groups per partition using Raft, complemented by asynchronously replicated read-replicas across edge POPs using CRDTs or vector clocks for conflict-free resolution.',
        },
        {
          qNum: 2,
          question:
            'How would you handle cross-continental network partitions without violating availability for read operations?',
          answer:
            'We degrade consistency gracefully: local read replicas serve stale reads with bounded staleness guarantees (e.g. max 500ms lag). Clients requesting strict linearizability wait on quorum acks from the primary partition leader.',
        },
        {
          qNum: 3,
          question:
            'Walk me through LSM-Tree compaction strategies when write throughput exceeds 500MB/s per storage node.',
          answer:
            'I would switch from size-tiered compaction to leveled compaction with tiered SSTables at Level 0 to minimize write amplification. We also allocate dedicated NVMe write buffers and throttle incoming writes before memory exhaustion occurs.',
        },
      ],
      feedbackSummary:
        'Exceptional system design mastery. The candidate demonstrated flawless knowledge of consensus algorithms, multi-region failover, and storage engine internals.',
      strengths: [
        'Exemplary command of CAP trade-offs, Raft consensus, and bounded staleness',
        'Crystal-clear communication and structured architectural drawings',
        'Real-world operational awareness regarding NVMe saturation and SSTable compaction',
      ],
      improvements: [
        'Could elaborate on cold-tier object storage archiving policies for multi-year compliance data',
      ],
      recommendation: 'Exceptional • Fast-Track Staff Level Offer',
    },
    {
      id: 'SES-8903',
      participant: 'Michael Vance',
      email: 'm.vance@tech.co',
      avatar: 'M',
      isDemo: false,
      role: 'Full Stack Engineer',
      company: 'Stripe',
      type: 'Technical',
      date: 'Sep 22, 2026',
      rawDate: '2026-09-22',
      startTime: '11:00 UTC',
      duration: '18 min',
      questionsCount: '3 / 5',
      status: 'In Progress',
      overallScore: null,
      evaluation: {
        communication: 80,
        answerRelevance: 78,
        technicalKnowledge: 82,
        overallPerformance: 80,
      },
      conversation: [
        {
          qNum: 1,
          question:
            'Let us discuss webhook reliability: How do you prevent duplicate charge processing when an upstream payment gateway retries a webhook?',
          answer:
            'We record unique transaction idempotency keys in a database with a unique constraint. If a duplicate arrives, the handler returns 200 OK immediately with the cached previous payment response.',
        },
        {
          qNum: 2,
          question:
            'What happens if the database write times out after the external charge has been made but before your status records update?',
          answer:
            'We use a two-phase status model with state machine transitions (Pending -> Confirmed -> Settled) and a reconciliation worker that queries the gateway audit endpoint periodically.',
        },
      ],
      feedbackSummary: 'Session currently active in progress. Candidate is tackling Question 3.',
      strengths: ['Clear grasp of payment idempotency keys and state machine transitions'],
      improvements: ['Pending session completion for comprehensive analysis'],
      recommendation: 'In Progress',
    },
    {
      id: 'SES-8904',
      participant: 'David Kim',
      email: 'dkim99@gmail.com',
      avatar: 'D',
      isDemo: false,
      role: 'Junior Full Stack Developer',
      company: 'Meta',
      type: 'Technical',
      date: 'Sep 21, 2026',
      rawDate: '2026-09-21',
      startTime: '16:40 UTC',
      duration: '08 min',
      questionsCount: '1 / 5',
      status: 'Failed',
      overallScore: 42,
      evaluation: {
        communication: 55,
        answerRelevance: 48,
        technicalKnowledge: 45,
        overallPerformance: 49,
      },
      conversation: [
        {
          qNum: 1,
          question:
            'Can you explain the Virtual DOM in React and why keys are necessary when rendering dynamic lists?',
          answer:
            'The Virtual DOM is a lightweight copy of the real DOM. Keys help React identify which items have changed or removed so it does not re-render the whole list.',
        },
      ],
      feedbackSummary:
        'Session terminated prematurely due to client-side network disconnection during question 2. Marked as failed session drop.',
      strengths: ['Understood high-level purpose of React list keys'],
      improvements: ['Session was dropped before technical evaluation could be completed'],
      recommendation: 'Incomplete Session • Allow Reschedule',
    },
    {
      id: 'SES-8905',
      participant: 'Sarah Jenkins',
      email: 'sarah.j@outlook.com',
      avatar: 'S',
      isDemo: false,
      role: 'Engineering Manager',
      company: 'Uber',
      type: 'Behavioral',
      date: 'Sep 21, 2026',
      rawDate: '2026-09-21',
      startTime: '15:10 UTC',
      duration: '45 min',
      questionsCount: '5 / 5',
      status: 'Completed',
      overallScore: 88,
      evaluation: {
        communication: 92,
        answerRelevance: 89,
        technicalKnowledge: 84,
        overallPerformance: 88,
      },
      conversation: [
        {
          qNum: 1,
          question:
            'Tell me about a time when a critical project deadline was at risk due to misalignment between Product and Engineering.',
          answer:
            'At my previous company, PM wanted to launch 4 additional features two weeks prior to GA. I organized an emergency triage session, quantified technical debt risk, and negotiated a phased rollout where the P0 core launched on time and the rest followed in Sprint 2.',
        },
        {
          qNum: 2,
          question:
            'How do you manage a low-performing senior engineer on a business-critical path without hurting team morale?',
          answer:
            'I hold 1-on-1 private root cause discussions. I set clear 30-day deliverables with measurable checkpoints and pair them with an empathetic lead while clarifying expectations objectively.',
        },
        {
          qNum: 3,
          question:
            'How do you foster an engineering culture that balances technical excellence with business speed?',
          answer:
            'We institute the "20% technical health" policy into every sprint backlog. Refactoring and tech debt cleanup are treated as first-class citizens alongside new product roadmap epics.',
        },
      ],
      feedbackSummary:
        'Outstanding leadership and behavioral acumen. Articulated pragmatic conflict resolution frameworks, structured empathy, and deep technical empathy.',
      strengths: [
        'Structured STAR storytelling methodology throughout all behavioral answers',
        'Demonstrated strong negotiation balance between product velocity and technical stability',
        'Mature perspective on talent management and performance calibration',
      ],
      improvements: [
        'Could include more specific metrics on team retention and sprint velocity post-interventions',
      ],
      recommendation: 'Strong Hire • Engineering Manager Role Approved',
    },
    {
      id: 'SES-8906',
      participant: 'Priya Sharma',
      email: 'priya.s@design.io',
      avatar: 'P',
      isDemo: false,
      role: 'Senior Product Designer',
      company: 'Airbnb',
      type: 'Behavioral',
      date: 'Sep 20, 2026',
      rawDate: '2026-09-20',
      startTime: '10:00 UTC',
      duration: '40 min',
      questionsCount: '5 / 5',
      status: 'Completed',
      overallScore: 85,
      evaluation: {
        communication: 90,
        answerRelevance: 86,
        technicalKnowledge: 82,
        overallPerformance: 86,
      },
      conversation: [
        {
          qNum: 1,
          question:
            'How do you advocate for accessibility and universal design when stakeholders push back citing engineering deadlines?',
          answer:
            'I bring real user session recordings and explain that accessible design expands our total addressable market while improving SEO and overall usability for everyone.',
        },
      ],
      feedbackSummary: 'Strong design leadership and user empathy demonstrated.',
      strengths: ['Great articulation of design systems and accessibility impact'],
      improvements: ['Provide more data on conversion metrics influenced by design updates'],
      recommendation: 'Hire • Product Design Lead',
    },
    {
      id: 'SES-8907',
      participant: 'Chloe Vance',
      email: 'chloe@stripe.com',
      avatar: 'C',
      isDemo: true,
      role: 'Payments Infrastructure Engineer',
      company: 'Stripe (Pilot)',
      type: 'Technical',
      date: 'Sep 19, 2026',
      rawDate: '2026-09-19',
      startTime: '14:00 UTC',
      duration: '44 min',
      questionsCount: '5 / 5',
      status: 'Completed',
      overallScore: 90,
      evaluation: {
        communication: 91,
        answerRelevance: 92,
        technicalKnowledge: 89,
        overallPerformance: 91,
      },
      conversation: [
        {
          qNum: 1,
          question:
            'How do you architect banking webhook reconciliation when partners send delayed callbacks up to 48 hours later?',
          answer:
            'We store asynchronous job tickets in an event log with exponential backoff retries and auto-trigger balance verifications upon callback arrival.',
        },
      ],
      feedbackSummary: 'Excellent payment systems infrastructure evaluation.',
      strengths: ['Deep domain knowledge of banking callbacks and idempotency'],
      improvements: ['Minor pauses when discussing edge latency spikes'],
      recommendation: 'Strong Hire • Senior Payment Engineer',
    },
    {
      id: 'SES-8908',
      participant: 'Liam O’Connor',
      email: 'liam@atlassian.com',
      avatar: 'L',
      isDemo: true,
      role: 'Principal Architect',
      company: 'Atlassian (Pilot)',
      type: 'System Design',
      date: 'Sep 18, 2026',
      rawDate: '2026-09-18',
      startTime: '09:30 UTC',
      duration: '50 min',
      questionsCount: '5 / 5',
      status: 'Completed',
      overallScore: 94,
      evaluation: {
        communication: 95,
        answerRelevance: 96,
        technicalKnowledge: 93,
        overallPerformance: 95,
      },
      conversation: [
        {
          qNum: 1,
          question:
            'How would you migrate a monolith serving 50M daily active users to a multi-tenant microservices topology with zero downtime?',
          answer:
            'We use the Strangler Fig pattern behind an intelligent API Gateway routing traffic by feature flag. We synchronize dual writes with shadow validation before deprecating monolithic endpoints.',
        },
      ],
      feedbackSummary: 'Flawless execution on complex migration architecture.',
      strengths: ['Strangler Fig mastery, canary deployments, zero-downtime database cutovers'],
      improvements: ['None flagged'],
      recommendation: 'Top 1% Candidate • Offer Fast-Track',
    },
    {
      id: 'SES-8909',
      participant: 'Hannah Brooks',
      email: 'hannah.b@gmail.com',
      avatar: 'H',
      isDemo: false,
      role: 'Frontend Engineer',
      company: 'Vercel',
      type: 'Technical',
      date: 'Sep 17, 2026',
      rawDate: '2026-09-17',
      startTime: '13:00 UTC',
      duration: '0 min',
      questionsCount: '0 / 5',
      status: 'Cancelled',
      overallScore: null,
      evaluation: {
        communication: 0,
        answerRelevance: 0,
        technicalKnowledge: 0,
        overallPerformance: 0,
      },
      conversation: [],
      feedbackSummary: 'Interview cancelled by candidate prior to session initiation.',
      strengths: [],
      improvements: [],
      recommendation: 'Cancelled by User',
    },
  ]

  // ========================================================================
  // FILTERING LOGIC
  // ========================================================================
  const filteredSessions = useMemo(() => {
    return mockSessions.filter((s) => {
      // Search
      const matchesSearch =
        s.participant.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase())

      // Status
      let matchesStatus = true
      if (statusFilter !== 'All Statuses') {
        matchesStatus = s.status === statusFilter
      }

      // Date Filter
      let matchesDate = true
      if (dateFilter === 'Today') {
        matchesDate = s.rawDate === '2026-09-22'
      } else if (dateFilter === 'Last 7 Days') {
        matchesDate = true // all in dataset fall into recent week
      }

      // Demo Filter
      let matchesDemo = true
      if (demoUserFilter === 'Demo Users Only') {
        matchesDemo = s.isDemo === true
      } else if (demoUserFilter === 'Regular Users Only') {
        matchesDemo = s.isDemo === false
      }

      return matchesSearch && matchesStatus && matchesDate && matchesDemo
    })
  }, [mockSessions, searchQuery, statusFilter, dateFilter, demoUserFilter])

  return (
    <div>
      {/* ==================================================================
          1. 5 SUMMARY CARDS
          ================================================================== */}
      <div className="int-summary-grid">
        {summaryCards.map((card, idx) => {
          const Icon = card.icon
          return (
            <div key={idx} className="int-summary-card">
              <div className="int-summary-card__top">
                <span className="int-summary-card__label">{card.label}</span>
                <span className={`int-summary-card__icon-wrap ${card.colorClass}`}>
                  <Icon size={16} />
                </span>
              </div>
              <div className="int-summary-card__value">{card.value}</div>
              <div className="int-summary-card__bottom">
                <span
                  style={{
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    color: card.trendUp ? 'var(--admin-accent-emerald)' : 'var(--admin-accent-rose)',
                  }}
                >
                  {card.trendUp ? <TrendingUpIcon size={12} /> : <TrendingDownIcon size={12} />}
                  {card.trend}
                </span>
                <span style={{ color: 'var(--admin-text-muted)' }}>{card.subtext}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ==================================================================
          2. FILTERS & CONTROLS TOOLBAR
          ================================================================== */}
      <div className="admin-card">
        <div className="int-toolbar">
          <div className="int-toolbar__left">
            {/* Search Input */}
            <div className="users-search-box">
              <span className="users-search-box__icon">
                <SearchIcon size={14} />
              </span>
              <input
                type="text"
                className="users-search-input"
                placeholder="Search participant, role, company, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Status Filter */}
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
                <option value="Completed">Completed</option>
                <option value="In Progress">In Progress</option>
                <option value="Failed">Failed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Date Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)', fontWeight: 500 }}>
                Date:
              </span>
              <select
                className="admin-select"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="All Time">All Time</option>
                <option value="Today">Today</option>
                <option value="Last 7 Days">Last 7 Days</option>
                <option value="Last 30 Days">Last 30 Days</option>
              </select>
            </div>

            {/* Demo Users Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)', fontWeight: 500 }}>
                Users:
              </span>
              <select
                className="admin-select"
                value={demoUserFilter}
                onChange={(e) => setDemoUserFilter(e.target.value)}
              >
                <option value="All Users">All Users</option>
                <option value="Demo Users Only">Demo Users Only</option>
                <option value="Regular Users Only">Regular Users Only</option>
              </select>
            </div>
          </div>

          <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
            Total Sessions: <strong style={{ color: 'var(--admin-text-primary)' }}>{filteredSessions.length}</strong>
          </span>
        </div>

        {/* ================================================================
            3. INTERVIEWS TABLE
            ================================================================ */}
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Participant</th>
                <th>Target Role</th>
                <th>Interview Type</th>
                <th>Date</th>
                <th>Duration</th>
                <th>Questions</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--admin-text-muted)' }}>
                    No interview sessions found matching filters.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((s) => (
                  <tr key={s.id}>
                    {/* Session ID */}
                    <td style={{ fontFamily: 'monospace', color: 'var(--admin-accent-cyan)', fontWeight: 600 }}>
                      {s.id}
                    </td>

                    {/* Participant (Avatar, Name, Email, Demo badge) */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                            border: s.isDemo
                              ? '1.5px solid rgba(168, 85, 247, 0.6)'
                              : '1.5px solid rgba(56, 189, 248, 0.35)',
                            color: s.isDemo ? 'var(--admin-accent-purple)' : 'var(--admin-accent-cyan)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {s.avatar}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                              {s.participant}
                            </span>
                            {s.isDemo && (
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
                                Demo
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
                            {s.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Target Role & Company */}
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--admin-text-primary)' }}>
                        {s.role}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--admin-accent-cyan)' }}>
                        @{s.company}
                      </div>
                    </td>

                    {/* Interview Type Badge */}
                    <td>
                      <span
                        className={`admin-badge ${
                          s.type === 'Technical'
                            ? 'badge-type-technical'
                            : s.type === 'System Design'
                            ? 'badge-type-systemdesign'
                            : 'badge-type-behavioral'
                        }`}
                      >
                        {s.type}
                      </span>
                    </td>

                    {/* Date */}
                    <td style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>{s.date}</td>

                    {/* Duration */}
                    <td style={{ fontWeight: 500 }}>{s.duration}</td>

                    {/* Questions */}
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', fontWeight: 500 }}>
                        {s.questionsCount}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td>
                      <span
                        className={`admin-badge ${
                          s.status === 'Completed'
                            ? 'badge-status-completed'
                            : s.status === 'In Progress'
                            ? 'badge-status-inprogress'
                            : s.status === 'Failed'
                            ? 'badge-status-failed'
                            : 'badge-status-cancelled'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>

                    {/* Action Button */}
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="admin-btn admin-btn--secondary admin-btn--sm"
                        onClick={() => setSelectedSession(s)}
                        style={{ padding: '0 10px', fontSize: '12px' }}
                      >
                        View
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
          4. INTERVIEW DETAILS DRAWER / MODAL
          ================================================================== */}
      {selectedSession && (
        <div className="int-details-backdrop" onClick={() => setSelectedSession(null)}>
          <div className="int-details-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="int-details-modal__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: 'monospace', color: 'var(--admin-accent-cyan)', fontWeight: 700, fontSize: '15px' }}>
                  {selectedSession.id}
                </span>
                <span
                  className={`admin-badge ${
                    selectedSession.status === 'Completed'
                      ? 'badge-status-completed'
                      : selectedSession.status === 'In Progress'
                      ? 'badge-status-inprogress'
                      : selectedSession.status === 'Failed'
                      ? 'badge-status-failed'
                      : 'badge-status-cancelled'
                  }`}
                >
                  {selectedSession.status}
                </span>
                {selectedSession.overallScore !== null && (
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color:
                        selectedSession.overallScore >= 80
                          ? 'var(--admin-accent-emerald)'
                          : 'var(--admin-accent-cyan)',
                    }}
                  >
                    Score: {selectedSession.overallScore}%
                  </span>
                )}
              </div>

              <button
                type="button"
                className="admin-sidebar__collapse-btn"
                onClick={() => setSelectedSession(null)}
                aria-label="Close details"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="int-details-modal__body">
              {/* Participant Profile Banner */}
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
                    {selectedSession.avatar}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
                      {selectedSession.participant}
                    </h3>
                    <div style={{ fontSize: '12.5px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                      {selectedSession.email} • {selectedSession.role} @ {selectedSession.company}
                    </div>
                  </div>
                </div>

                <span
                  className={`admin-badge ${
                    selectedSession.type === 'Technical'
                      ? 'badge-type-technical'
                      : selectedSession.type === 'System Design'
                      ? 'badge-type-systemdesign'
                      : 'badge-type-behavioral'
                  }`}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  {selectedSession.type} Round
                </span>
              </div>

              {/* Quick Metadata Strip */}
              <div className="int-details-meta-strip">
                <div className="int-meta-col">
                  <span className="int-meta-col__label">Date & Start Time</span>
                  <span className="int-meta-col__val">
                    {selectedSession.date} ({selectedSession.startTime})
                  </span>
                </div>
                <div className="int-meta-col">
                  <span className="int-meta-col__label">Duration</span>
                  <span className="int-meta-col__val">{selectedSession.duration}</span>
                </div>
                <div className="int-meta-col">
                  <span className="int-meta-col__label">Questions Asked</span>
                  <span className="int-meta-col__val">{selectedSession.questionsCount}</span>
                </div>
                <div className="int-meta-col">
                  <span className="int-meta-col__label">Account Category</span>
                  <span className="int-meta-col__val" style={{ color: selectedSession.isDemo ? 'var(--admin-accent-purple)' : 'var(--admin-text-primary)' }}>
                    {selectedSession.isDemo ? 'Enterprise Pilot' : 'Candidate Standard'}
                  </span>
                </div>
              </div>

              {/* ============================================================
                  MOCK CONVERSATION SECTION (AI & CANDIDATE BUBBLES)
                  ============================================================ */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BotIcon size={16} /> Live Interview Conversation & Dialogue Transcript
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
                    Speech-to-Text Synchronized
                  </span>
                </div>

                {selectedSession.conversation.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--admin-text-muted)', fontSize: '12px', background: 'rgba(7, 12, 24, 0.6)', borderRadius: '8px' }}>
                    No dialogue recorded for this session.
                  </div>
                ) : (
                  <div className="int-conversation-container">
                    {selectedSession.conversation.map((conv, idx) => (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {/* AI Interviewer Question */}
                        <div className="int-convo-bubble int-convo-bubble--ai">
                          <div className="int-convo-speaker-tag int-convo-speaker-tag--ai">
                            <span>🤖 AI INTERVIEWER • Question {conv.qNum}</span>
                            <span style={{ fontSize: '10.5px', color: 'var(--admin-text-dim)' }}>Audio Latency 210ms</span>
                          </div>
                          <p className="int-convo-text">{conv.question}</p>
                        </div>

                        {/* Candidate Answer */}
                        <div className="int-convo-bubble int-convo-bubble--candidate">
                          <div className="int-convo-speaker-tag int-convo-speaker-tag--candidate">
                            <span>👤 {selectedSession.participant.toUpperCase()} (Candidate)</span>
                            <span style={{ fontSize: '10.5px', color: 'var(--admin-accent-emerald)' }}>STT Confidence 99.2%</span>
                          </div>
                          <p className="int-convo-text">"{conv.answer}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ============================================================
                  INTERVIEW EVALUATION SECTION (4 GAUGES / BARS)
                  ============================================================ */}
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 10px', color: 'var(--admin-text-primary)' }}>
                  Interview Evaluation
                </h4>
                <div className="int-eval-grid">
                  {/* Communication */}
                  <div className="int-eval-metric">
                    <div className="int-eval-metric__header">
                      <span className="int-eval-metric__name">Communication</span>
                      <span className="int-eval-metric__score">
                        {selectedSession.evaluation.communication}%
                      </span>
                    </div>
                    <div className="int-eval-metric__track">
                      <div
                        className="int-eval-metric__fill"
                        style={{
                          width: `${selectedSession.evaluation.communication}%`,
                          background: 'var(--admin-accent-cyan)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Answer Relevance */}
                  <div className="int-eval-metric">
                    <div className="int-eval-metric__header">
                      <span className="int-eval-metric__name">Answer Relevance</span>
                      <span className="int-eval-metric__score">
                        {selectedSession.evaluation.answerRelevance}%
                      </span>
                    </div>
                    <div className="int-eval-metric__track">
                      <div
                        className="int-eval-metric__fill"
                        style={{
                          width: `${selectedSession.evaluation.answerRelevance}%`,
                          background: 'var(--admin-accent-purple)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Technical Knowledge */}
                  <div className="int-eval-metric">
                    <div className="int-eval-metric__header">
                      <span className="int-eval-metric__name">Technical Knowledge</span>
                      <span className="int-eval-metric__score">
                        {selectedSession.evaluation.technicalKnowledge}%
                      </span>
                    </div>
                    <div className="int-eval-metric__track">
                      <div
                        className="int-eval-metric__fill"
                        style={{
                          width: `${selectedSession.evaluation.technicalKnowledge}%`,
                          background: 'var(--admin-accent-emerald)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Overall Performance */}
                  <div className="int-eval-metric">
                    <div className="int-eval-metric__header">
                      <span className="int-eval-metric__name">Overall Performance</span>
                      <span className="int-eval-metric__score" style={{ color: 'var(--admin-accent-emerald)' }}>
                        {selectedSession.evaluation.overallPerformance}%
                      </span>
                    </div>
                    <div className="int-eval-metric__track">
                      <div
                        className="int-eval-metric__fill"
                        style={{
                          width: `${selectedSession.evaluation.overallPerformance}%`,
                          background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ============================================================
                  FINAL FEEDBACK SECTION
                  ============================================================ */}
              <div className="int-feedback-card">
                <div className="int-feedback-header">
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--admin-accent-emerald)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <SparklesIcon size={16} /> Final AI Evaluator Assessment
                  </span>
                  <span className="admin-badge admin-badge--emerald">
                    {selectedSession.recommendation}
                  </span>
                </div>

                <p className="int-feedback-summary">{selectedSession.feedbackSummary}</p>

                {selectedSession.strengths?.length > 0 && (
                  <div className="int-feedback-bullets">
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--admin-accent-emerald)', marginBottom: '4px' }}>
                        KEY STRENGTHS
                      </div>
                      <ul className="int-feedback-list">
                        {selectedSession.strengths.map((st, i) => (
                          <li key={i}>✓ {st}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--admin-accent-amber)', marginBottom: '4px' }}>
                        AREAS FOR IMPROVEMENT
                      </div>
                      <ul className="int-feedback-list">
                        {selectedSession.improvements.map((im, i) => (
                          <li key={i}>▲ {im}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="int-details-modal__footer">
              <button
                type="button"
                className="admin-btn admin-btn--primary admin-btn--sm"
                onClick={() => setSelectedSession(null)}
              >
                Close Session Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
