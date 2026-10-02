import React, { useState, useEffect, useMemo } from 'react'
import {
  PilotAccessIcon,
  UsersIcon,
  InterviewsIcon,
  SearchIcon,
  CloseIcon,
  SparklesIcon,
  CheckCircleIcon,
  ClockIcon,
} from '../AdminIcons'
import { getApiUrl } from '../../config/api'
import './AdminPage.css'
import './AdminPilotAccess.css'

export default function AdminPilotAccess() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Dataset states from live backend
  const [stats, setStats] = useState({
    activeDemoCount: 0,
    quotaReachedCount: 0,
    cancelledCount: 0,
    totalDemoAccounts: 0,
    totalAllowedQuota: 0,
    totalCompletedInterviews: 0,
    totalCandidates: 0,
  })
  const [demoAccounts, setDemoAccounts] = useState([])
  const [eligibleCandidates, setEligibleCandidates] = useState([])

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  // Modals state
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false)
  const [grantSearchQuery, setGrantSearchQuery] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [grantQuota, setGrantQuota] = useState(3)
  const [grantNotes, setGrantNotes] = useState('')
  const [grantSubmitting, setGrantSubmitting] = useState(false)

  // Refresh Modal
  const [refreshTargetUser, setRefreshTargetUser] = useState(null)
  const [resetCountOption, setResetCountOption] = useState(true)
  const [newQuotaValue, setNewQuotaValue] = useState('')
  const [refreshSubmitting, setRefreshSubmitting] = useState(false)

  // Revoke/Cancel Modal
  const [cancelTargetUser, setCancelTargetUser] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  // Toast feedback
  const [toastMessage, setToastMessage] = useState('')

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4000)
  }

  // Fetch demo accounts data from backend
  const fetchDemoData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(getApiUrl('/api/admin/demo-accounts'), {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        throw new Error(`Failed to load demo accounts (${res.status})`)
      }

      const data = await res.json()
      if (data.success) {
        setStats(data.stats || {})
        setDemoAccounts(data.demoAccounts || [])
        setEligibleCandidates(data.eligibleCandidates || [])
      }
    } catch (err) {
      console.error('[AdminPilotAccess] Error loading data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDemoData()
  }, [])

  // Filtered Demo Accounts list
  const filteredDemoAccounts = useMemo(() => {
    return demoAccounts.filter((acc) => {
      const matchesSearch =
        acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (acc.notes && acc.notes.toLowerCase().includes(searchQuery.toLowerCase()))

      if (!matchesSearch) return false

      if (statusFilter === 'All') return true
      if (statusFilter === 'Active') return acc.demoStatus === 'Active'
      if (statusFilter === 'Quota Reached') return acc.demoStatus === 'Quota Reached'
      if (statusFilter === 'Revoked') return acc.demoStatus === 'Revoked'
      return true
    })
  }, [demoAccounts, searchQuery, statusFilter])

  // Filter candidates for the grant modal dropdown
  const filteredCandidatesForGrant = useMemo(() => {
    if (!grantSearchQuery.trim()) return eligibleCandidates.slice(0, 10)
    const q = grantSearchQuery.toLowerCase()
    return eligibleCandidates.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    )
  }, [eligibleCandidates, grantSearchQuery])

  // Action: Grant Demo Access
  const handleGrantSubmit = async (e) => {
    e.preventDefault()
    if (!selectedCandidate) {
      alert('Please select a candidate member')
      return
    }

    try {
      setGrantSubmitting(true)
      const token = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(getApiUrl('/api/admin/demo-accounts/grant'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: selectedCandidate._id,
          allowedInterviews: Number(grantQuota) || 3,
          notes: grantNotes,
        }),
      })

      const data = await res.json()
      if (data.success) {
        showToast(`✓ Demo access granted with ${grantQuota} interview(s) to ${selectedCandidate.name}`)
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('hiremind_demo_sync')
            bc.postMessage({ userId: selectedCandidate._id, action: 'grant', timestamp: Date.now() })
            bc.close()
          } catch (_) {}
          localStorage.setItem('hiremind_demo_sync', JSON.stringify({ userId: selectedCandidate._id, action: 'grant', timestamp: Date.now() }))
        }
        setIsGrantModalOpen(false)
        setSelectedCandidate(null)
        setGrantNotes('')
        setGrantSearchQuery('')
        await fetchDemoData()
      } else {
        alert(data.message || 'Failed to grant demo access')
      }
    } catch (err) {
      alert(err.message || 'Network error')
    } finally {
      setGrantSubmitting(false)
    }
  }

  // Action: Refresh Demo Quota / Reset Completed Count
  const handleRefreshSubmit = async (e) => {
    e.preventDefault()
    if (!refreshTargetUser) return

    try {
      setRefreshSubmitting(true)
      const token = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(getApiUrl('/api/admin/demo-accounts/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: refreshTargetUser._id,
          resetCount: resetCountOption,
          newAllowedInterviews: newQuotaValue ? Number(newQuotaValue) : undefined,
        }),
      })

      const data = await res.json()
      if (data.success) {
        showToast(`✓ Quota refreshed for ${refreshTargetUser.name}!`)
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('hiremind_demo_sync')
            bc.postMessage({ userId: refreshTargetUser._id, action: 'refresh', timestamp: Date.now() })
            bc.close()
          } catch (_) {}
          localStorage.setItem('hiremind_demo_sync', JSON.stringify({ userId: refreshTargetUser._id, action: 'refresh', timestamp: Date.now() }))
        }
        setRefreshTargetUser(null)
        setNewQuotaValue('')
        await fetchDemoData()
      } else {
        alert(data.message || 'Failed to refresh demo quota')
      }
    } catch (err) {
      alert(err.message || 'Network error')
    } finally {
      setRefreshSubmitting(false)
    }
  }

  // Action: Cancel / Revoke Demo Access
  const handleCancelSubmit = async (e) => {
    e.preventDefault()
    if (!cancelTargetUser) return

    try {
      setCancelSubmitting(true)
      const token = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(getApiUrl('/api/admin/demo-accounts/cancel'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: cancelTargetUser._id,
          reason: cancelReason || 'Revoked by administrator',
        }),
      })

      const data = await res.json()
      if (data.success) {
        showToast(`✓ Demo access cancelled for ${cancelTargetUser.name}. User is now blocked.`)
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('hiremind_demo_sync')
            bc.postMessage({ userId: cancelTargetUser._id, action: 'cancel', timestamp: Date.now() })
            bc.close()
          } catch (_) {}
          localStorage.setItem('hiremind_demo_sync', JSON.stringify({ userId: cancelTargetUser._id, action: 'cancel', timestamp: Date.now() }))
        }
        setCancelTargetUser(null)
        setCancelReason('')
        await fetchDemoData()
      } else {
        alert(data.message || 'Failed to cancel demo access')
      }
    } catch (err) {
      alert(err.message || 'Network error')
    } finally {
      setCancelSubmitting(false)
    }
  }

  return (
    <div className="admin-page">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#ffffff',
            padding: '12px 22px',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '14px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
            zIndex: 9999,
            animation: 'fadeIn 0.3s ease',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Top Header & Grant Button */}
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="admin-page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>Demo Accounts & Interview Quota</span>
            <span style={{ fontSize: '12px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
              High-Security Access Control
            </span>
          </h1>
          <p className="admin-page-subtitle">
            Configure which candidate members can access the private AI Mock Interview preview, manage their allowed attempts, and monitor completed sessions in real time.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedCandidate(null)
            setGrantQuota(3)
            setGrantNotes('')
            setGrantSearchQuery('')
            setIsGrantModalOpen(true)
          }}
          className="admin-btn-primary"
          style={{
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff',
            border: 'none',
            padding: '11px 22px',
            borderRadius: '9px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
          }}
        >
          <SparklesIcon size={16} />
          <span>+ Provision Demo Account</span>
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="pilot-summary-grid">
        <div className="pilot-stat-box">
          <div className="pilot-stat-box__top">
            <span className="pilot-stat-box__label">Active Demo Accounts</span>
            <div className="pilot-stat-box__icon-wrap pilot-stat-box__icon-wrap--emerald">
              <PilotAccessIcon size={16} />
            </div>
          </div>
          <div className="pilot-stat-box__val" style={{ color: '#10b981' }}>
            {stats.activeDemoCount}
          </div>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Members authorized to take interviews</span>
        </div>

        <div className="pilot-stat-box">
          <div className="pilot-stat-box__top">
            <span className="pilot-stat-box__label">Completed Interviews</span>
            <div className="pilot-stat-box__icon-wrap pilot-stat-box__icon-wrap--cyan">
              <InterviewsIcon size={16} />
            </div>
          </div>
          <div className="pilot-stat-box__val" style={{ color: '#38bdf8' }}>
            {stats.totalCompletedInterviews}
          </div>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Finished by demo participants</span>
        </div>

        <div className="pilot-stat-box">
          <div className="pilot-stat-box__top">
            <span className="pilot-stat-box__label">Total Allocated Quota</span>
            <div className="pilot-stat-box__icon-wrap pilot-stat-box__icon-wrap--purple">
              <SparklesIcon size={16} />
            </div>
          </div>
          <div className="pilot-stat-box__val" style={{ color: '#a855f7' }}>
            {stats.totalAllowedQuota}
          </div>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Total interview passes granted</span>
        </div>

        <div className="pilot-stat-box">
          <div className="pilot-stat-box__top">
            <span className="pilot-stat-box__label">Quota Reached / Revoked</span>
            <div className="pilot-stat-box__icon-wrap pilot-stat-box__icon-wrap--amber">
              <ClockIcon size={16} />
            </div>
          </div>
          <div className="pilot-stat-box__val" style={{ color: '#f59e0b' }}>
            {stats.quotaReachedCount + stats.cancelledCount}
          </div>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            {stats.quotaReachedCount} finished all passes, {stats.cancelledCount} revoked
          </span>
        </div>
      </div>

      {/* Security Rule Information Banner */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '14px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '24px' }}>🛡️</div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
              Enforced Private Preview Policy
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
              Newly registered candidates and members without an active demo pass are automatically blocked with a <strong>"Feature Coming Soon"</strong> preview screen and 403 API protection.
            </div>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          Total registered candidate pool: <strong>{stats.totalCandidates}</strong> members
        </div>
      </div>

      {/* Main Table Container */}
      <div className="admin-table-container">
        {/* Table Filters & Search */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--admin-border-subtle)',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['All', 'Active', 'Quota Reached', 'Revoked'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                style={{
                  background: statusFilter === tab ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                  border: statusFilter === tab ? '1px solid #38bdf8' : '1px solid transparent',
                  color: statusFilter === tab ? '#38bdf8' : 'var(--admin-text-secondary)',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '280px' }}>
            <input
              type="text"
              placeholder="Search candidate or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--admin-bg-input, #0b1120)',
                border: '1px solid var(--admin-border-subtle, rgba(255,255,255,0.1))',
                borderRadius: '8px',
                padding: '8px 12px 8px 34px',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <span style={{ position: 'absolute', left: '10px', top: '9px', color: '#64748b' }}>
              <SearchIcon size={15} />
            </span>
          </div>
        </div>

        {/* Live Demo Users Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Candidate / Member</th>
                <th>Status</th>
                <th>Interview Attempts & Progress</th>
                <th>Remaining</th>
                <th>Configured Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    Loading demo accounts...
                  </td>
                </tr>
              ) : filteredDemoAccounts.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    {searchQuery ? 'No demo accounts match your search filter.' : 'No demo accounts configured yet. Click "+ Provision Demo Account" above to authorize a candidate.'}
                  </td>
                </tr>
              ) : (
                filteredDemoAccounts.map((account) => {
                  const percent =
                    account.allowedInterviews > 0
                      ? Math.min(100, Math.round((account.completedInterviews / account.allowedInterviews) * 100))
                      : 0

                  return (
                    <tr key={account._id}>
                      {/* Candidate info */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #1e293b, #334155)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              color: '#60a5fa',
                              fontSize: '14px',
                            }}
                          >
                            {account.name.charAt(0) || 'C'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '14px' }}>
                              {account.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{account.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        {account.demoStatus === 'Active' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                            Active Demo
                          </span>
                        ) : account.demoStatus === 'Quota Reached' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
                            Quota Reached
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', border: '1px solid rgba(100, 116, 139, 0.3)', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                            Revoked
                          </span>
                        )}
                      </td>

                      {/* Progress */}
                      <td>
                        <div style={{ minWidth: '180px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
                            <span style={{ fontWeight: 600, color: '#f1f5f9' }}>
                              {account.completedInterviews} of {account.allowedInterviews} Completed
                            </span>
                            <span style={{ color: '#94a3b8' }}>{percent}%</span>
                          </div>
                          <div style={{ width: '100%', height: '7px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${percent}%`,
                                height: '100%',
                                background: percent >= 100 ? '#f59e0b' : 'linear-gradient(90deg, #3b82f6, #10b981)',
                                borderRadius: '4px',
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Remaining Passes */}
                      <td>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            color: account.remainingInterviews > 0 ? '#38bdf8' : '#64748b',
                          }}
                        >
                          {account.remainingInterviews} left
                        </span>
                      </td>

                      {/* Date Granted */}
                      <td>
                        <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                          {account.grantedAt ? new Date(account.grantedAt).toLocaleDateString() : 'Initial'}
                        </div>
                        {account.lastRefreshedAt && (
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Refreshed: {new Date(account.lastRefreshedAt).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            title="Refresh Interview Count or Quota"
                            onClick={() => {
                              setRefreshTargetUser(account)
                              setResetCountOption(true)
                              setNewQuotaValue(String(account.allowedInterviews))
                            }}
                            style={{
                              background: 'rgba(56, 189, 248, 0.1)',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                              color: '#38bdf8',
                              padding: '5px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            ↻ Refresh Count
                          </button>

                          {account.enabled ? (
                            <button
                              title="Cancel / Revoke Demo Access"
                              onClick={() => {
                                setCancelTargetUser(account)
                                setCancelReason('')
                              }}
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                color: '#f87171',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Cancel Access
                            </button>
                          ) : (
                            <button
                              title="Re-enable Demo Access"
                              onClick={() => {
                                setRefreshTargetUser(account)
                                setResetCountOption(true)
                                setNewQuotaValue(String(account.allowedInterviews || 3))
                              }}
                              style={{
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                color: '#34d399',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Re-enable
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: PROVISION / GRANT DEMO ACCOUNT POPUP */}
      {/* ========================================================================= */}
      {isGrantModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setIsGrantModalOpen(false)}>
          <div className="admin-modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SparklesIcon size={18} />
                </div>
                <div>
                  <h3 className="admin-modal__title">Provision Demo Account Access</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Select a candidate member and configure their allowed mock interview attempts.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGrantModalOpen(false)}
                className="admin-modal__close"
                title="Close popup"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleGrantSubmit}>
              <div className="admin-modal__body">
                {/* 1. Candidate Selection */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '8px' }}>
                    1. Select Candidate Member *
                  </label>
                  <input
                    type="text"
                    placeholder="Search candidate by name or email..."
                    value={grantSearchQuery}
                    onChange={(e) => setGrantSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(11, 17, 32, 0.85)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      color: '#f8fafc',
                      fontSize: '13px',
                      marginBottom: '10px',
                      outline: 'none',
                    }}
                  />

                  {/* Candidate selector list */}
                  <div
                    style={{
                      maxHeight: '190px',
                      overflowY: 'auto',
                      background: 'rgba(11, 17, 32, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '10px',
                      padding: '6px',
                    }}
                  >
                    {filteredCandidatesForGrant.length === 0 ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                        {grantSearchQuery
                          ? `No candidate accounts found matching "${grantSearchQuery}".`
                          : 'No candidate members found in system.'}
                      </div>
                    ) : (
                      filteredCandidatesForGrant.map((c) => {
                        const isSelected = selectedCandidate?._id === c._id
                        return (
                          <div
                            key={c._id}
                            onClick={() => setSelectedCandidate(c)}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '8px',
                              background: isSelected ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
                              border: isSelected ? '1px solid #38bdf8' : '1px solid transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              marginBottom: '4px',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #1e293b, #334155)',
                                  color: '#38bdf8',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '13px',
                                  fontWeight: 700,
                                }}
                              >
                                {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                              </div>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                                  {c.name}
                                </div>
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{c.email}</div>
                              </div>
                            </div>
                            <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, background: c.hasDemoAccess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)', color: c.hasDemoAccess ? '#34d399' : '#94a3b8' }}>
                              {c.hasDemoAccess ? `Active (${c.completedInterviews}/${c.allowedInterviews})` : 'Standard Account'}
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* 2. Configure Allowed Attempts */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '8px' }}>
                    2. Configured Interview Attempts (Quota) *
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    {[1, 2, 3, 5, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setGrantQuota(num)}
                        style={{
                          flex: '1 0 70px',
                          padding: '9px 0',
                          borderRadius: '8px',
                          background: grantQuota === num ? 'rgba(56, 189, 248, 0.22)' : 'rgba(30, 41, 59, 0.6)',
                          border: grantQuota === num ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                          color: grantQuota === num ? '#38bdf8' : '#cbd5e1',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: grantQuota === num ? '0 0 14px rgba(56, 189, 248, 0.3)' : 'none',
                        }}
                      >
                        {num} {num === 1 ? 'pass' : 'passes'}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>Or custom count:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={grantQuota}
                      onChange={(e) => setGrantQuota(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      style={{
                        width: '90px',
                        background: 'rgba(11, 17, 32, 0.85)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '8px',
                        padding: '7px 12px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* 3. Optional Admin Notes */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '8px' }}>
                    3. Admin Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. VIP Candidate Pilot, Campus Evaluation..."
                    value={grantNotes}
                    onChange={(e) => setGrantNotes(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(11, 17, 32, 0.85)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      color: '#f8fafc',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div className="admin-modal__footer">
                <button
                  type="button"
                  onClick={() => setIsGrantModalOpen(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#cbd5e1',
                    padding: '9px 18px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedCandidate || grantSubmitting}
                  style={{
                    background: selectedCandidate ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#334155',
                    color: '#ffffff',
                    border: 'none',
                    padding: '9px 24px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: selectedCandidate ? 'pointer' : 'not-allowed',
                    boxShadow: selectedCandidate ? '0 4px 14px rgba(37, 99, 235, 0.4)' : 'none',
                  }}
                >
                  {grantSubmitting ? 'Granting...' : `Grant Demo Pass (${grantQuota} attempts)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: REFRESH DEMO QUOTA POPUP */}
      {/* ========================================================================= */}
      {refreshTargetUser && (
        <div className="admin-modal-overlay" onClick={() => setRefreshTargetUser(null)}>
          <div className="admin-modal" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal__header">
              <h3 className="admin-modal__title">Refresh Interview Quota</h3>
              <button
                type="button"
                onClick={() => setRefreshTargetUser(null)}
                className="admin-modal__close"
                title="Close popup"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleRefreshSubmit}>
              <div className="admin-modal__body">
                <div style={{ background: 'rgba(11, 17, 32, 0.85)', padding: '14px 18px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                    {refreshTargetUser.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>{refreshTargetUser.email}</div>
                  <div style={{ marginTop: '10px', fontSize: '13px', color: '#38bdf8' }}>
                    Current usage: <strong>{refreshTargetUser.completedInterviews} completed</strong> / {refreshTargetUser.allowedInterviews} total allowed
                  </div>
                </div>

                {/* Reset Count Checkbox */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#e2e8f0', background: 'rgba(56, 189, 248, 0.06)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
                  <input
                    type="checkbox"
                    checked={resetCountOption}
                    onChange={(e) => setResetCountOption(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                  />
                  <span>Reset completed count back to <strong>0</strong> (Give full attempts again)</span>
                </label>

                {/* New Allowed Limit */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                    Adjust Allowed Interview Limit (Total Quota):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newQuotaValue}
                    onChange={(e) => setNewQuotaValue(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(11, 17, 32, 0.85)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      padding: '9px 12px',
                      color: '#f8fafc',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div className="admin-modal__footer">
                <button
                  type="button"
                  onClick={() => setRefreshTargetUser(null)}
                  style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#cbd5e1', padding: '9px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refreshSubmitting}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '9px 22px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  }}
                >
                  {refreshSubmitting ? 'Refreshing...' : 'Confirm Refresh'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CANCEL / REVOKE DEMO ACCESS POPUP */}
      {/* ========================================================================= */}
      {cancelTargetUser && (
        <div className="admin-modal-overlay" onClick={() => setCancelTargetUser(null)}>
          <div className="admin-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal__header">
              <h3 className="admin-modal__title" style={{ color: '#ef4444' }}>
                Revoke Demo Interview Access
              </h3>
              <button
                type="button"
                onClick={() => setCancelTargetUser(null)}
                className="admin-modal__close"
                title="Close popup"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleCancelSubmit}>
              <div className="admin-modal__body">
                <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
                  Are you sure you want to cancel demo interview access for{' '}
                  <strong style={{ color: '#f8fafc' }}>{cancelTargetUser.name}</strong> ({cancelTargetUser.email})?
                </p>

                <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '14px', fontSize: '12.5px', color: '#fca5a5', lineHeight: 1.5 }}>
                  ⚠️ This candidate will be immediately blocked from all AI interview routes and will see the private preview "Feature Coming Soon" page.
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                    Reason for cancellation (optional):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Trial period completed, Evaluation ended"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(11, 17, 32, 0.85)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      padding: '9px 12px',
                      color: '#f8fafc',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div className="admin-modal__footer">
                <button
                  type="button"
                  onClick={() => setCancelTargetUser(null)}
                  style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#cbd5e1', padding: '9px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Keep Access
                </button>
                <button
                  type="submit"
                  disabled={cancelSubmitting}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '9px 22px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                  }}
                >
                  {cancelSubmitting ? 'Revoking...' : 'Yes, Revoke Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}


