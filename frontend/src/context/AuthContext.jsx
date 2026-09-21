import { createContext, useContext, useState, useEffect, useMemo } from 'react'

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
      const res = await fetch('/api/auth/register', {
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
      const res = await fetch('/api/auth/verify-otp', {
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
    const res = await fetch('/api/auth/resend-otp', {
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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      })

      const data = await res.json()
      if (!res.ok) {
        const error = new Error(data.message || 'Login failed')
        error.needsVerification = data.needsVerification
        error.email = data.email
        throw error
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
      const res = await fetch('/api/auth/forgot-password', {
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
      const res = await fetch('/api/auth/reset-password', {
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
        const res = await fetch('/api/auth/account', {
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

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: !!token && !!user,
      loading,
      login,
      register,
      verifyOtp,
      resendOtp,
      forgotPassword,
      resetPassword,
      deleteAccount,
      logout,
      setUser,
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
