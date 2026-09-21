import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './DeleteAccountModal.css'

export default function DeleteAccountModal({ isOpen, onClose }) {
  const { user, deleteAccount } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [confirmWord, setConfirmWord] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Reset state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setShowPassword(false)
      setConfirmWord('')
      setAcknowledged(false)
      setIsDeleting(false)
      setError('')
      setSuccess(false)
    }
  }, [isOpen])

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isDeleting && !success) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scrolling when modal is open
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, isDeleting, success, onClose])

  if (!isOpen) return null

  const isFormValid = acknowledged && confirmWord.trim().toUpperCase() === 'DELETE'

  const handleDelete = async (e) => {
    e.preventDefault()
    if (!isFormValid || isDeleting) return

    setIsDeleting(true)
    setError('')

    try {
      await deleteAccount(password.trim() || null)
      setSuccess(true)
      setTimeout(() => {
        onClose()
        navigate('/signup')
      }, 1800)
    } catch (err) {
      setError(err.message || 'Failed to delete account. Please verify your credentials and try again.')
      setIsDeleting(false)
    }
  }

  return (
    <div className="del-modal-overlay" onClick={() => (!isDeleting && !success ? onClose() : null)}>
      <div
        className="del-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="del-modal-title"
      >
        {/* Glow accent */}
        <div className="del-modal-glow" aria-hidden="true" />

        {/* Close Button */}
        {!isDeleting && !success && (
          <button
            type="button"
            className="del-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        )}

        {success ? (
          <div className="del-modal-success">
            <div className="del-modal-success__icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="del-modal-success__title">Account Deleted</h3>
            <p className="del-modal-success__desc">
              Your HireMind profile, interview records, and uploaded documents have been permanently deleted.
            </p>
            <div className="del-modal-success__redirect">Redirecting to signup...</div>
          </div>
        ) : (
          <form onSubmit={handleDelete} className="del-modal-body">
            {/* Header / Warning Icon */}
            <div className="del-modal-header">
              <div className="del-modal-warning-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h2 id="del-modal-title" className="del-modal-title">Delete Account</h2>
              <p className="del-modal-subtitle">
                This action is <strong>permanent</strong> and cannot be undone. Please review what will be deleted:
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="del-modal-error" role="alert">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Impact Details Box */}
            <div className="del-modal-impact-box">
              <div className="del-impact-item">
                <span className="del-impact-bullet">🗑️</span>
                <div>
                  <strong>User Profile & Login:</strong> Your credentials, name, email ({user?.email || 'your account'}), and preferences will be permanently wiped.
                </div>
              </div>
              <div className="del-impact-item">
                <span className="del-impact-bullet">🤖</span>
                <div>
                  <strong>Interview Transcripts & Scores:</strong> All mock interview questions, AI coach performance analyses, and reports will be deleted.
                </div>
              </div>
              <div className="del-impact-item">
                <span className="del-impact-bullet">📁</span>
                <div>
                  <strong>Uploaded Files & Documents:</strong> All profile photos, resumes, and uploaded documents will be permanently purged.
                </div>
              </div>
            </div>

            {/* Password Verification (Optional if user logged in, but verified if provided) */}
            <div className="del-input-group">
              <label className="del-input-label" htmlFor="del-password">
                Account Password <span className="del-optional-tag">(Optional verification)</span>
              </label>
              <div className="del-password-wrapper">
                <input
                  id="del-password"
                  type={showPassword ? 'text' : 'password'}
                  className="del-text-input"
                  placeholder="Enter your password to confirm identity"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isDeleting}
                />
                <button
                  type="button"
                  className="del-password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirmation Word Check */}
            <div className="del-input-group">
              <label className="del-input-label" htmlFor="del-confirm-word">
                Type <strong>DELETE</strong> below to confirm:
              </label>
              <input
                id="del-confirm-word"
                type="text"
                className="del-text-input"
                placeholder="DELETE"
                value={confirmWord}
                onChange={(e) => setConfirmWord(e.target.value)}
                disabled={isDeleting}
                autoComplete="off"
              />
            </div>

            {/* Acknowledgment Checkbox */}
            <label className="del-checkbox-label">
              <input
                type="checkbox"
                className="del-checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                disabled={isDeleting}
              />
              <span>
                I understand that deleting my account is irreversible and all my HireMind data will be erased forever.
              </span>
            </label>

            {/* Action Buttons */}
            <div className="del-modal-actions">
              <button
                type="button"
                className="del-btn del-btn--cancel"
                onClick={onClose}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="del-btn del-btn--danger"
                disabled={!isFormValid || isDeleting}
              >
                {isDeleting ? (
                  <>
                    <span className="del-spinner" aria-hidden="true" />
                    <span>Deleting Account...</span>
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                    <span>Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
