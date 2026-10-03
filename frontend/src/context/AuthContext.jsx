import { useState, useEffect, useEffectEvent, useMemo } from 'react'
import { AuthContext } from './authContextObject'
import { getApiUrl } from '../config/api'

// Helper for making API calls with dynamic backend base URL (Method 2)
const apiFetch = (endpoint, options) => fetch(getApiUrl(endpoint), options)

// Fetch the signed-in user's profile (no React state; callers apply the result)
async function requestCurrentUser(token) {
  const res = await apiFetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, user: data.user || null }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('hiremind_token') || null)
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('hiremind_user')
      return savedUser ? JSON.parse(savedUser) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(false)

  // Save auth state to localStorage
  const saveAuthSession = (newToken, newUser) => {
    setToken(newToken)
    setUser(newUser)
    if (newToken) {
      localStorage.setItem('hiremind_token', newToken)
    } else {
      localStorage.removeItem('hiremind_token')
    }

    if (newUser) {
      localStorage.setItem('hiremind_user', JSON.stringify(newUser))
    } else {
      localStorage.removeItem('hiremind_user')
    }
  }

  // Clear session on logout
  const logout = () => {
    saveAuthSession(null, null)
  }

  // Register: submits FormData containing user details + optional avatar
  const register = async (formData) => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: formData, // fetch will automatically set multipart/form-data boundary
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed')
      }

      return data
    } finally {
      setLoading(false)
    }
  }

  // Verify OTP
  const verifyOtp = async (email, otp) => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'OTP verification failed')
      }

      if (data.token && data.user) {
        saveAuthSession(data.token, data.user)
      }

      return data
    } finally {
      setLoading(false)
    }
  }

  // Resend OTP
  const resendOtp = async (email) => {
    const res = await apiFetch('/api/auth/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || 'Failed to resend code')
    }
    return data
  }

  // Login
  const login = async (email, password, rememberMe = true) => {
    setLoading(true)
    try {
      const trustedDeviceToken = localStorage.getItem('hiremind_device_token') || null
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe, trustedDeviceToken }),
      })

      const data = await res.json()
      if (!res.ok) {
        const error = new Error(data.message || 'Login failed')
        error.needsVerification = data.needsVerification
        error.email = data.email
        throw error
      }

      // If Two-Factor Authentication is required, return data to trigger 2FA input
      if (data.requires2FA) {
        return data
      }

      if (data.token && data.user) {
        saveAuthSession(data.token, data.user)
      }

      return data
    } finally {
      setLoading(false)
    }
  }

  // Setup 2FA: generates secret and QR code for authenticator apps
  const setup2FA = async (customToken = null) => {
    const activeToken = customToken || token
    if (!activeToken) {
      throw new Error('You must be signed in to configure two-factor authentication')
    }

    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Failed to generate 2FA setup')
      }

      return data
    } finally {
      setLoading(false)
    }
  }

  // Enable 2FA: verifies 6-digit TOTP code and configures frequency preference
  // `currentCode` is required by the server when 2FA is already on (reconfiguring a device)
  const enable2FA = async (secret, code, frequency = 'always', customToken = null, currentCode = null) => {
    const activeToken = customToken || token
    if (!activeToken) {
      throw new Error('You must be signed in to activate two-factor authentication')
    }

    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({ secret, code, frequency, ...(currentCode ? { currentCode } : {}) }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Failed to activate two-factor authentication')
      }

      if (data.trustedDeviceToken) {
        localStorage.setItem('hiremind_device_token', data.trustedDeviceToken)
      }

      if (data.user) {
        setUser(data.user)
        localStorage.setItem('hiremind_user', JSON.stringify(data.user))
      }

      return data
    } finally {
      setLoading(false)
    }
  }

  // Disable 2FA: deactivates two-factor authentication for the account
  // Disable 2FA requires a current 6-digit authenticator code (proves possession of the device)
  const disable2FA = async (code) => {
    if (!token) {
      throw new Error('You must be signed in to disable two-factor authentication')
    }

    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Failed to disable two-factor authentication')
      }

      localStorage.removeItem('hiremind_device_token')

      if (data.user) {
        setUser(data.user)
        localStorage.setItem('hiremind_user', JSON.stringify(data.user))
      }

      return data
    } finally {
      setLoading(false)
    }
  }

  // Verify 2FA Login: exchanges tempToken and 6-digit authenticator code for session token
  const verify2FALogin = async (tempToken, code) => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Invalid authenticator code')
      }

      if (data.trustedDeviceToken) {
        localStorage.setItem('hiremind_device_token', data.trustedDeviceToken)
      }

      if (data.token && data.user) {
        saveAuthSession(data.token, data.user)
      }

      return data
    } finally {
      setLoading(false)
    }
  }

  // Forgot Password: send OTP code to email
  const forgotPassword = async (email) => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Failed to send password reset code')
      }
      return data
    } finally {
      setLoading(false)
    }
  }

  // Reset Password: verify OTP and update password
  const resetPassword = async (email, otp, newPassword) => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Password reset failed')
      }
      return data
    } finally {
      setLoading(false)
    }
  }

  // Delete account: permanently deletes from MongoDB and Cloudflare R2, clears session
  const deleteAccount = async (password = null) => {
    setLoading(true)
    try {
      if (token) {
        const res = await apiFetch('/api/auth/account', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(password ? { password } : {}),
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.message || 'Failed to delete account')
        }
      }
      logout()
    } finally {
      setLoading(false)
    }
  }

  // Refresh user data from /api/auth/me
  // Apply a /api/auth/me result to state
  const applyCurrentUser = ({ ok, status, user: freshUser }) => {
    if (ok && freshUser) {
      setUser(freshUser)
      localStorage.setItem('hiremind_user', JSON.stringify(freshUser))
      return freshUser
    }
    // Token is stale/invalid (e.g. after switching databases) — clear it cleanly
    if (status === 401 || status === 403 || status === 404) {
      console.warn('[Auth] Stale token detected — clearing session')
      saveAuthSession(null, null)
    }
    return null
  }

  const refreshUser = async () => {
    if (!token) return null
    try {
      return applyCurrentUser(await requestCurrentUser(token))
    } catch (e) {
      console.warn('Failed to refresh user:', e.message)
      return null
    }
  }

  // Update Profile fields
  const updateUserProfile = async (updates) => {
    if (!token) throw new Error('Not authenticated')
    const res = await apiFetch('/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || 'Failed to update profile')
    }
    if (data.user) {
      setUser(data.user)
      localStorage.setItem('hiremind_user', JSON.stringify(data.user))
    }
    return data
  }

  // Upload Resume
  const uploadUserResume = async (file) => {
    if (!token) throw new Error('Not authenticated')
    const formData = new FormData()
    formData.append('resume', file)
    const res = await apiFetch('/api/profile/resume', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || 'Failed to upload resume')
    }
    if (data.user) {
      setUser(data.user)
      localStorage.setItem('hiremind_user', JSON.stringify(data.user))
    }
    return data
  }

  // Delete Resume
  const deleteUserResume = async () => {
    if (!token) throw new Error('Not authenticated')
    const res = await apiFetch('/api/profile/resume', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || 'Failed to remove resume')
    }
    if (data.user) {
      setUser(data.user)
      localStorage.setItem('hiremind_user', JSON.stringify(data.user))
    }
    return data
  }

  // Upload Avatar
  const uploadUserAvatar = async (file) => {
    if (!token) throw new Error('Not authenticated')
    const formData = new FormData()
    formData.append('avatar', file)
    const res = await apiFetch('/api/profile/avatar', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || 'Failed to upload avatar')
    }
    if (data.user) {
      setUser(data.user)
      localStorage.setItem('hiremind_user', JSON.stringify(data.user))
    }
    return data
  }

  // Connect GitHub
  const connectUserGithub = async (username) => {
    if (!token) throw new Error('Not authenticated')
    const res = await apiFetch('/api/profile/github/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || 'Failed to connect GitHub')
    }
    if (data.user) {
      setUser(data.user)
      localStorage.setItem('hiremind_user', JSON.stringify(data.user))
    }
    return data
  }

  // Disconnect GitHub
  const disconnectUserGithub = async () => {
    if (!token) throw new Error('Not authenticated')
    const res = await apiFetch('/api/profile/github/disconnect', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || 'Failed to disconnect GitHub')
    }
    if (data.user) {
      setUser(data.user)
      localStorage.setItem('hiremind_user', JSON.stringify(data.user))
    }
    return data
  }

  // Update Skills
  const updateUserSkills = async (payload) => {
    if (!token) throw new Error('Not authenticated')
    const res = await apiFetch('/api/profile/skills', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || 'Failed to update skills')
    }
    if (data.user) {
      setUser(data.user)
      localStorage.setItem('hiremind_user', JSON.stringify(data.user))
    }
    return data
  }

  // Update Interests
  const updateUserInterests = async (payload) => {
    if (!token) throw new Error('Not authenticated')
    const res = await apiFetch('/api/profile/interests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || 'Failed to update career interests')
    }
    if (data.user) {
      setUser(data.user)
      localStorage.setItem('hiremind_user', JSON.stringify(data.user))
    }
    return data
  }

  // Update LinkedIn
  const updateUserLinkedin = async (payload) => {
    if (!token) throw new Error('Not authenticated')
    const res = await apiFetch('/api/profile/linkedin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || 'Failed to update LinkedIn')
    }
    if (data.user) {
      setUser(data.user)
      localStorage.setItem('hiremind_user', JSON.stringify(data.user))
    }
    return data
  }

  // If a token exists but the user object is not loaded yet, load it from /api/auth/me
  const needsUserLoad = Boolean(token && !user)
  const applyLoadedUser = useEffectEvent((result) => {
    applyCurrentUser(result)
  })
  useEffect(() => {
    if (!needsUserLoad) return undefined
    let ignore = false
    requestCurrentUser(token)
      .then((result) => {
        if (!ignore) applyLoadedUser(result)
      })
      .catch((e) => console.warn('Failed to load user:', e.message))
    return () => {
      ignore = true
    }
  }, [needsUserLoad, token])

  const isAdmin = useMemo(() => {
    return user?.role === 'admin' || user?.email === 'admin@gmail.com'
  }, [user])

  const demoAccess = user?.demoAccess || {}
  const hasDemoAccess = Boolean(demoAccess.enabled)
  const allowedInterviews = Number(demoAccess.allowedInterviews) || 0
  const completedInterviews = Number(demoAccess.completedInterviews) || 0
  const remainingInterviews = Math.max(0, allowedInterviews - completedInterviews)

  // Can the user enter an AI Interview session?
  const canAccessInterview = useMemo(() => {
    if (isAdmin) return true
    return hasDemoAccess && remainingInterviews > 0
  }, [isAdmin, hasDemoAccess, remainingInterviews])

  const updateDemoQuota = (newDemoAccess) => {
    if (!newDemoAccess) return
    setUser((prev) => {
      if (!prev) return prev
      const updated = {
        ...prev,
        demoAccess: {
          ...(prev.demoAccess || {}),
          ...newDemoAccess,
        },
      }
      localStorage.setItem('hiremind_user', JSON.stringify(updated))
      return updated
    })
  }

  // Pass `sessionId` to also ask whether that specific (already started) interview may continue
  const checkInterviewAccessStatus = async (sessionId = null) => {
    try {
      const activeToken = token || localStorage.getItem('hiremind_token')
      const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
      const res = await apiFetch(`/api/interview/access-status${query}`, {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
      })
      const data = await res.json()
      // Ignore anonymous responses (token rejected / expired) and admin responses —
      // they describe a different session and must not overwrite this user's state.
      if (data.success && data.isAuthenticated !== false && !data.isAdmin) {
        setUser((prev) => {
          if (!prev) return prev
          const curDemo = prev.demoAccess || {}
          const hasChanged =
            Boolean(curDemo.enabled) !== Boolean(data.hasDemoAccess) ||
            Number(curDemo.allowedInterviews || 0) !== Number(data.allowedInterviews || 0) ||
            Number(curDemo.completedInterviews || 0) !== Number(data.completedInterviews || 0) ||
            (Boolean(data.isProfileSetupCompleted) && !prev.isProfileSetupCompleted)

          if (!hasChanged) return prev

          // Preserve completed profile setup flag: a demo-access sync may mark setup as
          // done, but must never revert it to false (that would bounce the candidate back
          // to /profile-setup from the Dashboard).
          const isSetupDone = Boolean(prev.isProfileSetupCompleted) || Boolean(data.isProfileSetupCompleted)

          const updatedUser = {
            ...prev,
            isProfileSetupCompleted: isSetupDone,
            demoAccess: {
              ...curDemo,
              enabled: Boolean(data.hasDemoAccess),
              allowedInterviews: Number(data.allowedInterviews) || 0,
              completedInterviews: Number(data.completedInterviews) || 0,
              notes: data.notes || curDemo.notes || '',
            },
          }
          localStorage.setItem('hiremind_user', JSON.stringify(updatedUser))
          return updatedUser
        })
      }
      return data
    } catch {
      return { canAccess: canAccessInterview, isComingSoon: !hasDemoAccess }
    }
  }

  // Keep every open tab on the SAME signed-in account.
  // All tabs share localStorage, so signing in (e.g. as admin) in one tab replaces the
  // stored token. Without this, an older tab kept showing the previous account while its
  // requests silently used the new account's token (403s / endless loading in interviews).
  useEffect(() => {
    const handleSessionChange = (e) => {
      if (e.key !== 'hiremind_token' && e.key !== 'hiremind_user' && e.key !== null) return
      const storedToken = localStorage.getItem('hiremind_token') || null
      let storedUser
      try {
        const raw = localStorage.getItem('hiremind_user')
        storedUser = raw ? JSON.parse(raw) : null
      } catch {
        storedUser = null
      }
      setToken(storedToken)
      setUser(storedToken ? storedUser : null)
    }
    window.addEventListener('storage', handleSessionChange)
    return () => window.removeEventListener('storage', handleSessionChange)
  }, [])

  // Live Real-Time Stream (Server-Sent Events) & Cross-Tab Sync for Demo Access updates
  // (candidates only — admins have unrestricted access and must not react to their own broadcasts)
  const currentUserId = String(user?._id || user?.id || '')

  // Effect events always see the latest state/helpers without re-opening the SSE connection
  const syncAccessStatus = useEffectEvent(() => {
    checkInterviewAccessStatus()
  })
  const applyLiveDemoUpdate = useEffectEvent((payload) => {
    if (payload?.demoAccess) {
      updateDemoQuota(payload.demoAccess)
    }
    checkInterviewAccessStatus()
    window.dispatchEvent(new CustomEvent('hiremind_demo_access_live_updated', { detail: payload }))
  })

  useEffect(() => {
    if (!token || !currentUserId || isAdmin) return

    let eventSource = null
    let pollInterval = null

    // 1. Server-Sent Events (SSE) live connection to backend
    try {
      const activeToken = token || localStorage.getItem('hiremind_token')
      if (activeToken) {
        const streamUrl = getApiUrl(`/api/interview/live-events?token=${encodeURIComponent(activeToken)}`)
        eventSource = new EventSource(streamUrl)

        eventSource.addEventListener('demo_access_changed', (evt) => {
          try {
            const payload = JSON.parse(evt.data)
            if (payload.userId && payload.userId.toString() === currentUserId) {
              console.log('[RealTime SSE] Received live demo access update:', payload)
              applyLiveDemoUpdate(payload)
            }
          } catch (e) {
            console.warn('[RealTime SSE] Parse error:', e)
          }
        })
      }
    } catch (sseErr) {
      console.warn('[RealTime SSE] Could not start EventSource:', sseErr)
    }

    // 2. BroadcastChannel cross-tab instant sync
    let broadcastChannel = null
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        broadcastChannel = new BroadcastChannel('hiremind_demo_sync')
        broadcastChannel.onmessage = (msg) => {
          if (!msg.data || !msg.data.userId || msg.data.userId.toString() === currentUserId) {
            syncAccessStatus()
            window.dispatchEvent(
              new CustomEvent('hiremind_demo_access_live_updated', { detail: msg.data })
            )
          }
        }
      }
    } catch { /* non-critical; safe to ignore */ }

    // 3. Storage event sync
    const handleStorage = (e) => {
      if (e.key === 'hiremind_demo_sync' && e.newValue) {
        syncAccessStatus()
      }
    }
    window.addEventListener('storage', handleStorage)

    // 4. Adaptive heartbeat polling (every 4 seconds when candidate is waiting for demo access or remaining is 0)
    // and instant refresh on window focus / tab visibility
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncAccessStatus()
      }
    }
    const handleFocus = () => {
      syncAccessStatus()
    }
    window.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    pollInterval = setInterval(() => {
      syncAccessStatus()
    }, 4000)

    return () => {
      if (eventSource) eventSource.close()
      if (broadcastChannel) broadcastChannel.close()
      if (pollInterval) clearInterval(pollInterval)
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [token, currentUserId, isAdmin])

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token || user),
    isAdmin,
    demoAccess,
    hasDemoAccess,
    allowedInterviews,
    completedInterviews,
    remainingInterviews,
    canAccessInterview,
    checkInterviewAccessStatus,
    updateDemoQuota,
    loading,
    login,
    register,
    verifyOtp,
    resendOtp,
    setup2FA,
    enable2FA,
    disable2FA,
    verify2FALogin,
    forgotPassword,
    resetPassword,
    deleteAccount,
    logout,
    setUser,
    refreshUser,
    updateUserProfile,
    uploadUserResume,
    deleteUserResume,
    uploadUserAvatar,
    connectUserGithub,
    disconnectUserGithub,
    updateUserSkills,
    updateUserInterests,
    updateUserLinkedin,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
