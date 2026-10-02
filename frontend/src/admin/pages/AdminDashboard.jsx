import { useState } from 'react'
import {
  UsersIcon,
  PilotAccessIcon,
  InterviewsIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ActivityIcon,
  SparklesIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  BotIcon,
  MicIcon,
  VolumeIcon,
  DatabaseIcon,
  CloseIcon,
  SearchIcon,
} from '../AdminIcons'
import './AdminPage.css'
import './AdminDashboard.css'

export default function AdminDashboard() {
  const [activeChartFilter, setActiveChartFilter] = useState('7d')
  const [selectedInterview, setSelectedInterview] = useState(null)
  const [hoveredPoint, setHoveredPoint] = useState(null)

  // ========================================================================
  // 1. TOP 8 STATISTIC CARDS
  // ========================================================================
  const statsData = [
    {
      id: 'total-users',
      label: 'Total Users',
      value: '2,845',
      trend: '+14.2%',
      trendUp: true,
      subtext: 'vs last month',
      icon: UsersIcon,
      colorClass: 'dash-stat-card__icon-box--cyan',
    },
    {
      id: 'active-users',
      label: 'Active Users',
      value: '1,920',
      trend: '+8.6%',
      trendUp: true,
      subtext: 'weekly active',
      icon: ActivityIcon,
      colorClass: 'dash-stat-card__icon-box--emerald',
    },
    {
      id: 'demo-users',
      label: 'Demo Users',
      value: '128',
      trend: '+12 new',
      trendUp: true,
      subtext: 'pilot trials',
      icon: PilotAccessIcon,
      colorClass: 'dash-stat-card__icon-box--purple',
    },
    {
      id: 'total-interviews',
      label: 'Total Interviews',
      value: '1,420',
      trend: '+22.4%',
      trendUp: true,
      subtext: 'MoM volume',
      icon: InterviewsIcon,
      colorClass: 'dash-stat-card__icon-box--blue',
    },
    {
      id: 'interviews-today',
      label: 'Interviews Today',
      value: '42',
      trend: '+18.5%',
      trendUp: true,
      subtext: 'vs yesterday',
      icon: SparklesIcon,
      colorClass: 'dash-stat-card__icon-box--cyan',
    },
    {
      id: 'completed-interviews',
      label: 'Completed Interviews',
      value: '1,296',
      trend: '91.3%',
      trendUp: true,
      subtext: 'completion rate',
      icon: CheckCircleIcon,
      colorClass: 'dash-stat-card__icon-box--emerald',
    },
    {
      id: 'failed-interviews',
      label: 'Failed Interviews',
      value: '38',
      trend: '-2.1%',
      trendUp: false,
      subtext: 'drop / timeout',
      icon: XCircleIcon,
      colorClass: 'dash-stat-card__icon-box--rose',
    },
    {
      id: 'avg-duration',
      label: 'Average Duration',
      value: '31.4 min',
      trend: '+1.8 min',
      trendUp: true,
      subtext: 'target 30-45m',
      icon: ClockIcon,
      colorClass: 'dash-stat-card__icon-box--amber',
    },
  ]

  // ========================================================================
  // 2. PILOT TESTING METRICS
  // ========================================================================
  const pilotTarget = 15
  const demoAccounts = 12
  const interviewsCompleted = 9
  const feedbackReceived = 8
  const completionPercentage = Math.round((interviewsCompleted / pilotTarget) * 100) // 60%

  // ========================================================================
  // 3. CHARTS DATA (INTERVIEWS OVER TIME, USER GROWTH, INTERVIEW STATUS)
  // ========================================================================
  // 7-day trend points: [x, y] coordinates mapped to a 500x180 viewBox
  const lineChartPoints = [
    { label: 'Sep 16', count: 32, x: 20, y: 135 },
    { label: 'Sep 17', count: 45, x: 95, y: 105 },
    { label: 'Sep 18', count: 58, x: 175, y: 80 },
    { label: 'Sep 19', count: 52, x: 255, y: 92 },
    { label: 'Sep 20', count: 74, x: 335, y: 48 },
    { label: 'Sep 21', count: 68, x: 415, y: 60 },
    { label: 'Sep 22', count: 88, x: 480, y: 22 },
  ]

  // SVG Area path for Interviews Over Time
  const areaPath = `M 20,135 L 95,105 L 175,80 L 255,92 L 335,48 L 415,60 L 480,22 L 480,170 L 20,170 Z`
  const strokePath = `M 20,135 L 95,105 L 175,80 L 255,92 L 335,48 L 415,60 L 480,22`

  // User Growth Data
  const userGrowthData = [
    { month: 'Apr', count: '1.2k', height: '42%' },
    { month: 'May', count: '1.5k', height: '52%' },
    { month: 'Jun', count: '1.8k', height: '64%' },
    { month: 'Jul', count: '2.1k', height: '74%' },
    { month: 'Aug', count: '2.5k', height: '88%' },
    { month: 'Sep', count: '2.8k', height: '100%' },
  ]

  // Interview Status Donut Data
  const statusBreakdown = [
    { label: 'Completed', count: 1296, percent: 91.3, color: '#10b981' },
    { label: 'In Progress', count: 86, percent: 6.1, color: '#38bdf8' },
    { label: 'Failed', count: 38, percent: 2.6, color: '#f43f5e' },
  ]

  // ========================================================================
  // 4. RECENT INTERVIEWS TABLE DATA
  // ========================================================================
  const recentInterviews = [
    {
      id: 'INT-901',
      participant: 'Jazeel K.',
      email: 'jazeel@example.com',
      avatar: 'J',
      targetRole: 'Senior Backend Engineer',
      company: 'Microsoft',
      date: 'Today, 14:35',
      duration: '34 min',
      status: 'Completed',
      score: 82,
      summary:
        'Demonstrated strong architectural understanding of Spring Boot distributed caches. Handled concurrency trade-offs smoothly.',
    },
    {
      id: 'INT-902',
      participant: 'Elena Rostova',
      email: 'elena.r@databricks.com',
      avatar: 'E',
      targetRole: 'Distributed Systems Lead',
      company: 'Databricks (Pilot)',
      date: 'Today, 13:10',
      duration: '42 min',
      status: 'Completed',
      score: 91,
      summary:
        'Pilot account evaluation session. In-depth queries on Raft consensus and LSM tree compaction. Flawless reasoning.',
    },
    {
      id: 'INT-903',
      participant: 'Michael Vance',
      email: 'm.vance@tech.co',
      avatar: 'M',
      targetRole: 'Full Stack Engineer',
      company: 'Stripe',
      date: 'Today, 12:45',
      duration: '18 min',
      status: 'In Progress',
      score: null,
      summary:
        'Currently active in technical round. Working on real-time webhook idempotency problem.',
    },
    {
      id: 'INT-904',
      participant: 'David Kim',
      email: 'dkim99@gmail.com',
      avatar: 'D',
      targetRole: 'Junior Frontend Developer',
      company: 'Meta',
      date: 'Today, 11:20',
      duration: '08 min',
      status: 'Failed',
      score: 42,
      summary:
        'Network disconnection by participant during question 2. Marked as incomplete session drop.',
    },
    {
      id: 'INT-905',
      participant: 'Sarah Jenkins',
      email: 'sarah.j@outlook.com',
      avatar: 'S',
      targetRole: 'Engineering Manager',
      company: 'Uber',
      date: 'Yesterday, 17:15',
      duration: '45 min',
      status: 'Completed',
      score: 86,
      summary:
        'Strong behavioral responses, structured conflict resolution methodology, and high team culture calibration.',
    },
  ]

  // ========================================================================
  // 5. RECENT REGISTERED USERS DATA
  // ========================================================================
  const recentUsers = [
    {
      id: 'u-1',
      name: 'Alexander Chen',
      email: 'alex.chen@tech.org',
      avatar: 'A',
      accountType: 'Enterprise',
      typeClass: 'admin-badge--purple',
      joinedDate: '10 mins ago',
    },
    {
      id: 'u-2',
      name: 'Sophia Martin',
      email: 'smartin@databricks.com',
      avatar: 'S',
      accountType: 'Demo / Pilot',
      typeClass: 'admin-badge--cyan',
      joinedDate: '45 mins ago',
    },
    {
      id: 'u-3',
      name: 'Devon Miles',
      email: 'devon.m@stanford.edu',
      avatar: 'D',
      accountType: 'Candidate',
      typeClass: 'admin-badge--gray',
      joinedDate: '2 hours ago',
    },
    {
      id: 'u-4',
      name: 'Priya Sharma',
      email: 'priya.s@design.io',
      avatar: 'P',
      accountType: 'Candidate',
      typeClass: 'admin-badge--gray',
      joinedDate: 'Yesterday',
    },
    {
      id: 'u-5',
      name: 'Liam O’Connor',
      email: 'liam@atlassian.com',
      avatar: 'L',
      accountType: 'Demo / Pilot',
      typeClass: 'admin-badge--cyan',
      joinedDate: '2 days ago',
    },
  ]

  // ========================================================================
  // 6. SYSTEM STATUS CARDS DATA
  // ========================================================================
  const systemServices = [
    {
      name: 'AI Interview Agent',
      status: 'Operational',
      statusType: 'operational',
      latency: '210ms',
      uptime: '99.98%',
      icon: BotIcon,
    },
    {
      name: 'Speech-to-Text',
      status: 'Operational',
      statusType: 'operational',
      latency: '185ms',
      uptime: '99.95%',
      icon: MicIcon,
    },
    {
      name: 'Text-to-Speech',
      status: 'Operational',
      statusType: 'operational',
      latency: '220ms',
      uptime: '99.92%',
      icon: VolumeIcon,
    },
    {
      name: 'Database',
      status: 'Operational',
      statusType: 'operational',
      latency: '1.8ms',
      uptime: '100%',
      icon: DatabaseIcon,
    },
  ]

  return (
    <div>
      {/* ==================================================================
          PAGE SUB-HEADER (Title & Subtitle provided in layout header,
          supplemented here with live sync status and quick filter)
          ================================================================== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
            Dashboard
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', margin: '3px 0 0' }}>
            Overview of your HireMind platform and pilot performance.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="admin-badge admin-badge--emerald">
            <span className="system-status-dot-pulse" />
            Live Telemetry Sync
          </div>
          <select
            className="admin-select"
            value={activeChartFilter}
            onChange={(e) => setActiveChartFilter(e.target.value)}
            style={{ height: '34px', fontSize: '12.5px' }}
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* ==================================================================
          1. TOP STATISTIC CARDS (8 CARDS)
          ================================================================== */}
      <div className="dash-stat-grid">
        {statsData.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.id} className="dash-stat-card">
              <div className="dash-stat-card__top">
                <span className="dash-stat-card__label">{s.label}</span>
                <span className={`dash-stat-card__icon-box ${s.colorClass}`}>
                  <Icon size={18} />
                </span>
              </div>

              <div className="dash-stat-card__value">{s.value}</div>

              <div className="dash-stat-card__bottom">
                <span
                  className={`dash-stat-card__trend ${
                    s.trendUp ? 'dash-stat-card__trend--up' : 'dash-stat-card__trend--down'
                  }`}
                >
                  {s.trendUp ? <TrendingUpIcon size={13} /> : <TrendingDownIcon size={13} />}
                  {s.trend}
                </span>
                <span className="dash-stat-card__trend-sub">{s.subtext}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ==================================================================
          2. PILOT TESTING PROGRESS CARD (LARGE)
          ================================================================== */}
      <div className="pilot-progress-card">
        <div className="pilot-progress-card__header">
          <div className="pilot-progress-card__title-wrap">
            <h3 className="pilot-progress-card__title">Pilot Testing Progress</h3>
            <span className="pilot-progress-card__badge-tag">Cohort Alpha-1</span>
          </div>
          <span className="admin-badge admin-badge--cyan">On Track (60% Target)</span>
        </div>

        {/* 4 Metric Pills */}
        <div className="pilot-progress-card__stats-row">
          <div className="pilot-metric-pill">
            <span className="pilot-metric-pill__label">Pilot Target</span>
            <span className="pilot-metric-pill__val" style={{ color: 'var(--admin-text-primary)' }}>
              {pilotTarget}
            </span>
          </div>

          <div className="pilot-metric-pill">
            <span className="pilot-metric-pill__label">Demo Accounts</span>
            <span className="pilot-metric-pill__val" style={{ color: 'var(--admin-accent-cyan)' }}>
              {demoAccounts}
            </span>
          </div>

          <div className="pilot-metric-pill">
            <span className="pilot-metric-pill__label">Interviews Completed</span>
            <span className="pilot-metric-pill__val" style={{ color: 'var(--admin-accent-emerald)' }}>
              {interviewsCompleted}
            </span>
          </div>

          <div className="pilot-metric-pill">
            <span className="pilot-metric-pill__label">Feedback Received</span>
            <span className="pilot-metric-pill__val" style={{ color: 'var(--admin-accent-amber)' }}>
              {feedbackReceived}
            </span>
          </div>
        </div>

        {/* Visual Progress Bar: 9 / 15 Participants Completed */}
        <div className="pilot-progress-bar-container">
          <div className="pilot-progress-bar-meta">
            <div className="pilot-progress-bar-meta__highlight">
              <SparklesIcon size={16} />
              <span>
                {interviewsCompleted} / {pilotTarget} Participants Completed
              </span>
            </div>
            <span className="pilot-progress-bar-meta__percent">{completionPercentage}% Completed</span>
          </div>

          <div className="pilot-progress-track">
            <div
              className="pilot-progress-fill"
              style={{ width: `${completionPercentage}%` }}
              title={`${completionPercentage}% completed`}
            />
          </div>

          <div className="pilot-progress-markers">
            <span>0</span>
            <span>3 (20%)</span>
            <span>6 (40%)</span>
            <span style={{ color: 'var(--admin-accent-cyan)', fontWeight: 600 }}>9 (Current)</span>
            <span>12 (80%)</span>
            <span>15 (Target)</span>
          </div>
        </div>
      </div>

      {/* ==================================================================
          3. CHARTS SECTION (INTERVIEWS OVER TIME, INTERVIEW STATUS, USER GROWTH)
          ================================================================== */}
      <div className="dash-charts-grid">
        {/* Chart 1: Interviews Over Time */}
        <div className="dash-chart-card">
          <div className="dash-chart-card__header">
            <div>
              <h3 className="dash-chart-card__title">Interviews Over Time</h3>
              <p className="dash-chart-card__sub">Daily interview velocity & completed evaluations</p>
            </div>
            <span className="admin-badge admin-badge--cyan">88 Peak Today</span>
          </div>

          <div className="dash-svg-chart-wrap">
            <svg
              className="dash-svg-chart"
              viewBox="0 0 500 180"
              preserveAspectRatio="none"
              style={{ width: '100%', height: '100%' }}
            >
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines */}
              <line x1="20" y1="35" x2="480" y2="35" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <line x1="20" y1="80" x2="480" y2="80" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <line x1="20" y1="125" x2="480" y2="125" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <line x1="20" y1="170" x2="480" y2="170" stroke="rgba(255,255,255,0.12)" />

              {/* Area Fill */}
              <path d={areaPath} fill="url(#areaGradient)" />

              {/* Line Stroke */}
              <path
                d={strokePath}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Interactive Data Points */}
              {lineChartPoints.map((pt, idx) => (
                <g
                  key={idx}
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredPoint?.label === pt.label ? 6 : 4}
                    fill="#070c18"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                    style={{ transition: 'r 0.15s ease' }}
                  />
                  {/* Point Tooltip on hover */}
                  {hoveredPoint?.label === pt.label && (
                    <g>
                      <rect
                        x={pt.x - 30}
                        y={pt.y - 32}
                        width="60"
                        height="22"
                        rx="4"
                        fill="#0b1222"
                        stroke="#38bdf8"
                        strokeWidth="1"
                      />
                      <text
                        x={pt.x}
                        y={pt.y - 17}
                        fill="#f8fafc"
                        fontSize="11"
                        fontWeight="600"
                        textAnchor="middle"
                      >
                        {pt.count} ints
                      </text>
                    </g>
                  )}
                </g>
              ))}
            </svg>
          </div>

          {/* Bottom Day Labels */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: '8px',
              fontSize: '11px',
              color: 'var(--admin-text-muted)',
            }}
          >
            {lineChartPoints.map((pt) => (
              <span key={pt.label}>{pt.label}</span>
            ))}
          </div>
        </div>

        {/* Chart 3: Interview Status (Donut Visual) */}
        <div className="dash-chart-card">
          <div className="dash-chart-card__header">
            <div>
              <h3 className="dash-chart-card__title">Interview Status</h3>
              <p className="dash-chart-card__sub">Distribution by outcome</p>
            </div>
            <span className="admin-badge admin-badge--emerald">91% Success</span>
          </div>

          <div className="donut-chart-wrap">
            {/* SVG Donut */}
            <div className="donut-svg-container">
              <svg width="150" height="150" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="10"
                />
                {/* Completed Ring Segment (91.3%) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#10b981"
                  strokeWidth="10"
                  strokeDasharray="238.7"
                  strokeDashoffset="21"
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
                {/* In Progress Segment (6.1%) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#38bdf8"
                  strokeWidth="10"
                  strokeDasharray="14.5 238.7"
                  strokeDashoffset="-215"
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
                {/* Failed Segment (2.6%) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#f43f5e"
                  strokeWidth="10"
                  strokeDasharray="6.2 238.7"
                  strokeDashoffset="-232"
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
              </svg>

              <div className="donut-center-label">
                <span className="donut-center-total">1,420</span>
                <span className="donut-center-text">Total</span>
              </div>
            </div>

            {/* Legend Breakdown */}
            <div className="donut-legend">
              {statusBreakdown.map((item) => (
                <div key={item.label} className="donut-legend-item">
                  <div className="donut-legend-left">
                    <span className="donut-legend-dot" style={{ background: item.color }} />
                    <span className="donut-legend-name">{item.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
                      {item.percent}%
                    </span>
                    <span className="donut-legend-val">{item.count.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chart 2: User Growth (Secondary Full/Split Chart) */}
      <div className="dash-chart-card" style={{ marginBottom: '1.75rem' }}>
        <div className="dash-chart-card__header">
          <div>
            <h3 className="dash-chart-card__title">User Growth</h3>
            <p className="dash-chart-card__sub">Cumulative registered candidates and enterprise pilot accounts</p>
          </div>
          <span className="admin-badge admin-badge--purple">+137% Growth Since Apr</span>
        </div>

        <div className="user-growth-bar-chart">
          {userGrowthData.map((item, idx) => (
            <div key={idx} className="user-growth-col">
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--admin-accent-purple)' }}>
                {item.count}
              </span>
              <div className="user-growth-pillar" style={{ height: item.height }} />
              <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>{item.month}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '1rem',
            fontSize: '12px',
            color: 'var(--admin-text-muted)',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span>Average Monthly Additions: +326 Candidates</span>
          <span style={{ color: 'var(--admin-accent-emerald)', fontWeight: 600 }}>
            ● Projected 3,000 Milestone: Next Month
          </span>
        </div>
      </div>

      {/* ==================================================================
          4 & 5. RECENT INTERVIEWS TABLE + RECENT USERS SECTION (SPLIT)
          ================================================================== */}
      <div className="dash-content-split">
        {/* Left 2/3: Recent Interviews Table */}
        <div className="admin-card" style={{ marginBottom: 0 }}>
          <div className="admin-card__header">
            <div className="admin-card__title-group">
              <h3 className="admin-card__title">Recent Interviews</h3>
              <p className="admin-card__subtitle">Candidate sessions and AI evaluation status</p>
            </div>
            <span className="admin-badge admin-badge--cyan">5 Latest Rounds</span>
          </div>

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Target Role</th>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentInterviews.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                            border: '1px solid rgba(56,189,248,0.3)',
                            color: 'var(--admin-accent-cyan)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '12px',
                            flexShrink: 0,
                          }}
                        >
                          {item.avatar}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                            {item.participant}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
                            {item.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ color: 'var(--admin-text-primary)', fontWeight: 500 }}>
                        {item.targetRole}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--admin-accent-cyan)' }}>
                        @{item.company}
                      </div>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>{item.date}</td>
                    <td style={{ fontWeight: 500 }}>{item.duration}</td>
                    <td>
                      <span
                        className={`admin-badge ${
                          item.status === 'Completed'
                            ? 'admin-badge--emerald'
                            : item.status === 'In Progress'
                            ? 'admin-badge--cyan'
                            : 'admin-badge--rose'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="admin-btn admin-btn--secondary admin-btn--sm"
                        onClick={() => setSelectedInterview(item)}
                        style={{ padding: '0 10px', fontSize: '12px' }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1/3: Recent Users Section */}
        <div className="admin-card" style={{ marginBottom: 0 }}>
          <div className="admin-card__header">
            <div className="admin-card__title-group">
              <h3 className="admin-card__title">Recent Users</h3>
              <p className="admin-card__subtitle">Newly registered accounts</p>
            </div>
          </div>

          <div className="recent-users-list">
            {recentUsers.map((u) => (
              <div key={u.id} className="recent-user-row">
                <div className="recent-user-info">
                  <div className="recent-user-avatar">{u.avatar}</div>
                  <div className="recent-user-texts">
                    <span className="recent-user-name">{u.name}</span>
                    <span className="recent-user-email">{u.email}</span>
                  </div>
                </div>

                <div className="recent-user-meta">
                  <span className={`admin-badge ${u.typeClass}`}>{u.accountType}</span>
                  <span style={{ fontSize: '10.5px', color: 'var(--admin-text-dim)' }}>
                    {u.joinedDate}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ==================================================================
          6. SYSTEM STATUS SECTION (4 SERVICE STATUS CARDS)
          ================================================================== */}
      <div style={{ marginTop: '1.75rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
            System Status
          </h3>
          <p style={{ fontSize: '12.5px', color: 'var(--admin-text-muted)', margin: '2px 0 0' }}>
            Live microservices health, speech inference latency, and cluster availability
          </p>
        </div>

        <div className="system-status-grid">
          {systemServices.map((svc, idx) => {
            const Icon = svc.icon
            return (
              <div key={idx} className="system-status-card">
                <div className="system-status-card__header">
                  <div className="system-status-card__name-group">
                    <span className="system-status-card__icon">
                      <Icon size={16} />
                    </span>
                    <span className="system-status-card__name">{svc.name}</span>
                  </div>

                  <span className={`system-status-pill system-status-pill--${svc.statusType}`}>
                    <span className="system-status-dot-pulse" />
                    {svc.status}
                  </span>
                </div>

                <div className="system-status-card__metrics">
                  <span>Latency: <strong style={{ color: 'var(--admin-text-primary)' }}>{svc.latency}</strong></span>
                  <span>Uptime: <strong style={{ color: 'var(--admin-accent-emerald)' }}>{svc.uptime}</strong></span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ==================================================================
          VIEW INTERVIEW DETAILS MODAL (UI ONLY)
          ================================================================== */}
      {selectedInterview && (
        <div className="view-modal-backdrop" onClick={() => setSelectedInterview(null)}>
          <div className="view-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="view-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'monospace', color: 'var(--admin-accent-cyan)', fontWeight: 600 }}>
                  {selectedInterview.id}
                </span>
                <span
                  className={`admin-badge ${
                    selectedInterview.status === 'Completed'
                      ? 'admin-badge--emerald'
                      : selectedInterview.status === 'In Progress'
                      ? 'admin-badge--cyan'
                      : 'admin-badge--rose'
                  }`}
                >
                  {selectedInterview.status}
                </span>
              </div>

              <button
                type="button"
                className="admin-sidebar__collapse-btn"
                onClick={() => setSelectedInterview(null)}
                aria-label="Close modal"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div className="view-modal-body">
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--admin-text-primary)' }}>
                  {selectedInterview.participant}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--admin-text-muted)' }}>
                  {selectedInterview.email} • {selectedInterview.targetRole} @ {selectedInterview.company}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  background: 'rgba(7, 12, 24, 0.6)',
                  borderRadius: '8px',
                  border: '1px solid var(--admin-border-subtle)',
                  textAlign: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>Session Date</div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, marginTop: '2px' }}>
                    {selectedInterview.date}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>Duration</div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, marginTop: '2px' }}>
                    {selectedInterview.duration}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>AI Score</div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color:
                        selectedInterview.score !== null
                          ? selectedInterview.score >= 80
                            ? 'var(--admin-accent-emerald)'
                            : 'var(--admin-accent-amber)'
                          : 'var(--admin-text-muted)',
                      marginTop: '2px',
                    }}
                  >
                    {selectedInterview.score !== null ? `${selectedInterview.score}%` : 'N/A'}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--admin-text-primary)' }}>
                  Evaluation Summary
                </div>
                <p style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
                  {selectedInterview.summary}
                </p>
              </div>

              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--admin-text-primary)' }}>
                  AI Interviewer Feedback
                </div>
                <div
                  style={{
                    background: '#070c18',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                    fontSize: '12px',
                    color: 'var(--admin-accent-cyan)',
                    lineHeight: 1.4,
                  }}
                >
                  ✓ Technical competencies verified against job description. Candidate demonstrated high problem-solving velocity and structured reasoning.
                </div>
              </div>
            </div>

            <div className="view-modal-footer">
              <button
                type="button"
                className="admin-btn admin-btn--primary admin-btn--sm"
                onClick={() => setSelectedInterview(null)}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
