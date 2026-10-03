import { useState, useEffect, useEffectEvent } from 'react'
import { useAuth } from '../context/useAuth'
import logoIconBlack from '../assets/images/logo-icon.png'
import './TwoFactorModal.css'

const EMPTY_CODE = ['', '', '', '', '', '']

/**
 * Reusable 6-digit code input row.
 * `idPrefix` keeps focus handling independent when two rows are on screen.
 */
function CodeDigits({ digits, onChange, idPrefix, autoFocus = false }) {
  const focusDigit = (index) => {
    const el = document.getElementById(`${idPrefix}-${index}`)
    if (el) el.focus()
  }

  const handleDigitChange = (index, val) => {
    const cleanVal = val.replace(/\D/g, '')

    // Handle paste of full 6-digit code
    if (cleanVal.length > 1) {
      const chars = cleanVal.slice(0, 6).split('')
      const updated = [...EMPTY_CODE]
      chars.forEach((c, i) => {
        updated[i] = c
      })
      onChange(updated)
      focusDigit(Math.min(chars.length, 5))
      return
    }

    const updated = [...digits]
    updated[index] = cleanVal
    onChange(updated)

    if (cleanVal && index < 5) {
      focusDigit(index + 1)
    }
  }

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const updated = [...digits]
      updated[index - 1] = ''
      onChange(updated)
      focusDigit(index - 1)
    }
  }

  return (
    <div className="mfa-digits-row">
      {digits.map((digit, idx) => (
        <input
          key={idx}
          id={`${idPrefix}-${idx}`}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          className="mfa-digit-input"
          value={digit}
          onChange={(e) => handleDigitChange(idx, e.target.value)}
          onKeyDown={(e) => handleDigitKeyDown(idx, e)}
          autoFocus={autoFocus && idx === 0}
          aria-label={`Digit ${idx + 1}`}
        />
      ))}
    </div>
  )
}

function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="mfa-modal-error" role="alert">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
      <span>{message}</span>
    </div>
  )
}

/**
 * Two-factor authentication modal.
 *   mode="enable"  — set up (or reconfigure) an authenticator app
 *   mode="disable" — turn 2FA off; requires a current authenticator code
 *
 * The content component is mounted fresh every time the modal opens, so all
 * form state starts clean without resetting it inside an effect.
 */
export default function TwoFactorModal({ isOpen, ...props }) {
  if (!isOpen) return null
  return <TwoFactorModalContent {...props} />
}

