import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { getApiUrl } from '../config/api'

// Helper for making API calls with dynamic backend base URL (Method 2)
const apiFetch = (endpoint, options) => fetch(getApiUrl(endpoint), options)

const AuthContext = createContext(null)

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
  const enable2FA = async (secret, code, frequency = 'always', customToken = null) => {
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
        body: JSON.stringify({ secret, code, frequency }),
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
  const disable2FA = async () => {
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
  const refreshUser = async () => {
    if (!token) return null
    try {
      const res = await apiFetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok && data.user) {
        setUser(data.user)
        localStorage.setItem('hiremind_user', JSON.stringify(data.user))
        return data.user
      }
      // Token is stale/invalid (e.g. after switching databases) — clear it cleanly
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        console.warn('[Auth] Stale token detected — clearing session')
        saveAuthSession(null, null)
      }
    } catch (e) {
      console.warn('Failed to refresh user:', e.message)
    }
    return null
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

  // If token exists on mount but user object is not yet loaded, refresh from /api/auth/me
  useEffect(() => {
    if (token && !user) {
      refreshUser()
    }
  }, [token])

  const isAdmin = useMemo(() => {
    return user?.role === 'admin' || user?.email === 'admin@gmail.com'
  }, [user])

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token || user),
      isAdmin,
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
    }),
    [user, token, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
