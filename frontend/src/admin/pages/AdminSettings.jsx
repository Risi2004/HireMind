import { useState } from 'react'
import {
  SettingsIcon,
  CheckCircleIcon,
  SparklesIcon,
  InterviewsIcon,
  PilotAccessIcon,
  BotIcon,
  ReportsIcon,
} from '../AdminIcons'
import './AdminPage.css'
import './AdminSettings.css'

export default function AdminSettings() {
  // Navigation tab filter
  const [activeSection, setActiveSection] = useState('all') // 'all', 'general', 'interview', 'pilot', 'ai', 'uploads'
  const [toastMessage, setToastMessage] = useState('')

  // ========================================================================
  // DEFAULT CONFIGURATION VALUES
  // ========================================================================
  const defaultSettings = {
    // General
    platformName: 'HireMind AI',
    supportEmail: 'support@hiremind.ai',
    maintenanceMode: false,

    // Interview
    defaultDuration: '30',
    maxDuration: '45',
    defaultQuestions: '5',
    maxQuestions: '8',

    // Pilot
    pilotMode: true,
    pilotTarget: '15',
    defaultDemoDuration: '14',
    defaultDemoInterviewLimit: '3',

    // AI
    aiInterviewsEnabled: true,
    aiTimeout: '15',

    // Uploads
    maxCvSize: '10',
    allowPdf: true,
    allowDoc: true,
    allowDocx: true,
  }

  // State
  const [settings, setSettings] = useState(defaultSettings)

  const triggerToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }

  const handleFieldChange = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSaveChanges = (e) => {
    if (e) e.preventDefault()
    triggerToast('Settings saved successfully!')
  }

  const handleReset = () => {
    setSettings(defaultSettings)
    triggerToast('Settings restored to platform defaults.')
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
          1. TOP ACTION HEADER BAR
          =================================================================== */}
      <div className="st-header-bar">
        <div className="st-header-left">
          <div className="st-header-icon">
            <SettingsIcon size={20} />
          </div>
          <div>
            <h1 className="st-header-title">Platform Configuration</h1>
            <p className="st-header-subtitle">
              Manage core platform parameters, interview bounds, pilot limits, and file upload validation.
            </p>
          </div>
        </div>

        <div className="st-header-actions">
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={handleReset}
          >
            Reset
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={handleSaveChanges}
          >
            <SparklesIcon size={14} /> Save Changes
          </button>
        </div>
      </div>

      {/* ===================================================================
          2. NAVIGATION TABS (ALL, GENERAL, INTERVIEW, PILOT, AI, UPLOADS)
          =================================================================== */}
      <div className="st-tabs-nav">
        <button
          type="button"
          className={`st-tab-pill ${activeSection === 'all' ? 'st-tab-pill--active' : ''}`}
          onClick={() => setActiveSection('all')}
        >
          All Settings
        </button>
        <button
          type="button"
          className={`st-tab-pill ${activeSection === 'general' ? 'st-tab-pill--active' : ''}`}
          onClick={() => setActiveSection('general')}
        >
          General
        </button>
        <button
          type="button"
          className={`st-tab-pill ${activeSection === 'interview' ? 'st-tab-pill--active' : ''}`}
          onClick={() => setActiveSection('interview')}
        >
          Interview
        </button>
        <button
          type="button"
          className={`st-tab-pill ${activeSection === 'pilot' ? 'st-tab-pill--active' : ''}`}
          onClick={() => setActiveSection('pilot')}
        >
          Pilot
        </button>
        <button
          type="button"
          className={`st-tab-pill ${activeSection === 'ai' ? 'st-tab-pill--active' : ''}`}
          onClick={() => setActiveSection('ai')}
        >
          AI
        </button>
        <button
          type="button"
          className={`st-tab-pill ${activeSection === 'uploads' ? 'st-tab-pill--active' : ''}`}
          onClick={() => setActiveSection('uploads')}
        >
          Uploads
        </button>
      </div>

      {/* ===================================================================
          3. SETTINGS SECTIONS STACK
          =================================================================== */}
      <form onSubmit={handleSaveChanges} className="st-sections-stack">
        {/* =================================================================
            SECTION: GENERAL
            ================================================================= */}
        {(activeSection === 'all' || activeSection === 'general') && (
          <div className="st-section-card">
            <div className="st-section-header">
              <div className="st-section-icon-badge st-section-icon-badge--cyan">
                <SettingsIcon size={18} />
              </div>
              <div>
                <h2 className="st-section-title">General Platform Identity</h2>
                <p className="st-section-desc">Platform naming, notification email, and global maintenance status</p>
              </div>
            </div>

            <div className="st-fields-grid">
              <div className="st-field">
                <label className="st-field-label">Platform Name</label>
                <input
                  type="text"
                  className="admin-input"
                  value={settings.platformName}
                  onChange={(e) => handleFieldChange('platformName', e.target.value)}
                  placeholder="e.g. HireMind AI"
                />
                <span className="st-field-desc">Displays in headers, emails, and interview rooms</span>
              </div>

              <div className="st-field">
                <label className="st-field-label">Support Email</label>
                <input
                  type="email"
                  className="admin-input"
                  value={settings.supportEmail}
                  onChange={(e) => handleFieldChange('supportEmail', e.target.value)}
                  placeholder="support@hiremind.ai"
                />
                <span className="st-field-desc">Destination for candidate inquiries and escalation alerts</span>
              </div>
            </div>

            {/* Maintenance Mode Toggle */}
            <div style={{ marginTop: '1.25rem' }}>
              <div className="st-toggle-row">
                <div className="st-toggle-info">
                  <span className="st-toggle-title">Maintenance Mode</span>
                  <span className="st-toggle-sub">
                    Temporarily pause candidate interview access for infrastructure upgrades
                  </span>
                </div>
                <label className="st-switch">
                  <input
                    type="checkbox"
                    checked={settings.maintenanceMode}
                    onChange={(e) => handleFieldChange('maintenanceMode', e.target.checked)}
                  />
                  <span className="st-slider" />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================
            SECTION: INTERVIEW
            ================================================================= */}
        {(activeSection === 'all' || activeSection === 'interview') && (
          <div className="st-section-card">
            <div className="st-section-header">
              <div className="st-section-icon-badge st-section-icon-badge--blue">
                <InterviewsIcon size={18} />
              </div>
              <div>
                <h2 className="st-section-title">Interview Parameters</h2>
                <p className="st-section-desc">Session timing benchmarks and question boundaries</p>
              </div>
            </div>

            <div className="st-fields-grid">
              {/* Default Interview Duration */}
              <div className="st-field">
                <label className="st-field-label">Default Interview Duration</label>
                <select
                  className="admin-select"
                  value={settings.defaultDuration}
                  onChange={(e) => handleFieldChange('defaultDuration', e.target.value)}
                >
                  <option value="20">20 Minutes</option>
                  <option value="30">30 Minutes (Recommended)</option>
                  <option value="45">45 Minutes</option>
                  <option value="60">60 Minutes</option>
                </select>
                <span className="st-field-desc">Suggested baseline session timer for new candidates</span>
              </div>

              {/* Maximum Interview Duration */}
              <div className="st-field">
                <label className="st-field-label">Maximum Interview Duration</label>
                <select
                  className="admin-select"
                  value={settings.maxDuration}
                  onChange={(e) => handleFieldChange('maxDuration', e.target.value)}
                >
                  <option value="35">35 Minutes</option>
                  <option value="45">45 Minutes (Standard Cap)</option>
                  <option value="60">60 Minutes</option>
                  <option value="90">90 Minutes</option>
                </select>
                <span className="st-field-desc">Hard stop threshold where session automatically evaluates</span>
              </div>

              {/* Default Questions */}
              <div className="st-field">
                <label className="st-field-label">Default Questions</label>
                <select
                  className="admin-select"
                  value={settings.defaultQuestions}
                  onChange={(e) => handleFieldChange('defaultQuestions', e.target.value)}
                >
                  <option value="4">4 Questions</option>
                  <option value="5">5 Questions (Optimal)</option>
                  <option value="6">6 Questions</option>
                  <option value="7">7 Questions</option>
                </select>
                <span className="st-field-desc">Initial inquiry depth generated per technical round</span>
              </div>

              {/* Maximum Questions */}
              <div className="st-field">
                <label className="st-field-label">Maximum Questions</label>
                <select
                  className="admin-select"
                  value={settings.maxQuestions}
                  onChange={(e) => handleFieldChange('maxQuestions', e.target.value)}
                >
                  <option value="6">6 Questions</option>
                  <option value="8">8 Questions (Recommended Cap)</option>
                  <option value="10">10 Questions</option>
                  <option value="12">12 Questions</option>
                </select>
                <span className="st-field-desc">Ceiling on dynamic follow-up technical questions</span>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================
            SECTION: PILOT
            ================================================================= */}
        {(activeSection === 'all' || activeSection === 'pilot') && (
          <div className="st-section-card">
            <div className="st-section-header">
              <div className="st-section-icon-badge st-section-icon-badge--purple">
                <PilotAccessIcon size={18} />
              </div>
              <div>
                <h2 className="st-section-title">Pilot Testing Controls</h2>
                <p className="st-section-desc">Manage institutional demo cohorts, durations, and session quotas</p>
              </div>
            </div>

            {/* Pilot Mode Toggle */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div className="st-toggle-row">
                <div className="st-toggle-info">
                  <span className="st-toggle-title">Pilot Mode</span>
                  <span className="st-toggle-sub">
                    Enable enterprise cohort tracking, pilot badges, and feedback questionnaires
                  </span>
                </div>
                <label className="st-switch">
                  <input
                    type="checkbox"
                    checked={settings.pilotMode}
                    onChange={(e) => handleFieldChange('pilotMode', e.target.checked)}
                  />
                  <span className="st-slider" />
                </label>
              </div>
            </div>

            <div className="st-fields-grid">
              {/* Pilot Participant Target */}
              <div className="st-field">
                <label className="st-field-label">Pilot Participant Target</label>
                <input
                  type="number"
                  className="admin-input"
                  value={settings.pilotTarget}
                  onChange={(e) => handleFieldChange('pilotTarget', e.target.value)}
                  min="1"
                  max="100"
                />
                <span className="st-field-desc">Target cohort size for conversion funnel analytics (Default: 15)</span>
              </div>

              {/* Default Demo Duration */}
              <div className="st-field">
                <label className="st-field-label">Default Demo Duration</label>
                <select
                  className="admin-select"
                  value={settings.defaultDemoDuration}
                  onChange={(e) => handleFieldChange('defaultDemoDuration', e.target.value)}
                >
                  <option value="7">7 Days</option>
                  <option value="14">14 Days (Standard Trial)</option>
                  <option value="30">30 Days</option>
                  <option value="60">60 Days</option>
                </select>
                <span className="st-field-desc">Default validity period assigned to new demo accounts</span>
              </div>

              {/* Default Demo Interview Limit */}
              <div className="st-field">
                <label className="st-field-label">Default Demo Interview Limit</label>
                <select
                  className="admin-select"
                  value={settings.defaultDemoInterviewLimit}
                  onChange={(e) => handleFieldChange('defaultDemoInterviewLimit', e.target.value)}
                >
                  <option value="1">1 Interview</option>
                  <option value="2">2 Interviews</option>
                  <option value="3">3 Interviews (Recommended)</option>
                  <option value="5">5 Interviews</option>
                </select>
                <span className="st-field-desc">Maximum mock interview rounds allocated per demo user</span>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================
            SECTION: AI
            ================================================================= */}
        {(activeSection === 'all' || activeSection === 'ai') && (
          <div className="st-section-card">
            <div className="st-section-header">
              <div className="st-section-icon-badge st-section-icon-badge--emerald">
                <BotIcon size={18} />
              </div>
              <div>
                <h2 className="st-section-title">AI Engine Runtime</h2>
                <p className="st-section-desc">Live inference gateway toggles and latency protection thresholds</p>
              </div>
            </div>

            {/* AI Interviews Enabled Toggle */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div className="st-toggle-row">
                <div className="st-toggle-info">
                  <span className="st-toggle-title">AI Interviews Enabled</span>
                  <span className="st-toggle-sub">
                    Master toggle allowing candidates to initiate live AI mock interview sessions
                  </span>
                </div>
                <label className="st-switch">
                  <input
                    type="checkbox"
                    checked={settings.aiInterviewsEnabled}
                    onChange={(e) => handleFieldChange('aiInterviewsEnabled', e.target.checked)}
                  />
                  <span className="st-slider" />
                </label>
              </div>
            </div>

            <div className="st-fields-grid">
              {/* AI Request Timeout */}
              <div className="st-field">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label className="st-field-label">AI Request Timeout</label>
                  <span style={{ fontFamily: 'monospace', color: 'var(--admin-accent-cyan)', fontWeight: 700 }}>
                    {settings.aiTimeout}s
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="45"
                  step="1"
                  value={settings.aiTimeout}
                  onChange={(e) => handleFieldChange('aiTimeout', e.target.value)}
                  style={{ accentColor: 'var(--admin-accent-cyan)', cursor: 'pointer', width: '100%' }}
                />
                <span className="st-field-desc">
                  Maximum allowable time before triggering automated retry or fallback response
                </span>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================
            SECTION: UPLOADS
            ================================================================= */}
        {(activeSection === 'all' || activeSection === 'uploads') && (
          <div className="st-section-card">
            <div className="st-section-header">
              <div className="st-section-icon-badge st-section-icon-badge--amber">
                <ReportsIcon size={18} />
              </div>
              <div>
                <h2 className="st-section-title">Upload & Document Policies</h2>
                <p className="st-section-desc">Candidate CV parsing file size boundaries and permitted formats</p>
              </div>
            </div>

            <div className="st-fields-grid">
              {/* Maximum CV File Size */}
              <div className="st-field">
                <label className="st-field-label">Maximum CV File Size</label>
                <select
                  className="admin-select"
                  value={settings.maxCvSize}
                  onChange={(e) => handleFieldChange('maxCvSize', e.target.value)}
                >
                  <option value="5">5 MB</option>
                  <option value="10">10 MB (Recommended)</option>
                  <option value="15">15 MB</option>
                  <option value="25">25 MB</option>
                </select>
                <span className="st-field-desc">File size ceiling enforced on Cloudflare R2 resume uploads</span>
              </div>

              {/* Allowed File Types (PDF, DOC, DOCX) */}
              <div className="st-field">
                <label className="st-field-label">Allowed File Types</label>
                <div className="st-checkbox-group">
                  <label
                    className={`st-checkbox-tile ${settings.allowPdf ? 'st-checkbox-tile--selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={settings.allowPdf}
                      onChange={(e) => handleFieldChange('allowPdf', e.target.checked)}
                    />
                    <span className="st-checkbox-name">PDF</span>
                    <span className="st-checkbox-badge">.pdf</span>
                  </label>

                  <label
                    className={`st-checkbox-tile ${settings.allowDoc ? 'st-checkbox-tile--selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={settings.allowDoc}
                      onChange={(e) => handleFieldChange('allowDoc', e.target.checked)}
                    />
                    <span className="st-checkbox-name">DOC</span>
                    <span className="st-checkbox-badge">.doc</span>
                  </label>

                  <label
                    className={`st-checkbox-tile ${settings.allowDocx ? 'st-checkbox-tile--selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={settings.allowDocx}
                      onChange={(e) => handleFieldChange('allowDocx', e.target.checked)}
                    />
                    <span className="st-checkbox-name">DOCX</span>
                    <span className="st-checkbox-badge">.docx</span>
                  </label>
                </div>
                <span className="st-field-desc" style={{ marginTop: '4px' }}>
                  Permitted formats for automated resume parser parsing
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Save & Reset Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            paddingTop: '0.5rem',
          }}
        >
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={handleReset}
          >
            Reset
          </button>
          <button type="submit" className="admin-btn admin-btn--primary">
            Save Changes
          </button>
        </div>
      </form>
    </div>
  )
}
