import { useState } from 'react'
import {
  SparklesIcon,
  BotIcon,
  MicIcon,
  VolumeIcon,
  DatabaseIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrendingUpIcon,
  ActivityIcon,
} from '../AdminIcons'
import './AdminPage.css'
import './AdminAiControl.css'

export default function AdminAiControl() {
  // Master Switch: AI Interviews ON / OFF (UI Only)
  const [aiInterviewsActive, setAiInterviewsActive] = useState(true)

  // Runtime Controls (UI Only)
  const [currentModel, setCurrentModel] = useState('Gemini 1.5 Pro (Recommended)')
  const [maxQuestions, setMaxQuestions] = useState(5)
  const [maxDuration, setMaxDuration] = useState(35)
  const [requestTimeout, setRequestTimeout] = useState(15)
  const [saveToast, setSaveToast] = useState('')
  const [hoveredBar, setHoveredBar] = useState(null)

  // ========================================================================
  // 1. SERVICE STATUS CARDS (4 SERVICES)
  // ========================================================================
  const services = [
    {
      name: 'Interview LLM',
      model: 'Gemini 1.5 Pro',
      status: 'Operational',
      requestsToday: '14,820',
      avgLatency: '640ms',
      errorRate: '0.02%',
      icon: BotIcon,
      colorClass: 'ai-service-card__icon--cyan',
    },
    {
      name: 'Speech-to-Text',
      model: 'Whisper Large v3',
      status: 'Operational',
      requestsToday: '5,940',
      avgLatency: '280ms',
      errorRate: '0.04%',
      icon: MicIcon,
      colorClass: 'ai-service-card__icon--purple',
    },
    {
      name: 'Text-to-Speech',
      model: 'ElevenLabs Neural HD',
      status: 'Operational',
      requestsToday: '5,810',
      avgLatency: '320ms',
      errorRate: '0.01%',
      icon: VolumeIcon,
      colorClass: 'ai-service-card__icon--emerald',
    },
    {
      name: 'Vector Database',
      model: 'Pinecone Serverless',
      status: 'Operational',
      requestsToday: '9,480',
      avgLatency: '38ms',
      errorRate: '0.00%',
      icon: DatabaseIcon,
      colorClass: 'ai-service-card__icon--amber',
    },
  ]

  // ========================================================================
  // 2. AI USAGE METRICS & CHART
  // ========================================================================
  const usageMetrics = [
    { label: 'Requests Today', value: '36,050', sub: '+14% vs yesterday' },
    { label: 'Successful Requests', value: '35,992', sub: '99.8% success rate', color: 'var(--admin-accent-emerald)' },
    { label: 'Failed Requests', value: '58', sub: '0.2% dropoff rate', color: 'var(--admin-accent-rose)' },
    { label: 'Average Latency', value: '320ms', sub: 'across all services', color: 'var(--admin-accent-cyan)' },
    { label: 'Token Usage', value: '5.42M', sub: '4.8M prompt / 620k gen' },
    { label: 'Estimated Usage Cost', value: '$48.20', sub: 'within daily budget', color: 'var(--admin-accent-purple)' },
  ]

  // AI Requests Over Time (Hourly Bar Distribution)
  const hourlyRequests = [
    { hour: '06:00', total: 640, height: '18%', llm: 280, voice: 360 },
    { hour: '08:00', total: 1820, height: '42%', llm: 780, voice: 1040 },
    { hour: '10:00', total: 3410, height: '78%', llm: 1420, voice: 1990 },
    { hour: '12:00', total: 4120, height: '94%', llm: 1710, voice: 2410 },
    { hour: '14:00', total: 4380, height: '100%', llm: 1850, voice: 2530, isPeak: true },
    { hour: '16:00', total: 3890, height: '88%', llm: 1620, voice: 2270 },
    { hour: '18:00', total: 2940, height: '67%', llm: 1210, voice: 1730 },
    { hour: '20:00', total: 1980, height: '45%', llm: 840, voice: 1140 },
    { hour: '22:00', total: 1120, height: '26%', llm: 480, voice: 640 },
  ]

  // ========================================================================
  // 3. RECENT AI ERRORS (TABLE DATA - NO SECRETS OR KEYS)
  // ========================================================================
  const recentErrors = [
    {
      id: 'ERR-801',
      time: '14:28:12',
      service: 'Interview LLM',
      errorType: 'RateLimitWarning (429)',
      session: 'INT-9821',
      status: 'Resolved (Auto-Retry)',
      statusType: 'resolved',
    },
    {
      id: 'ERR-802',
      time: '13:04:45',
      service: 'Speech-to-Text',
      errorType: 'AudioBufferUnderrun',
      session: 'INT-9815',
      status: 'Recovered',
      statusType: 'resolved',
    },
    {
      id: 'ERR-803',
      time: '11:42:19',
      service: 'Interview LLM',
      errorType: 'ContextLimitApproaching',
      session: 'INT-9809',
      status: 'Compacted',
      statusType: 'info',
    },
    {
      id: 'ERR-804',
      time: '10:15:33',
      service: 'Text-to-Speech',
      errorType: 'StreamJitterExceeded',
      session: 'INT-9804',
      status: 'Resolved (Fallback)',
      statusType: 'resolved',
    },
    {
      id: 'ERR-805',
      time: '08:50:02',
      service: 'Vector Database',
      errorType: 'ReadTimeout (54ms)',
      session: 'INT-9799',
      status: 'Retried (Success)',
      statusType: 'resolved',
    },
  ]

  const handleToggleAiInterviews = (enable) => {
    setAiInterviewsActive(enable)
    setSaveToast(
      enable
        ? 'AI Interviews enabled — live candidate sessions active'
        : 'AI Interviews paused — maintenance mode enabled'
    )
    setTimeout(() => setSaveToast(''), 3000)
  }

  const handleSaveRuntimeSettings = () => {
    setSaveToast('Runtime configuration saved successfully!')
    setTimeout(() => setSaveToast(''), 3000)
  }

  return (
    <div>
      {/* Toast Notification */}
      {saveToast && (
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
            animation: 'aiFadeIn 0.2s ease',
          }}
        >
          <CheckCircleIcon size={16} />
          {saveToast}
        </div>
      )}

      {/* ===================================================================
          1. TOP BANNER: AI INTERVIEWS MASTER TOGGLE
          =================================================================== */}
      <div className="ai-control-banner">
        <div className="ai-control-banner__left">
          <div className="ai-control-banner__icon">
            <SparklesIcon size={24} />
          </div>
          <div>
            <h1 className="ai-control-banner__title">
              AI Orchestration & Runtime Control
              <span className="admin-badge admin-badge--cyan">v2.4-active</span>
            </h1>
            <p className="ai-control-banner__desc">
              Manage live AI interviewer pipelines, speech synthesizers, request quotas, and inference latency.
            </p>
          </div>
        </div>

        {/* Master AI Interviews ON / OFF Switch */}
        <div className="ai-master-switch-wrap">
          <div className="ai-master-switch-info">
            <span className="ai-master-switch-label">AI Interviews</span>
            <span
              className={`ai-master-switch-status ${
                aiInterviewsActive
                  ? 'ai-master-switch-status--on'
                  : 'ai-master-switch-status--off'
              }`}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'currentColor',
                  display: 'inline-block',
                }}
              />
              {aiInterviewsActive ? 'SYSTEM ONLINE (Accepting)' : 'PAUSED (Maintenance)'}
            </span>
          </div>

          <div className="ai-toggle-btn">
            <span
              className={`ai-toggle-option ${
                aiInterviewsActive
                  ? 'ai-toggle-option--active-on'
                  : 'ai-toggle-option--inactive'
              }`}
              onClick={() => handleToggleAiInterviews(true)}
            >
              ON
            </span>
            <span
              className={`ai-toggle-option ${
                !aiInterviewsActive
                  ? 'ai-toggle-option--active-off'
                  : 'ai-toggle-option--inactive'
              }`}
              onClick={() => handleToggleAiInterviews(false)}
            >
              OFF
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================
          2. SERVICE STATUS (4 CARDS)
          =================================================================== */}
      <div style={{ marginBottom: '0.85rem' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
          Service Status
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '2px 0 1rem' }}>
          Real-time telemetry across core LLM inference, transcription, speech synthesis, and embeddings
        </p>
      </div>

      <div className="ai-services-grid">
        {services.map((svc, idx) => {
          const SvcIcon = svc.icon
          return (
            <div key={idx} className="ai-service-card">
              <div>
                <div className="ai-service-card__header">
                  <div className="ai-service-card__title-wrap">
                    <div className={`ai-service-card__icon ${svc.colorClass}`}>
                      <SvcIcon size={17} />
                    </div>
                    <div>
                      <h3 className="ai-service-card__name">{svc.name}</h3>
                      <div className="ai-service-card__model">{svc.model}</div>
                    </div>
                  </div>

                  <span className="ai-service-card__status-badge ai-service-card__status-badge--healthy">
                    <span className="ai-service-card__status-dot" />
                    {svc.status}
                  </span>
                </div>
              </div>

              <div className="ai-service-metrics">
                <div className="ai-service-metric-item">
                  <span className="ai-service-metric-label">Requests</span>
                  <span className="ai-service-metric-val">{svc.requestsToday}</span>
                </div>
                <div className="ai-service-metric-item">
                  <span className="ai-service-metric-label">Avg Latency</span>
                  <span className="ai-service-metric-val" style={{ color: 'var(--admin-accent-cyan)' }}>
                    {svc.avgLatency}
                  </span>
                </div>
                <div className="ai-service-metric-item">
                  <span className="ai-service-metric-label">Error Rate</span>
                  <span className="ai-service-metric-val" style={{ color: 'var(--admin-accent-emerald)' }}>
                    {svc.errorRate}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ===================================================================
          3. AI CONTROL (RUNTIME PARAMETERS - UI ONLY)
          =================================================================== */}
      <div className="ai-runtime-card">
        <div className="admin-card__header" style={{ marginBottom: 0 }}>
          <div className="admin-card__title-group">
            <h2 className="admin-card__title">AI Runtime Controls</h2>
            <p className="admin-card__subtitle">
              Adjust conversational thresholds, reasoning engines, and safety timeouts (UI Only)
            </p>
          </div>
          <button
            type="button"
            className="admin-btn admin-btn--primary admin-btn--sm"
            onClick={handleSaveRuntimeSettings}
          >
            Save Parameters
          </button>
        </div>

        <div className="ai-runtime-grid">
          {/* Current Model */}
          <div className="ai-runtime-control-box">
            <div className="ai-runtime-control-header">
              <span className="ai-runtime-control-label">Current Model</span>
            </div>
            <select
              className="admin-select"
              value={currentModel}
              onChange={(e) => setCurrentModel(e.target.value)}
              style={{ width: '100%', fontSize: '12px' }}
            >
              <option value="Gemini 1.5 Pro (Recommended)">Gemini 1.5 Pro (Recommended)</option>
              <option value="Gemini 1.5 Flash (Ultra Fast)">Gemini 1.5 Flash (Ultra Fast)</option>
              <option value="GPT-4o (High Reasoning)">GPT-4o (High Reasoning)</option>
              <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet</option>
            </select>
            <span className="ai-runtime-control-sub">
              Active primary inference LLM for interview rooms
            </span>
          </div>

          {/* Maximum Interview Questions */}
          <div className="ai-runtime-control-box">
            <div className="ai-runtime-control-header">
              <span className="ai-runtime-control-label">Max Questions</span>
              <span className="ai-runtime-control-val">{maxQuestions} Questions</span>
            </div>
            <input
              type="range"
              min="3"
              max="10"
              step="1"
              value={maxQuestions}
              onChange={(e) => setMaxQuestions(parseInt(e.target.value, 10))}
              className="ai-runtime-control-slider"
            />
            <span className="ai-runtime-control-sub">
              Question ceiling before concluding interview
            </span>
          </div>

          {/* Maximum Interview Duration */}
          <div className="ai-runtime-control-box">
            <div className="ai-runtime-control-header">
              <span className="ai-runtime-control-label">Max Duration</span>
              <span className="ai-runtime-control-val">{maxDuration} Mins</span>
            </div>
            <input
              type="range"
              min="15"
              max="60"
              step="5"
              value={maxDuration}
              onChange={(e) => setMaxDuration(parseInt(e.target.value, 10))}
              className="ai-runtime-control-slider"
            />
            <span className="ai-runtime-control-sub">
              Hard stop session timer limit per interview
            </span>
          </div>

          {/* Request Timeout */}
          <div className="ai-runtime-control-box">
            <div className="ai-runtime-control-header">
              <span className="ai-runtime-control-label">Request Timeout</span>
              <span className="ai-runtime-control-val">{requestTimeout}s</span>
            </div>
            <input
              type="range"
              min="5"
              max="45"
              step="5"
              value={requestTimeout}
              onChange={(e) => setRequestTimeout(parseInt(e.target.value, 10))}
              className="ai-runtime-control-slider"
            />
            <span className="ai-runtime-control-sub">
              Max allowable latency before fallback response
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================
          4. AI USAGE (METRICS + HOURLY REQUESTS OVER TIME)
          =================================================================== */}
      <div className="ai-usage-card">
        <div className="admin-card__header">
          <div className="admin-card__title-group">
            <h2 className="admin-card__title">AI Usage & Inference Telemetry</h2>
            <p className="admin-card__subtitle">
              Daily compute utilization, latency health, and token expenditure
            </p>
          </div>
          <span className="admin-badge admin-badge--purple">Daily Quota: 18% Utilized</span>
        </div>

        {/* 6 Metric Tiles */}
        <div className="ai-usage-kpis-grid">
          {usageMetrics.map((m, idx) => (
            <div key={idx} className="ai-usage-kpi-tile">
              <span className="ai-usage-kpi-label">{m.label}</span>
              <span className="ai-usage-kpi-value" style={{ color: m.color || 'var(--admin-text-primary)' }}>
                {m.value}
              </span>
              <span className="ai-usage-kpi-sub">{m.sub}</span>
            </div>
          ))}
        </div>

        {/* AI Requests Over Time Chart */}
        <div style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--admin-text-primary)' }}>
              AI Requests Over Time
            </span>
            <span style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)' }}>
              Hourly volume today (06:00 – 22:00)
            </span>
          </div>

          <div className="ai-chart-bars-wrap">
            {hourlyRequests.map((col, idx) => (
              <div
                key={idx}
                className="ai-chart-bar-col"
                onMouseEnter={() => setHoveredBar(idx)}
                onMouseLeave={() => setHoveredBar(null)}
              >
                {hoveredBar === idx && (
                  <div className="ai-chart-tooltip">
                    {col.total} requests ({col.llm} LLM, {col.voice} Voice)
                  </div>
                )}
                <span className="ai-chart-val">{col.total}</span>
                <div
                  className={`ai-chart-bar-fill ${col.isPeak ? 'ai-chart-bar-fill--peak' : ''}`}
                  style={{ height: col.height }}
                />
                <span className="ai-chart-label">{col.hour}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '0.85rem',
              fontSize: '12px',
              color: 'var(--admin-text-muted)',
            }}
          >
            <span>Peak Hour: 14:00 (4,380 requests across LLM and Voice)</span>
            <span style={{ color: 'var(--admin-accent-emerald)', fontWeight: 600 }}>
              99.8% Overall Pipeline Health
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================
          5. RECENT AI ERRORS (NO SECRETS / CREDENTIALS)
          =================================================================== */}
      <div className="ai-errors-card">
        <div className="ai-errors-header">
          <div className="ai-errors-title-group">
            <div className="ai-errors-icon-wrap">
              <XCircleIcon size={18} />
            </div>
            <div>
              <h2 className="ai-errors-title">Recent AI Errors</h2>
              <p className="ai-errors-desc">
                Log of automated retries, rate-limiting warnings, and streaming fallbacks (Sanitized)
              </p>
            </div>
          </div>
          <span className="admin-badge admin-badge--emerald">All Recovered</span>
        </div>

        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Service</th>
                <th>Error Type</th>
                <th>Session</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentErrors.map((err) => (
                <tr key={err.id}>
                  <td style={{ fontFamily: 'monospace', color: 'var(--admin-text-muted)', fontSize: '12px' }}>
                    {err.time}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                    {err.service}
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        color: 'var(--admin-accent-amber)',
                        background: 'rgba(245, 158, 11, 0.08)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                      }}
                    >
                      {err.errorType}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', color: 'var(--admin-accent-cyan)', fontWeight: 600 }}>
                      {err.session}
                    </span>
                  </td>
                  <td>
                    <span className="admin-badge admin-badge--emerald">
                      ✓ {err.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
