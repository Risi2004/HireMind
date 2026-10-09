import { useState, useEffect, useEffectEvent } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import './InterviewAccessGate.css'

export default function InterviewAccessGate({ children }) {
  const {
    user,
    isAdmin,
    canAccessInterview,
    hasDemoAccess,
    allowedInterviews,
    completedInterviews,
    remainingInterviews,
    checkInterviewAccessStatus,
  } = useAuth()

  // Interview id from the matched child route (/new-interview/:id, /interview-room/:id, ...)
  const { id: interviewId } = useParams()

  // Only show checking state initially if the candidate is not yet recognized as authorized
  const [checking, setChecking] = useState(() => !isAdmin && !canAccessInterview)

  // The demo pass is consumed when an interview STARTS. That drops the remaining count to 0
  // while the candidate is still inside the interview, so "has passes left" alone is the
  // wrong test. Access granted on entering an interview is kept for that interview...
  const [grantedInterviewId, setGrantedInterviewId] = useState(null)
  if (canAccessInterview && interviewId && grantedInterviewId !== interviewId) {
    setGrantedInterviewId(interviewId)
  }
  // ...and the server also confirms access for an already-started interview (e.g. after a refresh)
  const [serverApprovedId, setServerApprovedId] = useState(null)

  const isAuthorized =
    canAccessInterview ||
    (Boolean(interviewId) && (grantedInterviewId === interviewId || serverApprovedId === interviewId))

  // Reads the latest auth values without re-running the effect below on every change
  const verifyAccess = useEffectEvent(async (targetId) => {
    if (isAdmin || canAccessInterview) return null
    return checkInterviewAccessStatus(targetId)
  })

  // Verify access with the backend when entering an interview route (safety timeout included)
  useEffect(() => {
    let isMounted = true
    // Safety timeout: Never leave user stuck on spinner if network is slow or sleeping
    const timer = setTimeout(() => {
      if (isMounted) setChecking(false)
    }, 2500)

    verifyAccess(interviewId)
      .then((data) => {
        if (isMounted && interviewId && data?.activeSessionAccess) {
          setServerApprovedId(interviewId)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setChecking(false)
      })

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [interviewId])

  // 1. Authorized (Admin, demo user with remaining passes, or an interview already in progress)
  if (isAuthorized) {
    return children ? children : <Outlet />
  }

  // 2. Initial verification spinner with timeout guarantee
  if (checking) {
    return (
      <div className="access-gate-container">
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid rgba(59, 130, 246, 0.2)',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ fontSize: '14px' }}>Verifying AI Mock Interview access privileges...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // 3. User has Demo Access enabled, but reached their interview attempt limit
  const isQuotaReached = hasDemoAccess && remainingInterviews === 0

  return (
    <div className="access-gate-container">
      <div className="access-gate-card">
        {isQuotaReached ? (
          <div className="access-gate-badge quota-exceeded" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Demo Quota Reached
          </div>
        ) : (
          <div className="access-gate-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
            Feature Coming Soon
          </div>
        )}

        <div className="access-gate-icon-wrap">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h1 className="access-gate-title">
          {isQuotaReached ? (
            <>
              Demo Interview Limit <span>Completed</span>
            </>
          ) : (
            <>
              AI Mock Interview is <span>Coming Soon</span>
            </>
          )}
        </h1>

        <p className="access-gate-desc">
          {isQuotaReached
            ? `You have completed all ${allowedInterviews} of your allocated mock interview attempts. Stay tuned as we expand platform capacity!`
            : `We are currently putting the final touches on our next-generation adaptive AI mock interview platform. This feature is coming soon for general access!`}
        </p>

        {/* Status Breakdown Box */}
        <div className="access-gate-status-box">
          <div className="status-box-header">
            <span className="status-box-label">Account Verification</span>
            <span className="status-box-account">{user?.email || 'Candidate Account'}</span>
          </div>

          <div className="status-item">
            <span>Interview Access Status:</span>
            {isQuotaReached ? (
              <span className="status-tag limit-reached">Quota Exceeded</span>
            ) : (
              <span className="status-tag blocked">Feature Coming Soon</span>
            )}
          </div>

          <div className="status-item">
            <span>Completed Mock Interviews:</span>
            <strong>{completedInterviews} completed</strong>
          </div>

          <div className="status-item">
            <span>Configured Demo Passes:</span>
            <strong>{allowedInterviews} total allowed</strong>
          </div>

          <div className="status-notice">
            {isQuotaReached ? (
              <>
                <strong>Notice:</strong> Your completed interview evaluations and feedback reports are saved and viewable in your profile anytime.
              </>
            ) : (
              <>
                <strong>Notice:</strong> Public access will unlock automatically as soon as this feature goes live for general release.
              </>
            )}
          </div>
        </div>

        {/* Feature Preview Badges */}
        <div className="access-gate-features">
          <div className="feature-pill">
            <span className="feature-pill-icon-box feature-pill-icon-box--cyan">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </span>
            <span className="feature-pill-text">Whisper V3 Voice & Real-Time TTS</span>
          </div>
          <div className="feature-pill">
            <span className="feature-pill-icon-box feature-pill-icon-box--blue">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </span>
            <span className="feature-pill-text">Live Code Sandbox & Automated Judge</span>
          </div>
          <div className="feature-pill">
            <span className="feature-pill-icon-box feature-pill-icon-box--purple">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04Z" />
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04Z" />
              </svg>
            </span>
            <span className="feature-pill-text">Adaptive Contextual Multi-Agent System</span>
          </div>
          <div className="feature-pill">
            <span className="feature-pill-icon-box feature-pill-icon-box--emerald">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </span>
            <span className="feature-pill-text">Multi-Domain Scoring & STAR Analysis</span>
          </div>
        </div>

        {/* Actions */}
        <div className="access-gate-actions">
          <Link to="/dashboard" className="gate-btn-primary">
            &larr; Return to Dashboard
          </Link>

          {isAdmin && (
            <Link to="/admin/pilot-access" className="gate-btn-secondary" style={{ borderColor: '#3b82f6', color: '#60a5fa' }}>
              Admin: Manage Demo Users &rarr;
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
