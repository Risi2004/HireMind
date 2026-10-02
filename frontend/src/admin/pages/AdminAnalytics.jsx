import { useState } from 'react'
import {
  UsersIcon,
  InterviewsIcon,
  ClockIcon,
  SparklesIcon,
  PilotAccessIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ActivityIcon,
  CheckCircleIcon,
  FeedbackIcon,
  SearchIcon,
  BotIcon,
} from '../AdminIcons'
import './AdminPage.css'
import './AdminAnalytics.css'

export default function AdminAnalytics() {
  const [selectedRange, setSelectedRange] = useState('30d') // 'today', '7d', '30d', 'custom'
  const [customStartDate, setCustomStartDate] = useState('2026-09-01')
  const [customEndDate, setCustomEndDate] = useState('2026-09-22')
  const [appliedCustomLabel, setAppliedCustomLabel] = useState('Sep 01, 2026 – Sep 22, 2026')
  const [activeTooltip, setActiveTooltip] = useState(null)

  // ========================================================================
  // 1. DYNAMIC METRIC DATA BASED ON DATE FILTER
  // ========================================================================
  const analyticsByRange = {
    today: {
      label: 'Today (Sep 22, 2026)',
      kpis: {
        totalUsers: { value: '2,840', trend: '+18 today', trendUp: true, sub: 'registered total' },
        activeUsers: { value: '412', trend: '+8.2%', trendUp: true, sub: '14.5% daily active' },
        totalInterviews: { value: '46', trend: '+12 vs yesterday', trendUp: true, sub: 'rounds started' },
        completionRate: { value: '93.5%', trend: '+1.4%', trendUp: true, sub: '43 completed' },
        avgDuration: { value: '27m 50s', trend: '-45s', trendUp: true, sub: 'fast session pacing' },
        avgInterviewsPerUser: { value: '1.8', trend: '+0.2', trendUp: true, sub: 'daily session velocity' },
      },
      interviewsVelocity: [
        { label: '08:00', sessions: 2, height: '25%', completed: 2 },
        { label: '10:00', sessions: 8, height: '70%', completed: 8 },
        { label: '12:00', sessions: 11, height: '100%', completed: 10 },
        { label: '14:00', sessions: 9, height: '82%', completed: 9 },
        { label: '16:00', sessions: 10, height: '90%', completed: 9 },
        { label: '18:00', sessions: 6, height: '55%', completed: 5 },
      ],
    },
    '7d': {
      label: 'Past 7 Days (Sep 15 – Sep 22)',
      kpis: {
        totalUsers: { value: '2,840', trend: '+142 this week', trendUp: true, sub: 'registered total' },
        activeUsers: { value: '1,180', trend: '+14.2%', trendUp: true, sub: '41.5% weekly active' },
        totalInterviews: { value: '328', trend: '+22.4%', trendUp: true, sub: 'rounds started' },
        completionRate: { value: '92.1%', trend: '+0.8%', trendUp: true, sub: '302 completed' },
        avgDuration: { value: '28m 15s', trend: '+30s', trendUp: true, sub: 'thorough discussions' },
        avgInterviewsPerUser: { value: '2.1', trend: '+0.3', trendUp: true, sub: 'repeat practice rate' },
      },
      interviewsVelocity: [
        { label: 'Mon', sessions: 42, height: '62%', completed: 39 },
        { label: 'Tue', sessions: 48, height: '71%', completed: 44 },
        { label: 'Wed', sessions: 58, height: '85%', completed: 54 },
        { label: 'Thu', sessions: 68, height: '100%', completed: 63 },
        { label: 'Fri', sessions: 52, height: '76%', completed: 48 },
        { label: 'Sat', sessions: 28, height: '41%', completed: 26 },
        { label: 'Sun', sessions: 32, height: '47%', completed: 28 },
      ],
    },
    '30d': {
      label: 'Past 30 Days (Aug 23 – Sep 22)',
      kpis: {
        totalUsers: { value: '2,840', trend: '+480 this month', trendUp: true, sub: 'registered total' },
        activeUsers: { value: '1,940', trend: '+18.4%', trendUp: true, sub: '68.3% monthly active' },
        totalInterviews: { value: '1,280', trend: '+28.5%', trendUp: true, sub: 'rounds started' },
        completionRate: { value: '92.4%', trend: '+2.1%', trendUp: true, sub: '1,183 completed' },
        avgDuration: { value: '28m 42s', trend: '+1m 15s', trendUp: true, sub: 'optimal depth' },
        avgInterviewsPerUser: { value: '2.4', trend: '+0.4', trendUp: true, sub: 'repeat practice rate' },
      },
      interviewsVelocity: [
        { label: 'Week 1', sessions: 260, height: '72%', completed: 238 },
        { label: 'Week 2', sessions: 295, height: '82%', completed: 271 },
        { label: 'Week 3', sessions: 345, height: '96%', completed: 320 },
        { label: 'Week 4', sessions: 380, height: '100%', completed: 354 },
      ],
    },
    custom: {
      label: appliedCustomLabel,
      kpis: {
        totalUsers: { value: '2,840', trend: '+360 in period', trendUp: true, sub: 'custom timeframe' },
        activeUsers: { value: '1,640', trend: '+12.5%', trendUp: true, sub: 'active during filter' },
        totalInterviews: { value: '940', trend: '+19.2%', trendUp: true, sub: 'rounds started' },
        completionRate: { value: '92.8%', trend: '+1.9%', trendUp: true, sub: '872 completed' },
        avgDuration: { value: '28m 30s', trend: '+45s', trendUp: true, sub: 'custom window avg' },
        avgInterviewsPerUser: { value: '2.3', trend: '+0.3', trendUp: true, sub: 'repeat practice rate' },
      },
      interviewsVelocity: [
        { label: 'Period 1', sessions: 180, height: '65%', completed: 166 },
        { label: 'Period 2', sessions: 220, height: '79%', completed: 204 },
        { label: 'Period 3', sessions: 260, height: '93%', completed: 242 },
        { label: 'Period 4', sessions: 280, height: '100%', completed: 260 },
      ],
    },
  }

  const currentData = analyticsByRange[selectedRange] || analyticsByRange['30d']

  // ========================================================================
  // 2. MOST POPULAR TARGET ROLES DATA
  // ========================================================================
  const popularRoles = [
    {
      role: 'Full Stack Engineer',
      count: 410,
      percent: 32,
      fillWidth: '100%',
      badge: 'High Demand',
    },
    {
      role: 'Frontend Engineer (React / TypeScript)',
      count: 307,
      percent: 24,
      fillWidth: '75%',
      badge: 'Popular',
    },
    {
      role: 'Backend Engineer (Java / Spring / Go)',
      count: 243,
      percent: 19,
      fillWidth: '59%',
      badge: 'Technical',
    },
    {
      role: 'AI & Machine Learning Engineer',
      count: 179,
      percent: 14,
      fillWidth: '44%',
      badge: 'Surging',
    },
    {
      role: 'DevOps & Cloud Infrastructure',
      count: 141,
      percent: 11,
      fillWidth: '34%',
      badge: 'Enterprise',
    },
  ]

  // ========================================================================
  // 3. INTERVIEW DURATION DISTRIBUTION HISTOGRAM
  // ========================================================================
  const durationBuckets = [
    {
      bracket: '< 15 mins',
      label: 'Quick Warm-up',
      percent: 6,
      count: 77,
      fillWidth: '11%',
      isPeak: false,
    },
    {
      bracket: '15 - 25 mins',
      label: 'Topic Drill',
      percent: 22,
      count: 281,
      fillWidth: '41%',
      isPeak: false,
    },
    {
      bracket: '25 - 35 mins',
      label: 'Full Standard Round',
      percent: 54,
      count: 691,
      fillWidth: '100%',
      isPeak: true, // Median sweet spot
    },
    {
      bracket: '35 - 45 mins',
      label: 'Senior Architecture',
      percent: 14,
      count: 179,
      fillWidth: '26%',
      isPeak: false,
    },
    {
      bracket: '> 45 mins',
      label: 'Comprehensive Deep Dive',
      percent: 4,
      count: 52,
      fillWidth: '7%',
      isPeak: false,
    },
  ]

  // ========================================================================
  // 4. PILOT ANALYTICS CONVERSION FUNNEL
  // ========================================================================
  const pilotFunnelStages = [
    {
      stage: 'Pilot Participants',
      count: 15,
      percentOfTarget: '100%',
      backdropWidth: '100%',
      conversionFromPrev: null,
      subtext: 'Enterprise candidates selected for pilot cohort',
    },
    {
      stage: 'Demo Activated',
      count: 12,
      percentOfTarget: '80.0%',
      backdropWidth: '80%',
      conversionFromPrev: '80.0% activated',
      subtext: 'Credentials verified and demo privileges unlocked',
    },
    {
      stage: 'Interview Started',
      count: 10,
      percentOfTarget: '66.7%',
      backdropWidth: '67%',
      conversionFromPrev: '83.3% started session',
      subtext: 'Microphone tested & mock interview initiated',
    },
    {
      stage: 'Interview Completed',
      count: 9,
      percentOfTarget: '60.0%',
      backdropWidth: '60%',
      conversionFromPrev: '90.0% completion rate',
      subtext: 'All questions answered & AI score generated',
    },
    {
      stage: 'Feedback Submitted',
      count: 8,
      percentOfTarget: '53.3%',
      backdropWidth: '53%',
      conversionFromPrev: '88.9% feedback response',
      subtext: 'Comprehensive questionnaire & rating recorded',
    },
  ]

  const handleApplyCustomDate = () => {
    setAppliedCustomLabel(`${customStartDate} to ${customEndDate}`)
  }

  return (
    <div>
      {/* ===================================================================
          1. TOP DATE RANGE CONTROLS
          =================================================================== */}
      <div className="an-controls-header">
        <div className="an-controls-left">
          <div className="an-controls-icon-badge">
            <ActivityIcon size={18} />
          </div>
          <div>
            <h2 className="an-controls-title">Analytics Timeframe</h2>
            <p className="an-controls-desc">{currentData.label}</p>
          </div>
        </div>

        <div className="an-date-pills">
          <button
            type="button"
            className={`an-date-pill ${selectedRange === 'today' ? 'an-date-pill--active' : ''}`}
            onClick={() => setSelectedRange('today')}
          >
            Today
          </button>
          <button
            type="button"
            className={`an-date-pill ${selectedRange === '7d' ? 'an-date-pill--active' : ''}`}
            onClick={() => setSelectedRange('7d')}
          >
            7 Days
          </button>
          <button
            type="button"
            className={`an-date-pill ${selectedRange === '30d' ? 'an-date-pill--active' : ''}`}
            onClick={() => setSelectedRange('30d')}
          >
            30 Days
          </button>
          <button
            type="button"
            className={`an-date-pill ${selectedRange === 'custom' ? 'an-date-pill--active' : ''}`}
            onClick={() => setSelectedRange('custom')}
          >
            Custom
          </button>
        </div>
      </div>

      {/* Custom Date Inputs if Custom is chosen */}
      {selectedRange === 'custom' && (
        <div className="an-custom-date-panel">
          <div className="an-custom-date-field">
            <span>From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
            />
          </div>
          <div className="an-custom-date-field">
            <span>To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            style={{ padding: '5px 14px', fontSize: '12px' }}
            onClick={handleApplyCustomDate}
          >
            Apply Range
          </button>
        </div>
      )}

      {/* ===================================================================
          2. KPI CARDS (6 CARDS)
          =================================================================== */}
      <div className="an-kpi-grid">
        {/* Total Users */}
        <div className="an-kpi-card">
          <div className="an-kpi-card__top">
            <span className="an-kpi-card__label">Total Users</span>
            <div className="an-kpi-card__icon-wrap an-kpi-card__icon-wrap--cyan">
              <UsersIcon size={16} />
            </div>
          </div>
          <div className="an-kpi-card__value">{currentData.kpis.totalUsers.value}</div>
          <div className="an-kpi-card__footer">
            <span className="an-kpi-card__trend an-kpi-card__trend--up">
              <TrendingUpIcon size={12} /> {currentData.kpis.totalUsers.trend}
            </span>
            <span className="an-kpi-card__subtext">{currentData.kpis.totalUsers.sub}</span>
          </div>
        </div>

        {/* Active Users */}
        <div className="an-kpi-card">
          <div className="an-kpi-card__top">
            <span className="an-kpi-card__label">Active Users</span>
            <div className="an-kpi-card__icon-wrap an-kpi-card__icon-wrap--emerald">
              <SparklesIcon size={16} />
            </div>
          </div>
          <div className="an-kpi-card__value">{currentData.kpis.activeUsers.value}</div>
          <div className="an-kpi-card__footer">
            <span className="an-kpi-card__trend an-kpi-card__trend--up">
              <TrendingUpIcon size={12} /> {currentData.kpis.activeUsers.trend}
            </span>
            <span className="an-kpi-card__subtext">{currentData.kpis.activeUsers.sub}</span>
          </div>
        </div>

        {/* Total Interviews */}
        <div className="an-kpi-card">
          <div className="an-kpi-card__top">
            <span className="an-kpi-card__label">Total Interviews</span>
            <div className="an-kpi-card__icon-wrap an-kpi-card__icon-wrap--purple">
              <InterviewsIcon size={16} />
            </div>
          </div>
          <div className="an-kpi-card__value">{currentData.kpis.totalInterviews.value}</div>
          <div className="an-kpi-card__footer">
            <span className="an-kpi-card__trend an-kpi-card__trend--up">
              <TrendingUpIcon size={12} /> {currentData.kpis.totalInterviews.trend}
            </span>
            <span className="an-kpi-card__subtext">{currentData.kpis.totalInterviews.sub}</span>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="an-kpi-card">
          <div className="an-kpi-card__top">
            <span className="an-kpi-card__label">Completion Rate</span>
            <div className="an-kpi-card__icon-wrap an-kpi-card__icon-wrap--amber">
              <CheckCircleIcon size={16} />
            </div>
          </div>
          <div className="an-kpi-card__value" style={{ color: 'var(--admin-accent-emerald)' }}>
            {currentData.kpis.completionRate.value}
          </div>
          <div className="an-kpi-card__footer">
            <span className="an-kpi-card__trend an-kpi-card__trend--up">
              <TrendingUpIcon size={12} /> {currentData.kpis.completionRate.trend}
            </span>
            <span className="an-kpi-card__subtext">{currentData.kpis.completionRate.sub}</span>
          </div>
        </div>

        {/* Average Interview Duration */}
        <div className="an-kpi-card">
          <div className="an-kpi-card__top">
            <span className="an-kpi-card__label">Average Duration</span>
            <div className="an-kpi-card__icon-wrap an-kpi-card__icon-wrap--blue">
              <ClockIcon size={16} />
            </div>
          </div>
          <div className="an-kpi-card__value">{currentData.kpis.avgDuration.value}</div>
          <div className="an-kpi-card__footer">
            <span className="an-kpi-card__trend an-kpi-card__trend--neutral">
              {currentData.kpis.avgDuration.trend}
            </span>
            <span className="an-kpi-card__subtext">{currentData.kpis.avgDuration.sub}</span>
          </div>
        </div>

        {/* Average Interviews Per User */}
        <div className="an-kpi-card">
          <div className="an-kpi-card__top">
            <span className="an-kpi-card__label">Avg Per User</span>
            <div className="an-kpi-card__icon-wrap an-kpi-card__icon-wrap--rose">
              <BotIcon size={16} />
            </div>
          </div>
          <div className="an-kpi-card__value">{currentData.kpis.avgInterviewsPerUser.value}</div>
          <div className="an-kpi-card__footer">
            <span className="an-kpi-card__trend an-kpi-card__trend--up">
              <TrendingUpIcon size={12} /> {currentData.kpis.avgInterviewsPerUser.trend}
            </span>
            <span className="an-kpi-card__subtext">{currentData.kpis.avgInterviewsPerUser.sub}</span>
          </div>
        </div>
      </div>

      {/* ===================================================================
          3. CHARTS ROW 1: USER GROWTH & INTERVIEWS OVER TIME
          =================================================================== */}
      <div className="an-charts-row-2col">
        {/* User Growth Line/Area Chart */}
        <div className="admin-card">
          <div className="admin-card__header">
            <div className="admin-card__title-group">
              <h2 className="admin-card__title">User Growth</h2>
              <p className="admin-card__subtitle">Cumulative registered talent vs active practice users</p>
            </div>
            <span className="admin-badge admin-badge--cyan">+22.4% MoM</span>
          </div>

          <div className="an-chart-container">
            <svg
              className="an-chart-svg"
              viewBox="0 0 600 220"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="userGrowthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="activeGrowthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="40" y1="30" x2="580" y2="30" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
              <line x1="40" y1="80" x2="580" y2="80" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
              <line x1="40" y1="130" x2="580" y2="130" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
              <line x1="40" y1="180" x2="580" y2="180" stroke="rgba(255,255,255,0.1)" />

              {/* Y Axis Labels */}
              <text x="30" y="34" fill="#64748b" fontSize="10" textAnchor="end">3k</text>
              <text x="30" y="84" fill="#64748b" fontSize="10" textAnchor="end">2k</text>
              <text x="30" y="134" fill="#64748b" fontSize="10" textAnchor="end">1k</text>
              <text x="30" y="184" fill="#64748b" fontSize="10" textAnchor="end">0</text>

              {/* Total Users Area & Line */}
              <path
                d="M 50 160 C 130 150, 180 135, 250 110 C 320 85, 420 65, 570 38 L 570 180 L 50 180 Z"
                fill="url(#userGrowthGrad)"
              />
              <path
                d="M 50 160 C 130 150, 180 135, 250 110 C 320 85, 420 65, 570 38"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Active Users Area & Line */}
              <path
                d="M 50 172 C 130 165, 180 150, 250 132 C 320 114, 420 96, 570 78 L 570 180 L 50 180 Z"
                fill="url(#activeGrowthGrad)"
              />
              <path
                d="M 50 172 C 130 165, 180 150, 250 132 C 320 114, 420 96, 570 78"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="5 3"
              />

              {/* Dots on key milestone points */}
              <circle cx="250" cy="110" r="4" fill="#38bdf8" stroke="#0b1222" strokeWidth="2" />
              <circle cx="420" cy="65" r="4" fill="#38bdf8" stroke="#0b1222" strokeWidth="2" />
              <circle cx="570" cy="38" r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />

              <circle cx="250" cy="132" r="3.5" fill="#10b981" stroke="#0b1222" strokeWidth="2" />
              <circle cx="420" cy="96" r="3.5" fill="#10b981" stroke="#0b1222" strokeWidth="2" />
              <circle cx="570" cy="78" r="4" fill="#10b981" stroke="#ffffff" strokeWidth="2" />

              {/* X Axis timeline points */}
              <text x="50" y="200" fill="#64748b" fontSize="10.5" textAnchor="middle">Week 1</text>
              <text x="180" y="200" fill="#64748b" fontSize="10.5" textAnchor="middle">Week 2</text>
              <text x="310" y="200" fill="#64748b" fontSize="10.5" textAnchor="middle">Week 3</text>
              <text x="440" y="200" fill="#64748b" fontSize="10.5" textAnchor="middle">Week 4</text>
              <text x="570" y="200" fill="#38bdf8" fontSize="10.5" fontWeight="700" textAnchor="middle">Current (2.8k)</text>
            </svg>
          </div>

          <div className="an-chart-legend">
            <div className="an-chart-legend-item">
              <div className="an-chart-legend-dot" style={{ background: '#38bdf8' }} />
              <span>Total Registered Users (2,840)</span>
            </div>
            <div className="an-chart-legend-item">
              <div className="an-chart-legend-dot" style={{ background: '#10b981' }} />
              <span>Active Monthly Practicing Candidates (1,940)</span>
            </div>
          </div>
        </div>

        {/* Interviews Over Time Bar Chart */}
        <div className="admin-card">
          <div className="admin-card__header">
            <div className="admin-card__title-group">
              <h2 className="admin-card__title">Interviews Over Time</h2>
              <p className="admin-card__subtitle">Sessions initiated and evaluated in timeframe</p>
            </div>
            <span className="admin-badge admin-badge--purple">
              {currentData.kpis.totalInterviews.value} Sessions
            </span>
          </div>

          <div className="an-bar-chart">
            {currentData.interviewsVelocity.map((item, idx) => (
              <div
                key={idx}
                className="an-bar-group"
                onMouseEnter={() => setActiveTooltip(idx)}
                onMouseLeave={() => setActiveTooltip(null)}
              >
                {activeTooltip === idx && (
                  <div className="an-bar-tooltip">
                    {item.completed} completed / {item.sessions} total
                  </div>
                )}
                <span className="an-bar-val">{item.sessions}</span>
                <div
                  className="an-bar-pillar an-bar-pillar--cyan"
                  style={{ height: item.height }}
                />
                <span className="an-bar-label">{item.label}</span>
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
            }}
          >
            <span>Peak Session Volume: {currentData.kpis.totalInterviews.trend}</span>
            <span style={{ color: 'var(--admin-accent-emerald)', fontWeight: 600 }}>
              92.4% Avg Completion
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================
          4. CHARTS ROW 2: COMPLETION RATE, TARGET ROLES & DURATION
          =================================================================== */}
      <div className="an-charts-row-3col">
        {/* Interview Completion Rate */}
        <div className="admin-card">
          <div className="admin-card__header">
            <div className="admin-card__title-group">
              <h2 className="admin-card__title">Completion Rate</h2>
              <p className="admin-card__subtitle">Success & dropoff breakdown</p>
            </div>
          </div>

          <div className="an-gauge-wrapper">
            <div className="an-donut-container">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle
                  cx="70"
                  cy="70"
                  r="54"
                  fill="transparent"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="12"
                />
                {/* Completed 92.4% -> 339 * 0.924 = ~313 */}
                <circle
                  cx="70"
                  cy="70"
                  r="54"
                  fill="transparent"
                  stroke="#10b981"
                  strokeWidth="12"
                  strokeDasharray="339.29"
                  strokeDashoffset="25.8"
                  strokeLinecap="round"
                  transform="rotate(-90 70 70)"
                />
              </svg>
              <div className="an-donut-inner">
                <div className="an-donut-percent">92.4%</div>
                <div className="an-donut-sub">Completed</div>
              </div>
            </div>

            <div className="an-gauge-breakdown">
              <div className="an-gauge-item">
                <div className="an-gauge-item-header">
                  <span className="an-gauge-item-title">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                    Full Completion
                  </span>
                  <span className="an-gauge-item-val" style={{ color: '#10b981' }}>92.4%</span>
                </div>
                <div className="an-gauge-bar">
                  <div className="an-gauge-fill" style={{ width: '92.4%', background: '#10b981' }} />
                </div>
              </div>

              <div className="an-gauge-item">
                <div className="an-gauge-item-header">
                  <span className="an-gauge-item-title">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }} />
                    In Progress
                  </span>
                  <span className="an-gauge-item-val" style={{ color: '#38bdf8' }}>4.8%</span>
                </div>
                <div className="an-gauge-bar">
                  <div className="an-gauge-fill" style={{ width: '4.8%', background: '#38bdf8' }} />
                </div>
              </div>

              <div className="an-gauge-item">
                <div className="an-gauge-item-header">
                  <span className="an-gauge-item-title">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f43f5e' }} />
                    Incomplete / Quit
                  </span>
                  <span className="an-gauge-item-val" style={{ color: '#f43f5e' }}>2.8%</span>
                </div>
                <div className="an-gauge-bar">
                  <div className="an-gauge-fill" style={{ width: '2.8%', background: '#f43f5e' }} />
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: '11.5px',
              color: 'var(--admin-text-muted)',
              borderTop: '1px solid var(--admin-border-subtle)',
              paddingTop: '0.75rem',
              marginTop: '0.5rem',
            }}
          >
            ✓ 97.2% of all candidates reach at least Question 4 before evaluating.
          </div>
        </div>

        {/* Most Popular Target Roles */}
        <div className="admin-card">
          <div className="admin-card__header">
            <div className="admin-card__title-group">
              <h2 className="admin-card__title">Most Popular Target Roles</h2>
              <p className="admin-card__subtitle">Candidate career preferences</p>
            </div>
          </div>

          <div className="an-role-list">
            {popularRoles.map((item, idx) => (
              <div key={idx} className="an-role-item">
                <div className="an-role-header">
                  <div className="an-role-title-wrap">
                    <span className="an-role-rank">{idx + 1}</span>
                    <span className="an-role-name">{item.role}</span>
                  </div>
                  <span className="an-role-meta">
                    {item.count} sessions ({item.percent}%)
                  </span>
                </div>
                <div className="an-role-bar">
                  <div className="an-role-bar-fill" style={{ width: item.fillWidth }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Interview Duration Distribution */}
        <div className="admin-card">
          <div className="admin-card__header">
            <div className="admin-card__title-group">
              <h2 className="admin-card__title">Duration Distribution</h2>
              <p className="admin-card__subtitle">Pacing sweet spot (Avg 28m 42s)</p>
            </div>
          </div>

          <div className="an-duration-hist">
            {durationBuckets.map((b, idx) => (
              <div key={idx} className="an-duration-row">
                <span className="an-duration-bracket">{b.bracket}</span>
                <div className="an-duration-bar-track">
                  <div
                    className={`an-duration-bar-fill ${b.isPeak ? 'an-duration-bar-fill--peak' : ''}`}
                    style={{ width: `${b.percent * 1.65}%` }}
                  />
                </div>
                <span
                  className="an-duration-stat"
                  style={{ color: b.isPeak ? 'var(--admin-accent-emerald)' : 'var(--admin-text-primary)' }}
                >
                  {b.percent}% {b.isPeak ? '★' : ''}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11.5px',
              color: 'var(--admin-text-muted)',
              borderTop: '1px solid var(--admin-border-subtle)',
              paddingTop: '0.75rem',
              marginTop: '0.9rem',
            }}
          >
            <span>Peak: 25 - 35 mins (Standard full round)</span>
            <span style={{ color: 'var(--admin-accent-cyan)', fontWeight: 600 }}>54% of sessions</span>
          </div>
        </div>
      </div>

      {/* ===================================================================
          5. DEDICATED PILOT ANALYTICS SECTION
          =================================================================== */}
      <div className="an-pilot-section">
        <div className="an-pilot-header">
          <div className="an-pilot-title-group">
            <div className="an-pilot-icon-badge">
              <PilotAccessIcon size={24} />
            </div>
            <div>
              <h2 className="an-pilot-title">
                Pilot Analytics
                <span className="admin-badge admin-badge--purple">Cohort 1 Performance</span>
              </h2>
              <p className="an-pilot-subtitle">
                Dedicated conversion metrics for the 15 enterprise and institutional pilot candidates.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '13px', color: 'var(--admin-text-muted)' }}>
              Overall Target Fulfillment:
            </span>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 800,
                color: 'var(--admin-accent-emerald)',
                background: 'rgba(16, 185, 129, 0.12)',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(16, 185, 129, 0.25)',
              }}
            >
              80.0% Activated (12 / 15)
            </span>
          </div>
        </div>

        {/* 5 Pilot Key Stat Chips */}
        <div className="an-pilot-stats-grid">
          <div className="an-pilot-stat-chip">
            <span className="an-pilot-stat-chip__label">Target Participants</span>
            <div className="an-pilot-stat-chip__val" style={{ color: 'var(--admin-accent-purple)' }}>
              15
            </div>
            <span className="an-pilot-stat-chip__sub">pilot allocation ceiling</span>
          </div>

          <div className="an-pilot-stat-chip">
            <span className="an-pilot-stat-chip__label">Activated</span>
            <div className="an-pilot-stat-chip__val" style={{ color: 'var(--admin-accent-cyan)' }}>
              12
            </div>
            <span className="an-pilot-stat-chip__sub">80% invitation conversion</span>
          </div>

          <div className="an-pilot-stat-chip">
            <span className="an-pilot-stat-chip__label">Started</span>
            <div className="an-pilot-stat-chip__val" style={{ color: 'var(--admin-accent-amber)' }}>
              10
            </div>
            <span className="an-pilot-stat-chip__sub">83.3% test run rate</span>
          </div>

          <div className="an-pilot-stat-chip">
            <span className="an-pilot-stat-chip__label">Completed</span>
            <div className="an-pilot-stat-chip__val" style={{ color: 'var(--admin-accent-emerald)' }}>
              9
            </div>
            <span className="an-pilot-stat-chip__sub">90.0% completion rate</span>
          </div>

          <div className="an-pilot-stat-chip">
            <span className="an-pilot-stat-chip__label">Feedback Responses</span>
            <div className="an-pilot-stat-chip__val" style={{ color: '#ec4899' }}>
              8
            </div>
            <span className="an-pilot-stat-chip__sub">88.9% post-interview review</span>
          </div>
        </div>

        {/* Pilot Funnel Visualizer */}
        <div className="an-funnel-card">
          <div className="an-funnel-header">
            <h3 className="an-funnel-title">
              Pilot Conversion Funnel
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
              Stage-by-stage attrition and engagement retention
            </span>
          </div>

          <div className="an-funnel-stages">
            {pilotFunnelStages.map((stage, idx) => (
              <div key={idx} className="an-funnel-stage-row">
                <div className="an-funnel-stage-card">
                  <div
                    className="an-funnel-stage-backdrop-bar"
                    style={{ width: stage.backdropWidth }}
                  />
                  <div className="an-funnel-stage-info">
                    <span className="an-funnel-stage-number">{idx + 1}</span>
                    <div>
                      <div className="an-funnel-stage-name">{stage.stage}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                        {stage.subtext}
                      </div>
                    </div>
                  </div>

                  <div className="an-funnel-stage-metrics">
                    <div style={{ textAlign: 'right' }}>
                      <div className="an-funnel-stage-count">{stage.count} participants</div>
                      <div style={{ fontSize: '11px', color: 'var(--admin-text-dim)' }}>
                        {idx === 0 ? 'Baseline Target' : `${stage.count} of 15`}
                      </div>
                    </div>
                    <div className="an-funnel-stage-pct">{stage.percentOfTarget}</div>
                  </div>
                </div>

                {/* Arrow connector if not last stage */}
                {idx < pilotFunnelStages.length - 1 && (
                  <div className="an-funnel-connector">
                    <span className="an-funnel-connector-arrow">↓</span>
                    <span className="an-funnel-connector-rate">
                      {pilotFunnelStages[idx + 1].conversionFromPrev}
                    </span>
                    <span style={{ color: 'var(--admin-text-dim)' }}>
                      ({stage.count - pilotFunnelStages[idx + 1].count} drop-off)
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              marginTop: '1.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--admin-border-subtle)',
              fontSize: '12px',
              color: 'var(--admin-text-muted)',
            }}
          >
            <span>
              💡 <strong>Insight:</strong> 88.9% of candidates who complete their interview proceed to submit thorough feedback.
            </span>
            <span style={{ color: 'var(--admin-accent-purple)', fontWeight: 600 }}>
              End-to-End Pilot Conversion: 53.3% (8 / 15 target)
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