function TwoFactorModalContent({ onClose, onSuccess, mode = 'enable' }) {
  const { user, setup2FA, enable2FA, disable2FA } = useAuth()
  const isDisableMode = mode === 'disable'
  // Reconfiguring an already-active authenticator needs a code from the current device
  const needsCurrentCode = !isDisableMode && Boolean(user?.twoFactorEnabled)

  const [loading, setLoading] = useState(!isDisableMode)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [mfaData, setMfaData] = useState(null)
  const [frequency, setFrequency] = useState('always')
  const [codeDigits, setCodeDigits] = useState(EMPTY_CODE)
  const [currentCodeDigits, setCurrentCodeDigits] = useState(EMPTY_CODE)
  const [copiedSecret, setCopiedSecret] = useState(false)

  // setup2FA's identity changes whenever the auth context re-renders; wrapping it in an
  // effect event lets the effect below run once per open instead of on every change.
  const requestSetup = useEffectEvent(() => setup2FA())

  // Load a new authenticator secret + QR code (enable mode only)
  useEffect(() => {
    if (isDisableMode) return undefined
    let cancelled = false
    requestSetup()
      .then((data) => {
        if (!cancelled) setMfaData(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to initialize authenticator setup.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isDisableMode])

  // Close on Escape key press & lock background scroll
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting && !success) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [submitting, success, onClose])

  const handleCopySecret = async () => {
    if (!mfaData?.manualEntryKey) return
    try {
      await navigator.clipboard.writeText(mfaData.manualEntryKey)
    } catch {
      // Clipboard can be blocked by the browser; the key stays visible for manual copy
    }
    setCopiedSecret(true)
    setTimeout(() => setCopiedSecret(false), 2500)
  }

  const finishWithSuccess = (message) => {
    setSuccess(true)
    if (onSuccess) onSuccess(message)
    setTimeout(() => {
      onClose()
    }, 1400)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const code = codeDigits.join('')
    const currentCode = currentCodeDigits.join('')

    if (code.length !== 6) {
      setError('Please enter the full 6-digit code shown in your authenticator app.')
      return
    }
    if (needsCurrentCode && currentCode.length !== 6) {
      setError('Please enter the 6-digit code from your CURRENT authenticator app.')
      return
    }

    setSubmitting(true)
    try {
      if (isDisableMode) {
        await disable2FA(code)
        finishWithSuccess('Two-factor authentication disabled successfully')
      } else {
        await enable2FA(mfaData.secret, code, frequency, null, needsCurrentCode ? currentCode : null)
        finishWithSuccess(
          needsCurrentCode
            ? 'Two-factor authentication reconfigured successfully!'
            : 'Two-factor authentication successfully enabled!'
        )
      }
    } catch (err) {
      setError(err.message || 'Invalid verification code. Please check your authenticator app.')
      setSubmitting(false)
    }
  }

  const title = isDisableMode
    ? 'Disable Two-Factor Authentication'
    : needsCurrentCode
      ? 'Reconfigure Two-Factor Authentication'
      : 'Enable Two-Factor Authentication'

  const subtitle = isDisableMode
    ? 'Confirm it is really you: enter the current 6-digit code from your authenticator app. Your account will then be protected by your password only.'
    : 'Scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, 2FAS, or 1Password).'

  const successTitle = isDisableMode ? '2FA Disabled' : '2FA Activated!'
  const successDesc = isDisableMode
    ? 'Two-factor authentication has been turned off for your account.'
    : 'Your HireMind account is now fortified with two-factor authentication.'

  const codeComplete = codeDigits.join('').length === 6
  const currentCodeComplete = !needsCurrentCode || currentCodeDigits.join('').length === 6

  // Step numbers shift by one when the "current code" step is shown first
  const scanStep = needsCurrentCode ? 2 : 1

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
            <h3 className="mfa-modal-success__title">{successTitle}</h3>
            <p className="mfa-modal-success__desc">{successDesc}</p>
          </div>
        ) : (
          <div className="mfa-modal-body">
            <div className="mfa-modal-header">
              <div className="mfa-modal-shield-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <h2 id="mfa-modal-title" className="mfa-modal-title">
                {title}
              </h2>
              <p className="mfa-modal-subtitle">{subtitle}</p>
            </div>

            <ErrorBanner message={error} />

            {loading ? (
              <div className="mfa-modal-loading">
                <div className="mfa-modal-spinner" />
                <span>Generating secure authenticator key...</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mfa-modal-form">
                {isDisableMode ? (
                  <div className="mfa-step-box">
                    <div className="mfa-step-label">
                      <span className="mfa-step-num">1</span>
                      <span>Enter the current 6-digit code from your authenticator app</span>
                    </div>
                    <CodeDigits digits={codeDigits} onChange={setCodeDigits} idPrefix="mfa-disable-digit" autoFocus />
                  </div>
                ) : (
                  <>
                    {needsCurrentCode && (
                      <div className="mfa-step-box">
                        <div className="mfa-step-label">
                          <span className="mfa-step-num">1</span>
                          <span>Enter a code from your CURRENT authenticator app</span>
                        </div>
                        <CodeDigits
                          digits={currentCodeDigits}
                          onChange={setCurrentCodeDigits}
                          idPrefix="mfa-current-digit"
                          autoFocus
                        />
                      </div>
                    )}

                    <div className="mfa-step-box">
                      <div className="mfa-step-label">
                        <span className="mfa-step-num">{scanStep}</span>
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
                            <button type="button" className="mfa-copy-btn" onClick={handleCopySecret}>
                              {copiedSecret ? 'Copied ✓' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mfa-step-box">
                      <div className="mfa-step-label">
                        <span className="mfa-step-num">{scanStep + 1}</span>
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

                    <div className="mfa-step-box">
                      <div className="mfa-step-label">
                        <span className="mfa-step-num">{scanStep + 2}</span>
                        <span>
                          {needsCurrentCode
                            ? 'Enter 6-digit code from the NEW authenticator entry'
                            : 'Enter 6-digit code from authenticator app'}
                        </span>
                      </div>
                      <CodeDigits
                        digits={codeDigits}
                        onChange={setCodeDigits}
                        idPrefix="mfa-modal-digit"
                        autoFocus={!needsCurrentCode}
                      />
                    </div>
                  </>
                )}

                <div className="mfa-modal-actions">
                  <button type="button" className="mfa-btn mfa-btn--cancel" onClick={onClose} disabled={submitting}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="mfa-btn mfa-btn--primary"
                    disabled={submitting || !codeComplete || !currentCodeComplete}
                  >
                    {submitting ? 'Verifying...' : isDisableMode ? 'Disable 2FA' : 'Activate 2FA'}
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
