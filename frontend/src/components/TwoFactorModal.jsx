import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import logoIconBlack from '../assets/images/logo-icon.png'
import './TwoFactorModal.css'

export default function TwoFactorModal({ isOpen, onClose, onSuccess }) {
  const { setup2FA, enable2FA } = useAuth()

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [mfaData, setMfaData] = useState(null)
  const [frequency, setFrequency] = useState('always')
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', ''])
  const [copiedSecret, setCopiedSecret] = useState(false)

  // Initialize MFA Setup data when modal opens
  useEffect(() => {
    if (isOpen) {
      setError('')
      setSuccess(false)
      setCodeDigits(['', '', '', '', '', ''])
      setFrequency('always')
      setCopiedSecret(false)

      const loadSetup = async () => {
        setLoading(true)
        try {
          const data = await setup2FA()
          setMfaData(data)
        } catch (err) {
          setError(err.message || 'Failed to initialize authenticator setup.')
        } finally {
          setLoading(false)
        }
      }
      loadSetup()
    } else {
      setMfaData(null)
    }
  }, [isOpen])

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting && !success) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, submitting, success, onClose])

  if (!isOpen) return null

  // Copy manual secret key to clipboard
  const handleCopySecret = async () => {
    if (!mfaData?.manualEntryKey) return
    try {
      await navigator.clipboard.writeText(mfaData.manualEntryKey)
      setCopiedSecret(true)
      setTimeout(() => setCopiedSecret(false), 2500)
    } catch {
      // Fallback
      setCopiedSecret(true)
      setTimeout(() => setCopiedSecret(false), 2500)
    }
  }

  // Handle 6-digit code input
  const handleDigitChange = (index, val) => {
    const cleanVal = val.replace(/\D/g, '')

    // Handle paste of full 6-digit code
    if (cleanVal.length > 1) {
      const chars = cleanVal.slice(0, 6).split('')
      const updated = ['', '', '', '', '', '']
      chars.forEach((c, i) => {
        updated[i] = c
      })
      setCodeDigits(updated)
      const nextFocus = Math.min(chars.length, 5)
      const nextEl = document.getElementById(`mfa-modal-digit-${nextFocus}`)
      if (nextEl) nextEl.focus()
      return
    }

    const updated = [...codeDigits]
    updated[index] = cleanVal
    setCodeDigits(updated)

    if (cleanVal && index < 5) {
      const nextEl = document.getElementById(`mfa-modal-digit-${index + 1}`)
      if (nextEl) nextEl.focus()
    }
  }

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      const prevEl = document.getElementById(`mfa-modal-digit-${index - 1}`)
      if (prevEl) {
        prevEl.focus()
        const updated = [...codeDigits]
        updated[index - 1] = ''
        setCodeDigits(updated)
      }
    }
  }

  // Submit activation
  const handleActivate = async (e) => {
    e.preventDefault()
    setError('')
    const code = codeDigits.join('')
    if (code.length !== 6) {
      setError('Please enter the full 6-digit code shown in your authenticator app.')
      return
    }

    setSubmitting(true)
    try {
      await enable2FA(mfaData.secret, code, frequency)
      setSuccess(true)
      if (onSuccess) {
        onSuccess('Two-factor authentication successfully enabled!')
      }
      setTimeout(() => {
        onClose()
      }, 1400)
    } catch (err) {
      setError(err.message || 'Invalid verification code. Please check your authenticator app.')
      setSubmitting(false)
    }
  }

  return (
    <div className="mfa-modal-overlay" onClick={() => (!submitting && !success ? onClose() : null)}>
      <div
        className="mfa-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mfa-modal-title"
      >
        <div className="mfa-modal-glow" aria-hidden="true" />

        {/* Close button */}
        {!submitting && !success && (
          <button type="button" className="mfa-modal-close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        )}

        {success ? (
          <div className="mfa-modal-success">
            <div className="mfa-modal-success__icon">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="mfa-modal-success__title">2FA Activated!</h3>
            <p className="mfa-modal-success__desc">
              Your HireMind account is now fortified with two-factor authentication.
            </p>
          </div>
        ) : (
          <div className="mfa-modal-body">
            {/* Header */}
            <div className="mfa-modal-header">
              <div className="mfa-modal-shield-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <h2 id="mfa-modal-title" className="mfa-modal-title">
                Enable Two-Factor Authentication
              </h2>
              <p className="mfa-modal-subtitle">
                Scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, 2FAS, or 1Password).
              </p>
            </div>

            {error && (
              <div className="mfa-modal-error" role="alert">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="mfa-modal-loading">
                <div className="mfa-modal-spinner" />
                <span>Generating secure authenticator key...</span>
              </div>
            ) : (
              <form onSubmit={handleActivate} className="mfa-modal-form">
                {/* STEP 1: QR Code & Manual Key */}
                <div className="mfa-step-box">
                  <div className="mfa-step-label">
                    <span className="mfa-step-num">1</span>
                    <span>Scan this QR code with your authenticator</span>
                  </div>

                  <div className="mfa-qr-center-wrap">
                    {mfaData?.qrCodeUrl && (
                      <div className="mfa-qr-card">
                        <img src={mfaData.qrCodeUrl} alt="2FA QR Code" className="mfa-qr-img" />
                        <div className="mfa-qr-badge" title="HireMind Verified">
                          <img src={logoIconBlack} alt="HireMind" className="mfa-qr-logo" />
                        </div>
                      </div>
                    )}

                    <div className="mfa-manual-key-wrap">
                      <span className="mfa-manual-title">Or enter key manually:</span>
                      <div className="mfa-manual-box">
                        <code className="mfa-manual-code">{mfaData?.manualEntryKey}</code>
                        <button
                          type="button"
                          className="mfa-copy-btn"
                          onClick={handleCopySecret}
                        >
                          {copiedSecret ? 'Copied ✓' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* STEP 2: Verification Frequency Choice */}
                <div className="mfa-step-box">
                  <div className="mfa-step-label">
                    <span className="mfa-step-num">2</span>
                    <span>Choose verification frequency</span>
                  </div>

                  <div className="mfa-frequency-grid">
                    <label className={`mfa-freq-card ${frequency === 'always' ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="frequency"
                        value="always"
                        checked={frequency === 'always'}
                        onChange={() => setFrequency('always')}
                      />
                      <div className="mfa-freq-text">
                        <strong>Every sign-in (Recommended)</strong>
                        <span>Prompts for 6-digit code on every login for maximum protection.</span>
                      </div>
                    </label>

                    <label className={`mfa-freq-card ${frequency === 'every_two_weeks' ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="frequency"
                        value="every_two_weeks"
                        checked={frequency === 'every_two_weeks'}
                        onChange={() => setFrequency('every_two_weeks')}
                      />
                      <div className="mfa-freq-text">
                        <strong>Every 2 weeks</strong>
                        <span>Trust this browser for 14 days before asking for code again.</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* STEP 3: 6-Digit TOTP Code */}
                <div className="mfa-step-box">
                  <div className="mfa-step-label">
                    <span className="mfa-step-num">3</span>
                    <span>Enter 6-digit code from authenticator app</span>
                  </div>

                  <div className="mfa-digits-row">
                    {codeDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        id={`mfa-modal-digit-${idx}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        className="mfa-digit-input"
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="mfa-modal-actions">
                  <button
                    type="button"
                    className="mfa-btn mfa-btn--cancel"
                    onClick={onClose}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="mfa-btn mfa-btn--primary"
                    disabled={submitting || codeDigits.join('').length !== 6}
                  >
                    {submitting ? 'Verifying...' : 'Activate 2FA'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
