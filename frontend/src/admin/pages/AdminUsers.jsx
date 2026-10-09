import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UsersIcon,
  ActivityIcon,
  PilotAccessIcon,
  XCircleIcon,
  SearchIcon,
  TrendingUpIcon,
  CloseIcon,
  CheckCircleIcon,
  ClockIcon,
  SparklesIcon,
} from '../AdminIcons'
import { getApiUrl } from '../../config/api'
import './AdminPage.css'
import './AdminUsers.css'

// Fetch all users from the backend (no React state; throws on failure)
async function requestUsers() {
  const token = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
  const res = await fetch(getApiUrl('/api/admin/users'), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) {
    throw new Error(`Failed to load users (${res.status})`)
  }
  const data = await res.json()
  if (!data.success) {
    throw new Error(data.message || 'Unable to retrieve users')
  }
  return data
}

export default function AdminUsers() {
  const navigate = useNavigate()

  // State
  const [usersList, setUsersList] = useState([])
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    demoUsers: 0,
    inactiveUsers: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filtering & Pagination
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('All Users')
  const [sortBy, setSortBy] = useState('joined_desc')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  // Selected User for View Profile Details Modal
  // Store only the id; the shown record is derived from the latest users list
  const [selectedUserId, setSelectedUserId] = useState(null)

  // Demo Access Modal state
  const [demoManageUser, setDemoManageUser] = useState(null)
  const [manageQuota, setManageQuota] = useState(3)
  const [manageNotes, setManageNotes] = useState('')
  const [resetCompletedCount, setResetCompletedCount] = useState(false)
  const [manageSubmitting, setManageSubmitting] = useState(false)
  const [demoFeedbackToast, setDemoFeedbackToast] = useState('')

  // Small Popup Modal for Candidate Actions
  const [actionPopupUser, setActionPopupUser] = useState(null)

  const showToast = (msg) => {
    setDemoFeedbackToast(msg)
    setTimeout(() => setDemoFeedbackToast(''), 3500)
  }

  // ========================================================================
  // LIVE API FETCH
  // ========================================================================
  // Apply a users API response to page state
  const applyUsersData = useCallback((data) => {
    setError(null)
    setUsersList(data.users || [])
    setStats(
      data.stats || {
        totalUsers: data.users?.length || 0,
        activeUsers: 0,
        demoUsers: 0,
        inactiveUsers: 0,
      }
    )
  }, [])

  // Refresh after admin actions / refresh button (data updates in place)
  const fetchUsers = useCallback(async () => {
    try {
      applyUsersData(await requestUsers())
    } catch (err) {
      console.error('[AdminUsers] Error loading users:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [applyUsersData])

  // Initial load
  useEffect(() => {
    let ignore = false
    requestUsers()
      .then((data) => {
        if (!ignore) applyUsersData(data)
      })
      .catch((err) => {
        console.error('[AdminUsers] Error loading users:', err)
        if (!ignore) setError(err.message)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [applyUsersData])


  const selectedUser = selectedUserId ? usersList.find((u) => u.id === selectedUserId) || null : null

  // ========================================================================
  // FILTERING & SORTING LOGIC
  // ========================================================================
  const filteredUsers = useMemo(() => {
    return usersList
      .filter((user) => {
        // Search Filter
        const q = searchQuery.toLowerCase().trim()
        const matchesQuery =
          !q ||
          user.name?.toLowerCase().includes(q) ||
          user.email?.toLowerCase().includes(q) ||
          user.accountType?.toLowerCase().includes(q) ||
          user.field?.toLowerCase().includes(q) ||
          user.careerStage?.toLowerCase().includes(q)

        // Dropdown Filter
        let matchesType = true
        if (filterType === 'Regular') matchesType = user.accountType === 'Regular'
        else if (filterType === 'Demo') matchesType = user.accountType === 'Demo'
        else if (filterType === 'Active') matchesType = user.status === 'Active'
        else if (filterType === 'Inactive') matchesType = user.status === 'Inactive'

        return matchesQuery && matchesType
      })
      .sort((a, b) => {
        if (sortBy === 'joined_desc') return new Date(b.joinedDate || 0) - new Date(a.joinedDate || 0)
        if (sortBy === 'joined_asc') return new Date(a.joinedDate || 0) - new Date(b.joinedDate || 0)
        if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '')
        if (sortBy === 'interviews_desc') return (b.interviewsCount || 0) - (a.interviewsCount || 0)
        return 0
      })
  }, [usersList, searchQuery, filterType, sortBy])

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredUsers.slice(startIndex, startIndex + pageSize)
  }, [filteredUsers, currentPage, pageSize])

  // ========================================================================
  // DEMO ACCESS MANAGEMENT HANDLERS (LIVE API CALLS)
  // ========================================================================
  const handleOpenDemoModal = (user) => {
    setDemoManageUser(user)
    setManageQuota(user.demoAccess?.allowedInterviews || 3)
    setManageNotes(user.demoAccess?.notes || '')
    setResetCompletedCount(false)
  }

  // Action: Grant Demo Access
  const handleGrantDemo = async () => {
    if (!demoManageUser) return
    try {
      setManageSubmitting(true)
      const token = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(getApiUrl('/api/admin/demo-accounts/grant'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: demoManageUser.id,
          allowedInterviews: Number(manageQuota) || 3,
          notes: manageNotes,
        }),
      })

      const data = await res.json()
      if (data.success) {
        showToast(`✓ Demo access granted (${manageQuota} attempts) to ${demoManageUser.name}`)
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('hiremind_demo_sync')
            bc.postMessage({ userId: demoManageUser.id, action: 'grant', timestamp: Date.now() })
            bc.close()
          } catch { /* non-critical; safe to ignore */ }
          localStorage.setItem('hiremind_demo_sync', JSON.stringify({ userId: demoManageUser.id, action: 'grant', timestamp: Date.now() }))
        }
        setDemoManageUser(null)
        await fetchUsers()
      } else {
        alert(data.message || 'Failed to grant demo access')
      }
    } catch (err) {
      alert(err.message || 'Network error')
    } finally {
      setManageSubmitting(false)
    }
  }

  // Action: Refresh Demo Quota
  const handleRefreshDemo = async () => {
    if (!demoManageUser) return
    try {
      setManageSubmitting(true)
      const token = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(getApiUrl('/api/admin/demo-accounts/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: demoManageUser.id,
          resetCount: resetCompletedCount,
          newAllowedInterviews: Number(manageQuota) || undefined,
        }),
      })

      const data = await res.json()
      if (data.success) {
        showToast(`✓ Demo quota updated for ${demoManageUser.name}`)
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('hiremind_demo_sync')
            bc.postMessage({ userId: demoManageUser.id, action: 'refresh', timestamp: Date.now() })
            bc.close()
          } catch { /* non-critical; safe to ignore */ }
          localStorage.setItem('hiremind_demo_sync', JSON.stringify({ userId: demoManageUser.id, action: 'refresh', timestamp: Date.now() }))
        }
        setDemoManageUser(null)
        await fetchUsers()
      } else {
        alert(data.message || 'Failed to refresh demo quota')
      }
    } catch (err) {
      alert(err.message || 'Network error')
    } finally {
      setManageSubmitting(false)
    }
  }

  // Action: Revoke Demo Access
  const handleRevokeDemo = async () => {
    if (!demoManageUser) return
    if (!window.confirm(`Are you sure you want to revoke demo access for ${demoManageUser.name}?`)) {
      return
    }

    try {
      setManageSubmitting(true)
      const token = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(getApiUrl('/api/admin/demo-accounts/cancel'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: demoManageUser.id,
          reason: 'Revoked by administrator from Users management page',
        }),
      })

      const data = await res.json()
      if (data.success) {
        showToast(`✓ Demo access revoked for ${demoManageUser.name}`)
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('hiremind_demo_sync')
            bc.postMessage({ userId: demoManageUser.id, action: 'cancel', timestamp: Date.now() })
            bc.close()
          } catch { /* non-critical; safe to ignore */ }
          localStorage.setItem('hiremind_demo_sync', JSON.stringify({ userId: demoManageUser.id, action: 'cancel', timestamp: Date.now() }))
        }
        setDemoManageUser(null)
        await fetchUsers()
      } else {
        alert(data.message || 'Failed to revoke demo access')
      }
    } catch (err) {
      alert(err.message || 'Network error')
    } finally {
      setManageSubmitting(false)
    }
  }

  return (
    <div>
      {/* ==================================================================
          HEADER & ACTIONS
          ================================================================== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
            Users Management
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', margin: '3px 0 0' }}>
            Live database of registered candidate members, permissions, and demo access privileges.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchUsers}
          disabled={loading}
          className="admin-btn admin-btn--secondary admin-btn--sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ClockIcon size={14} />
          {loading ? 'Refreshing...' : 'Refresh Users'}
        </button>
      </div>

      {/* ==================================================================
          4 SUMMARY CARDS (LIVE METRICS)
          ================================================================== */}
      <div className="users-summary-grid">
        {/* Total Users */}
        <div className="users-summary-card">
          <div className="users-summary-card__top">
            <span className="users-summary-card__label">Total Registered</span>
            <span className="users-summary-card__icon-wrap users-summary-card__icon-wrap--cyan">
              <UsersIcon size={18} />
            </span>
          </div>
          <div className="users-summary-card__value">
            {loading ? '...' : (stats.totalUsers || 0).toLocaleString()}
          </div>
          <div className="users-summary-card__bottom">
            <span className="users-summary-card__trend users-summary-card__trend--up">
              <TrendingUpIcon size={13} /> Live DB
            </span>
            <span className="users-summary-card__subtext">candidate profiles</span>
          </div>
        </div>

        {/* Active Users */}
        <div className="users-summary-card">
          <div className="users-summary-card__top">
            <span className="users-summary-card__label">Active Users</span>
            <span className="users-summary-card__icon-wrap users-summary-card__icon-wrap--emerald">
              <ActivityIcon size={18} />
            </span>
          </div>
          <div className="users-summary-card__value">
            {loading ? '...' : (stats.activeUsers || 0).toLocaleString()}
          </div>
          <div className="users-summary-card__bottom">
            <span className="users-summary-card__trend users-summary-card__trend--up">
              <CheckCircleIcon size={13} /> Verified
            </span>
            <span className="users-summary-card__subtext">engaged members</span>
          </div>
        </div>

        {/* Demo Users */}
        <div className="users-summary-card">
          <div className="users-summary-card__top">
            <span className="users-summary-card__label">Demo Pilot Accounts</span>
            <span className="users-summary-card__icon-wrap users-summary-card__icon-wrap--purple">
              <PilotAccessIcon size={18} />
            </span>
          </div>
          <div className="users-summary-card__value" style={{ color: 'var(--admin-accent-purple)' }}>
            {loading ? '...' : (stats.demoUsers || 0).toLocaleString()}
          </div>
          <div className="users-summary-card__bottom">
            <span className="users-summary-card__trend users-summary-card__trend--up">
              <SparklesIcon size={13} /> Active Quotas
            </span>
            <span className="users-summary-card__subtext">mock interview access</span>
          </div>
        </div>

        {/* Inactive Users */}
        <div className="users-summary-card">
          <div className="users-summary-card__top">
            <span className="users-summary-card__label">Standard Accounts</span>
            <span className="users-summary-card__icon-wrap users-summary-card__icon-wrap--amber">
              <XCircleIcon size={18} />
            </span>
          </div>
          <div className="users-summary-card__value" style={{ color: 'var(--admin-text-muted)' }}>
            {loading ? '...' : (stats.inactiveUsers || 0).toLocaleString()}
          </div>
          <div className="users-summary-card__bottom">
            <span className="users-summary-card__trend users-summary-card__trend--down">
              <ClockIcon size={13} /> Gated
            </span>
            <span className="users-summary-card__subtext">preview coming soon</span>
          </div>
        </div>
      </div>

      {/* Error alert if any */}
      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#fca5a5',
            fontSize: '13px',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }} aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            {error}
          </span>
          <button
            type="button"
            onClick={fetchUsers}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#38bdf8',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ==================================================================
          CONTROLS BAR (SEARCH, FILTER DROPDOWN, SORT DROPDOWN)
          ================================================================== */}
      <div className="admin-card">
        <div className="users-controls-bar">
          <div className="users-controls-bar__left">
            {/* Search Input */}
            <div className="users-search-box">
              <span className="users-search-box__icon">
                <SearchIcon size={14} />
              </span>
              <input
                type="text"
                className="users-search-input"
                placeholder="Search candidates by name, email, field..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>

            {/* Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)', fontWeight: 500 }}>
                Filter:
              </span>
              <select
                className="admin-select"
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value)
                  setCurrentPage(1)
                }}
              >
                <option value="All Users">All Users</option>
                <option value="Demo">Demo Access Only</option>
                <option value="Regular">Regular Only</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Inactive Only</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)', fontWeight: 500 }}>
                Sort:
              </span>
              <select
                className="admin-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="joined_desc">Joined (Newest)</option>
                <option value="joined_asc">Joined (Oldest)</option>
                <option value="name_asc">Name (A-Z)</option>
                <option value="interviews_desc">Interviews (Highest)</option>
              </select>
            </div>
          </div>

          <div className="users-controls-bar__right">
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
              Total Found: <strong style={{ color: 'var(--admin-text-primary)' }}>{filteredUsers.length}</strong>
            </span>
          </div>
        </div>

        {/* ================================================================
            USERS TABLE
            ================================================================ */}
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Candidate User</th>
                <th>Email Address</th>
                <th>Access Type</th>
                <th>Status</th>
                <th>Interviews</th>
                <th>Joined Date</th>
                <th>Last Active</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--admin-text-muted)' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        border: '3px solid rgba(56, 189, 248, 0.2)',
                        borderTopColor: '#38bdf8',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        margin: '0 auto 12px',
                      }}
                    />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    Loading candidate accounts from database...
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--admin-text-muted)' }}>
                    {searchQuery
                      ? `No users matching "${searchQuery}".`
                      : 'No users found matching selected filter criteria.'}
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => (
                  <tr key={u.id}>
                    {/* User (Avatar, Full Name) */}
                    <td>
                      <div className="user-cell-profile">
                        <div
                          className={`user-cell-avatar ${
                            u.accountType === 'Demo' ? 'user-cell-avatar--demo' : ''
                          }`}
                        >
                          {u.avatar || 'U'}
                        </div>
                        <div>
                          <span className="user-cell-name">{u.name}</span>
                          {u.field && (
                            <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
                              {u.field} • {u.careerStage || 'Candidate'}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td>
                      <span className="user-cell-email">{u.email}</span>
                    </td>

                    {/* Account Type (Badges: Regular, Demo) */}
                    <td>
                      <span
                        className={`admin-badge ${
                          u.accountType === 'Demo'
                            ? 'badge-account-demo'
                            : 'badge-account-regular'
                        }`}
                      >
                        {u.accountType === 'Demo'
                          ? `★ Demo (${u.demoAccess?.remaining || 0} left)`
                          : 'Regular'}
                      </span>
                    </td>

                    {/* Status (Badges: Active, Inactive) */}
                    <td>
                      <span
                        className={`admin-badge ${
                          u.status === 'Active'
                            ? 'badge-status-active'
                            : 'badge-status-inactive'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>

                    {/* Interviews */}
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                        {u.interviewsCount || 0} sessions
                      </span>
                      {u.completedInterviews > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--admin-accent-emerald)' }}>
                          {u.completedInterviews} completed
                        </div>
                      )}
                    </td>

                    {/* Joined Date */}
                    <td style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                      {u.joinedDate}
                    </td>

                    {/* Last Active */}
                    <td style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                      {u.lastActive}
                    </td>

                    {/* Actions Trigger */}
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="user-action-trigger-btn"
                        onClick={() => setActionPopupUser(u)}
                        title="Actions & Options"
                        aria-label="Actions menu"
                      >
                        •••
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ================================================================
            PAGINATION UI
            ================================================================ */}
        <div className="admin-pagination">
          <div className="admin-pagination__info">
            Showing{' '}
            <strong>
              {filteredUsers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </strong>{' '}
            to{' '}
            <strong>
              {Math.min(currentPage * pageSize, filteredUsers.length)}
            </strong>{' '}
            of <strong>{filteredUsers.length}</strong> candidates
          </div>

          <div className="admin-pagination__buttons">
            <button
              type="button"
              className="admin-pagination__btn"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
              <button
                key={pg}
                type="button"
                className={`admin-pagination__btn ${
                  currentPage === pg ? 'admin-pagination__btn--active' : ''
                }`}
                onClick={() => setCurrentPage(pg)}
              >
                {pg}
              </button>
            ))}

            <button
              type="button"
              className="admin-pagination__btn"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================================
          CANDIDATE ACTIONS SMALL POPUP MODAL
          ================================================================== */}
      {actionPopupUser && (
        <div
          className="admin-modal-overlay"
          onClick={() => setActionPopupUser(null)}
        >
          <div
            className="admin-modal"
            style={{ maxWidth: '420px', borderRadius: '18px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  className={`user-cell-avatar ${
                    actionPopupUser.accountType === 'Demo' ? 'user-cell-avatar--demo' : ''
                  }`}
                  style={{ width: '38px', height: '38px', fontSize: '14px', borderRadius: '50%' }}
                >
                  {actionPopupUser.avatar || 'U'}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#f8fafc', fontWeight: 600 }}>
                    {actionPopupUser.name}
                  </h4>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {actionPopupUser.email}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="admin-modal__close"
                onClick={() => setActionPopupUser(null)}
                title="Close"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div className="admin-modal__body" style={{ padding: '16px', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Account Classification</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span
                    className={`admin-badge ${
                      actionPopupUser.accountType === 'Demo'
                        ? 'badge-account-demo'
                        : 'badge-account-regular'
                    }`}
                  >
                    {actionPopupUser.accountType === 'Demo' ? '★ Demo' : 'Regular'}
                  </span>
                  <span
                    className={`admin-badge ${
                      actionPopupUser.status === 'Active'
                        ? 'badge-status-active'
                        : 'badge-status-inactive'
                    }`}
                  >
                    {actionPopupUser.status}
                  </span>
                </div>
              </div>

              {/* Action 1: View Profile */}
              <button
                type="button"
                className="action-popup-item"
                onClick={() => {
                  const target = actionPopupUser
                  setActionPopupUser(null)
                  setSelectedUserId(target?.id ?? null)
                }}
              >
                <div className="action-popup-item__icon action-popup-item__icon--cyan">
                  <UsersIcon size={18} />
                </div>
                <div className="action-popup-item__text">
                  <div className="action-popup-item__title">View Profile Details</div>
                  <div className="action-popup-item__desc">Inspect candidate career info, skills & telemetry</div>
                </div>
                <span className="action-popup-item__arrow">&rarr;</span>
              </button>

              {/* Action 2: Manage Demo Access */}
              <button
                type="button"
                className="action-popup-item"
                onClick={() => {
                  const target = actionPopupUser
                  setActionPopupUser(null)
                  handleOpenDemoModal(target)
                }}
              >
                <div className="action-popup-item__icon action-popup-item__icon--emerald">
                  <SparklesIcon size={18} />
                </div>
                <div className="action-popup-item__text">
                  <div className="action-popup-item__title">Manage Demo Access</div>
                  <div className="action-popup-item__desc">Configure interview attempts or revoke quota</div>
                </div>
                <span className="action-popup-item__arrow">&rarr;</span>
              </button>

              {/* Action 3: Demo Pilot Center */}
              <button
                type="button"
                className="action-popup-item"
                onClick={() => {
                  setActionPopupUser(null)
                  navigate('/admin/pilot-access')
                }}
              >
                <div className="action-popup-item__icon action-popup-item__icon--purple">
                  <PilotAccessIcon size={18} />
                </div>
                <div className="action-popup-item__text">
                  <div className="action-popup-item__title">Demo Pilot Center</div>
                  <div className="action-popup-item__desc">Open dedicated pilot accounts administration</div>
                </div>
                <span className="action-popup-item__arrow">&rarr;</span>
              </button>
            </div>

            <div className="admin-modal__footer" style={{ padding: '10px 16px', background: 'rgba(7, 12, 24, 0.4)' }}>
              <button
                type="button"
                className="admin-btn admin-btn--secondary admin-btn--sm"
                onClick={() => setActionPopupUser(null)}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================
          USER DETAILS MODAL (VIEW PROFILE)
          ================================================================== */}
      {selectedUser && (
        <div
          className="user-details-modal-backdrop"
          onClick={() => setSelectedUserId(null)}
          style={{ zIndex: 99999 }}
        >
          <div
            className="user-details-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="user-details-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-accent-cyan)' }}>
                  Candidate Profile Details
                </span>
                <span
                  className={`admin-badge ${
                    selectedUser.accountType === 'Demo'
                      ? 'badge-account-demo'
                      : 'badge-account-regular'
                  }`}
                >
                  {selectedUser.accountType}
                </span>
                <span
                  className={`admin-badge ${
                    selectedUser.status === 'Active'
                      ? 'badge-status-active'
                      : 'badge-status-inactive'
                  }`}
                >
                  {selectedUser.status}
                </span>
              </div>

              <button
                type="button"
                className="admin-sidebar__collapse-btn"
                onClick={() => setSelectedUserId(null)}
                aria-label="Close details"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="user-details-modal-body">
              {/* Profile Hero */}
              <div className="user-details-profile-hero">
                <div
                  className={`user-details-large-avatar ${
                    selectedUser.accountType === 'Demo' ? 'user-cell-avatar--demo' : ''
                  }`}
                >
                  {selectedUser.avatar || 'U'}
                </div>
                <div>
                  <h3 style={{ fontSize: '19px', fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
                    {selectedUser.name}
                  </h3>
                  <div style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                    {selectedUser.email}
                  </div>
                  {selectedUser.field && (
                    <div style={{ fontSize: '12px', color: '#38bdf8', marginTop: '2px' }}>
                      {selectedUser.field} • {selectedUser.careerStage}
                    </div>
                  )}
                </div>
              </div>

              {/* Grid of Key Metadata */}
              <div className="user-details-grid-meta">
                <div className="user-details-meta-item">
                  <span className="user-details-meta-item__label">Account Type</span>
                  <span className="user-details-meta-item__val">{selectedUser.accountType} Account</span>
                </div>

                <div className="user-details-meta-item">
                  <span className="user-details-meta-item__label">Activity Status</span>
                  <span className="user-details-meta-item__val">{selectedUser.status}</span>
                </div>

                <div className="user-details-meta-item">
                  <span className="user-details-meta-item__label">Joined Date</span>
                  <span className="user-details-meta-item__val">{selectedUser.joinedDate}</span>
                </div>

                <div className="user-details-meta-item">
                  <span className="user-details-meta-item__label">Last Active</span>
                  <span className="user-details-meta-item__val">{selectedUser.lastActive}</span>
                </div>

                <div className="user-details-meta-item">
                  <span className="user-details-meta-item__label">Total Interviews</span>
                  <span className="user-details-meta-item__val">{selectedUser.interviewsCount || 0}</span>
                </div>

                <div className="user-details-meta-item">
                  <span className="user-details-meta-item__label">Completed Sessions</span>
                  <span className="user-details-meta-item__val" style={{ color: 'var(--admin-accent-emerald)' }}>
                    {selectedUser.completedInterviews || 0}
                  </span>
                </div>
              </div>

              {/* Skills Tags */}
              {selectedUser.skills && selectedUser.skills.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Candidate Skills
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedUser.skills.map((s, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '11.5px',
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          color: '#e2e8f0',
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Demo Status Banner */}
              <div
                style={{
                  background: selectedUser.accountType === 'Demo' ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                  border: selectedUser.accountType === 'Demo' ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Access Tier & Demo Status
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-accent-cyan)', marginTop: '2px' }}>
                    {selectedUser.demoStatus}
                  </div>
                  {selectedUser.demoAccess?.notes && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      Note: {selectedUser.demoAccess.notes}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="admin-btn admin-btn--secondary admin-btn--sm"
                  onClick={() => {
                    handleOpenDemoModal(selectedUser)
                  }}
                >
                  Manage Access
                </button>
              </div>

              {/* Recent Interviews Section */}
              <div className="user-details-interviews-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
                    Recent Candidate Interviews
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
                    Live Telemetry
                  </span>
                </div>

                {!selectedUser.recentInterviews || selectedUser.recentInterviews.length === 0 ? (
                  <div
                    style={{
                      padding: '18px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '8px',
                      border: '1px dashed rgba(255, 255, 255, 0.08)',
                      textAlign: 'center',
                      color: '#94a3b8',
                      fontSize: '12.5px',
                    }}
                  >
                    No mock interview sessions recorded for this candidate yet.
                  </div>
                ) : (
                  selectedUser.recentInterviews.map((intv, idx) => (
                    <div key={idx} className="user-details-interview-item">
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--admin-text-primary)' }}>
                          {intv.role}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
                          @{intv.company} • {intv.date}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {intv.score > 0 && (
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: '13px',
                              color:
                                intv.score >= 80
                                  ? 'var(--admin-accent-emerald)'
                                  : intv.score >= 70
                                  ? 'var(--admin-accent-cyan)'
                                  : 'var(--admin-accent-rose)',
                            }}
                          >
                            {intv.score}% Score
                          </span>
                        )}
                        <span
                          className={`admin-badge ${
                            intv.status === 'Completed'
                              ? 'admin-badge--emerald'
                              : 'admin-badge--amber'
                          }`}
                        >
                          {intv.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="user-details-modal-footer">
              <span style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)' }}>
                User ID: <code style={{ color: 'var(--admin-text-primary)' }}>{selectedUser.id}</code>
              </span>
              <button
                type="button"
                className="admin-btn admin-btn--primary admin-btn--sm"
                onClick={() => setSelectedUserId(null)}
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================
          MANAGE DEMO ACCESS POPUP MODAL (LIVE ACTIONS)
          ================================================================== */}
      {demoManageUser && (
        <div
          className="user-details-modal-backdrop"
          onClick={() => setDemoManageUser(null)}
          style={{ zIndex: 99999 }}
        >
          <div
            className="user-details-modal-card"
            style={{ maxWidth: '480px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="user-details-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#38bdf8' }}><SparklesIcon size={18} /></span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                  Manage Demo Interview Access
                </span>
              </div>
              <button
                type="button"
                className="admin-sidebar__collapse-btn"
                onClick={() => setDemoManageUser(null)}
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div className="user-details-modal-body">
              <div>
                <strong style={{ color: 'var(--admin-text-primary)' }}>{demoManageUser.name}</strong>{' '}
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>({demoManageUser.email})</span>
              </div>

              {/* Status Banner */}
              <div
                style={{
                  background: demoManageUser.accountType === 'Demo' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.08)',
                  border: demoManageUser.accountType === 'Demo' ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '12.5px',
                  color: demoManageUser.accountType === 'Demo' ? '#34d399' : '#fca5a5',
                  lineHeight: 1.45,
                }}
              >
                {demoManageUser.accountType === 'Demo' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', minWidth: '18px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }} aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <span>
                      <strong>Demo Access is Currently Active:</strong> {demoManageUser.demoAccess?.completedInterviews || 0} completed / {demoManageUser.demoAccess?.allowedInterviews || 0} allowed passes.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', minWidth: '18px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }} aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    <span>
                      <strong>Standard Account (Gated):</strong> Candidate currently sees the preview &quot;Feature Coming Soon&quot; page.
                    </span>
                  </div>
                )}
              </div>

              {/* Quota Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                  {demoManageUser.accountType === 'Demo' ? 'Adjust / Set Allowed Attempts:' : 'Allowed Mock Interview Attempts (Quota):'}
                </label>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  {[1, 2, 3, 5, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setManageQuota(num)}
                      style={{
                        flex: '1 0 55px',
                        padding: '7px 0',
                        borderRadius: '6px',
                        background: manageQuota === num ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.6)',
                        border: manageQuota === num ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: manageQuota === num ? '#38bdf8' : '#cbd5e1',
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {num} {num === 1 ? 'pass' : 'passes'}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Or custom count:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={manageQuota}
                    onChange={(e) => setManageQuota(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    style={{
                      width: '80px',
                      background: 'rgba(11, 17, 32, 0.85)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      padding: '5px 10px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                </div>
              </div>

              {/* Reset Count checkbox if already Demo */}
              {demoManageUser.accountType === 'Demo' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#e2e8f0', background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '6px' }}>
                  <input
                    type="checkbox"
                    checked={resetCompletedCount}
                    onChange={(e) => setResetCompletedCount(e.target.checked)}
                    style={{ width: '15px', height: '15px', accentColor: '#2563eb' }}
                  />
                  <span>Reset completed count back to 0 (grant fresh attempts)</span>
                </label>
              )}

              {/* Admin note */}
              {demoManageUser.accountType !== 'Demo' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                    Admin Note (Optional):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. VIP Candidate Trial, Campus Pilot..."
                    value={manageNotes}
                    onChange={(e) => setManageNotes(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(11, 17, 32, 0.85)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      padding: '7px 10px',
                      color: '#f8fafc',
                      fontSize: '12.5px',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="user-details-modal-footer">
              <button
                type="button"
                className="admin-btn admin-btn--secondary admin-btn--sm"
                onClick={() => setDemoManageUser(null)}
                disabled={manageSubmitting}
              >
                Cancel
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                {demoManageUser.accountType === 'Demo' ? (
                  <>
                    <button
                      type="button"
                      disabled={manageSubmitting}
                      onClick={handleRevokeDemo}
                      style={{
                        background: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        padding: '7px 14px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {manageSubmitting ? 'Revoking...' : 'Revoke Access'}
                    </button>
                    <button
                      type="button"
                      disabled={manageSubmitting}
                      onClick={handleRefreshDemo}
                      className="admin-btn admin-btn--primary admin-btn--sm"
                    >
                      {manageSubmitting ? 'Updating...' : 'Update Quota'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={manageSubmitting}
                    onClick={handleGrantDemo}
                    className="admin-btn admin-btn--primary admin-btn--sm"
                  >
                    {manageSubmitting ? 'Granting...' : `Grant Demo Pass (${manageQuota})`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Feedback Toast */}
      {demoFeedbackToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: '#0f172a',
            border: '1px solid rgba(56, 189, 248, 0.5)',
            color: '#f8fafc',
            padding: '12px 18px',
            borderRadius: '10px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 500,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <span style={{ color: 'var(--admin-accent-emerald)' }}>✓</span>
          {demoFeedbackToast}
        </div>
      )}
    </div>
  )
}
