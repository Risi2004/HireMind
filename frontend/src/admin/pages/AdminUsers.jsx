import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UsersIcon,
  ActivityIcon,
  PilotAccessIcon,
  XCircleIcon,
  SearchIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  CloseIcon,
  CheckCircleIcon,
  ClockIcon,
  SparklesIcon,
} from '../AdminIcons'
import './AdminPage.css'
import './AdminUsers.css'

export default function AdminUsers() {
  const navigate = useNavigate()

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('All Users')
  const [sortBy, setSortBy] = useState('joined_desc')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 7

  // Selected User for View Profile Details Modal
  const [selectedUser, setSelectedUser] = useState(null)

  // Demo Access Modal state
  const [demoManageUser, setDemoManageUser] = useState(null)
  const [demoFeedbackToast, setDemoFeedbackToast] = useState('')

  // Active Actions Menu Popover for specific user id
  const [openActionMenuId, setOpenActionMenuId] = useState(null)

  // ========================================================================
  // MOCK USERS DATASET
  // ========================================================================
  const [usersList, setUsersList] = useState([
    {
      id: 'usr_01',
      name: 'Alexander Chen',
      email: 'alex.chen@tech.org',
      avatar: 'A',
      accountType: 'Demo',
      status: 'Active',
      interviewsCount: 14,
      completedInterviews: 13,
      joinedDate: '2025-01-14',
      lastActive: '10 mins ago',
      demoStatus: 'Active Demo: Enterprise Pilot (28 days left)',
      recentInterviews: [
        { role: 'Staff Infrastructure Architect', company: 'Google Cloud', score: 92, status: 'Completed', date: 'Today' },
        { role: 'Distributed Systems Lead', company: 'Databricks', score: 88, status: 'Completed', date: '3 days ago' },
      ],
    },
    {
      id: 'usr_02',
      name: 'Jazeel K.',
      email: 'jazeel@example.com',
      avatar: 'J',
      accountType: 'Regular',
      status: 'Active',
      interviewsCount: 8,
      completedInterviews: 7,
      joinedDate: '2025-01-20',
      lastActive: '25 mins ago',
      demoStatus: 'Standard Access (Candidate Pro)',
      recentInterviews: [
        { role: 'Backend Developer (Spring Boot)', company: 'Microsoft', score: 78, status: 'Completed', date: 'Today' },
        { role: 'Cloud Engineer', company: 'AWS', score: 84, status: 'Completed', date: 'Last week' },
      ],
    },
    {
      id: 'usr_03',
      name: 'Elena Rostova',
      email: 'elena.r@databricks.com',
      avatar: 'E',
      accountType: 'Demo',
      status: 'Active',
      interviewsCount: 6,
      completedInterviews: 6,
      joinedDate: '2025-01-28',
      lastActive: '1 hour ago',
      demoStatus: 'Active Demo: Databricks Team Pilot (35 days left)',
      recentInterviews: [
        { role: 'Distributed Systems Lead', company: 'Databricks', score: 91, status: 'Completed', date: 'Today' },
      ],
    },
    {
      id: 'usr_04',
      name: 'Sarah Jenkins',
      email: 'sarah.j@outlook.com',
      avatar: 'S',
      accountType: 'Regular',
      status: 'Active',
      interviewsCount: 11,
      completedInterviews: 10,
      joinedDate: '2025-02-02',
      lastActive: 'Yesterday',
      demoStatus: 'Standard Access (Candidate Free)',
      recentInterviews: [
        { role: 'Engineering Manager', company: 'Uber', score: 86, status: 'Completed', date: 'Yesterday' },
        { role: 'Tech Lead Backend', company: 'Stripe', score: 82, status: 'Completed', date: 'Feb 18' },
      ],
    },
    {
      id: 'usr_05',
      name: 'David Kim',
      email: 'dkim99@gmail.com',
      avatar: 'D',
      accountType: 'Regular',
      status: 'Inactive',
      interviewsCount: 2,
      completedInterviews: 1,
      joinedDate: '2025-02-08',
      lastActive: '12 days ago',
      demoStatus: 'Standard Access (Candidate Free)',
      recentInterviews: [
        { role: 'Junior Full Stack Developer', company: 'Meta', score: 42, status: 'Failed', date: 'Feb 10' },
      ],
    },
    {
      id: 'usr_06',
      name: 'Sophia Martin',
      email: 'smartin@snowflake.com',
      avatar: 'S',
      accountType: 'Demo',
      status: 'Active',
      interviewsCount: 5,
      completedInterviews: 4,
      joinedDate: '2025-02-12',
      lastActive: '45 mins ago',
      demoStatus: 'Active Demo: Snowflake Recruiter Pilot (22 days left)',
      recentInterviews: [
        { role: 'Data Platform Architect', company: 'Snowflake', score: 89, status: 'Completed', date: 'Feb 20' },
      ],
    },
    {
      id: 'usr_07',
      name: 'Michael Vance',
      email: 'm.vance@tech.co',
      avatar: 'M',
      accountType: 'Regular',
      status: 'Active',
      interviewsCount: 9,
      completedInterviews: 8,
      joinedDate: '2025-02-14',
      lastActive: '3 hours ago',
      demoStatus: 'Standard Access (Candidate Pro)',
      recentInterviews: [
        { role: 'Full Stack Engineer', company: 'Stripe', score: 80, status: 'Completed', date: 'Yesterday' },
      ],
    },
    {
      id: 'usr_08',
      name: 'Priya Sharma',
      email: 'priya.s@design.io',
      avatar: 'P',
      accountType: 'Regular',
      status: 'Active',
      interviewsCount: 7,
      completedInterviews: 6,
      joinedDate: '2025-02-16',
      lastActive: 'Yesterday',
      demoStatus: 'Standard Access (Candidate Pro)',
      recentInterviews: [
        { role: 'Senior Product Designer', company: 'Airbnb', score: 85, status: 'Completed', date: 'Feb 19' },
      ],
    },
    {
      id: 'usr_09',
      name: 'Marcus Brody',
      email: 'mbrody@berkeley.edu',
      avatar: 'M',
      accountType: 'Regular',
      status: 'Inactive',
      interviewsCount: 3,
      completedInterviews: 2,
      joinedDate: '2025-02-18',
      lastActive: '14 days ago',
      demoStatus: 'Standard Access (Student Tier)',
      recentInterviews: [
        { role: 'Machine Learning Intern', company: 'OpenAI', score: 74, status: 'Completed', date: 'Feb 19' },
      ],
    },
    {
      id: 'usr_10',
      name: 'Liam O’Connor',
      email: 'liam@atlassian.com',
      avatar: 'L',
      accountType: 'Demo',
      status: 'Active',
      interviewsCount: 4,
      completedInterviews: 4,
      joinedDate: '2025-02-20',
      lastActive: '2 days ago',
      demoStatus: 'Active Demo: Atlassian Global Pilot (25 days left)',
      recentInterviews: [
        { role: 'Principal Architect', company: 'Atlassian', score: 94, status: 'Completed', date: 'Feb 21' },
      ],
    },
    {
      id: 'usr_11',
      name: 'Chloe Vance',
      email: 'chloe@stripe.com',
      avatar: 'C',
      accountType: 'Demo',
      status: 'Active',
      interviewsCount: 8,
      completedInterviews: 8,
      joinedDate: '2025-02-21',
      lastActive: '4 hours ago',
      demoStatus: 'Active Demo: Stripe Talent Ops Pilot (29 days left)',
      recentInterviews: [
        { role: 'Payments Infrastructure Engineer', company: 'Stripe', score: 90, status: 'Completed', date: 'Feb 22' },
      ],
    },
    {
      id: 'usr_12',
      name: 'Hannah Brooks',
      email: 'hannah.b@gmail.com',
      avatar: 'H',
      accountType: 'Regular',
      status: 'Inactive',
      interviewsCount: 1,
      completedInterviews: 0,
      joinedDate: '2025-02-22',
      lastActive: '18 days ago',
      demoStatus: 'Standard Access (Candidate Free)',
      recentInterviews: [
        { role: 'Frontend Engineer', company: 'Vercel', score: 48, status: 'Failed', date: 'Feb 22' },
      ],
    },
  ])

  // Summary counts
  const totalUsersCount = 2845
  const activeUsersCount = 1920
  const demoUsersCount = 128
  const inactiveUsersCount = 925

  // ========================================================================
  // FILTERING & SORTING LOGIC
  // ========================================================================
  const filteredUsers = useMemo(() => {
    return usersList
      .filter((user) => {
        // Search Filter
        const matchesQuery =
          user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.accountType.toLowerCase().includes(searchQuery.toLowerCase())

        // Dropdown Filter
        let matchesType = true
        if (filterType === 'Regular') matchesType = user.accountType === 'Regular'
        else if (filterType === 'Demo') matchesType = user.accountType === 'Demo'
        else if (filterType === 'Active') matchesType = user.status === 'Active'
        else if (filterType === 'Inactive') matchesType = user.status === 'Inactive'

        return matchesQuery && matchesType
      })
      .sort((a, b) => {
        if (sortBy === 'joined_desc') return new Date(b.joinedDate) - new Date(a.joinedDate)
        if (sortBy === 'joined_asc') return new Date(a.joinedDate) - new Date(b.joinedDate)
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name)
        if (sortBy === 'interviews_desc') return b.interviewsCount - a.interviewsCount
        return 0
      })
  }, [usersList, searchQuery, filterType, sortBy])

  // Pagination calculation
  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredUsers.slice(startIndex, startIndex + pageSize)
  }, [filteredUsers, currentPage])

  // Toggle Demo Access UI handler
  const handleToggleDemoAccess = (user) => {
    const newType = user.accountType === 'Demo' ? 'Regular' : 'Demo'
    const newDemoStatus =
      newType === 'Demo'
        ? 'Active Demo: Custom Extended Pilot (30 days granted)'
        : 'Standard Access (Candidate Pro)'

    setUsersList((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, accountType: newType, demoStatus: newDemoStatus } : u
      )
    )

    if (selectedUser?.id === user.id) {
      setSelectedUser((prev) => ({
        ...prev,
        accountType: newType,
        demoStatus: newDemoStatus,
      }))
    }

    setDemoFeedbackToast(
      `${user.name}'s account type successfully updated to ${newType.toUpperCase()}`
    )
    setTimeout(() => setDemoFeedbackToast(''), 2500)
    setDemoManageUser(null)
    setOpenActionMenuId(null)
  }

  return (
    <div>
      {/* ==================================================================
          HEADER & 4 SUMMARY CARDS
          ================================================================== */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
          Users
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', margin: '3px 0 0' }}>
          View and manage HireMind users.
        </p>
      </div>

      <div className="users-summary-grid">
        {/* Total Users */}
        <div className="users-summary-card">
          <div className="users-summary-card__top">
            <span className="users-summary-card__label">Total Users</span>
            <span className="users-summary-card__icon-wrap users-summary-card__icon-wrap--cyan">
              <UsersIcon size={18} />
            </span>
          </div>
          <div className="users-summary-card__value">{totalUsersCount.toLocaleString()}</div>
          <div className="users-summary-card__bottom">
            <span className="users-summary-card__trend users-summary-card__trend--up">
              <TrendingUpIcon size={13} /> +14.2%
            </span>
            <span className="users-summary-card__subtext">vs last month</span>
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
          <div className="users-summary-card__value">{activeUsersCount.toLocaleString()}</div>
          <div className="users-summary-card__bottom">
            <span className="users-summary-card__trend users-summary-card__trend--up">
              <TrendingUpIcon size={13} /> +8.6%
            </span>
            <span className="users-summary-card__subtext">67.5% engagement</span>
          </div>
        </div>

        {/* Demo Users */}
        <div className="users-summary-card">
          <div className="users-summary-card__top">
            <span className="users-summary-card__label">Demo Users</span>
            <span className="users-summary-card__icon-wrap users-summary-card__icon-wrap--purple">
              <PilotAccessIcon size={18} />
            </span>
          </div>
          <div className="users-summary-card__value" style={{ color: 'var(--admin-accent-purple)' }}>
            {demoUsersCount.toLocaleString()}
          </div>
          <div className="users-summary-card__bottom">
            <span className="users-summary-card__trend users-summary-card__trend--up">
              <TrendingUpIcon size={13} /> +12 this week
            </span>
            <span className="users-summary-card__subtext">pilot trials</span>
          </div>
        </div>

        {/* Inactive Users */}
        <div className="users-summary-card">
          <div className="users-summary-card__top">
            <span className="users-summary-card__label">Inactive Users</span>
            <span className="users-summary-card__icon-wrap users-summary-card__icon-wrap--amber">
              <XCircleIcon size={18} />
            </span>
          </div>
          <div className="users-summary-card__value" style={{ color: 'var(--admin-text-muted)' }}>
            {inactiveUsersCount.toLocaleString()}
          </div>
          <div className="users-summary-card__bottom">
            <span className="users-summary-card__trend users-summary-card__trend--down">
              <TrendingDownIcon size={13} /> -3.1%
            </span>
            <span className="users-summary-card__subtext">dormant &gt; 14 days</span>
          </div>
        </div>
      </div>

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
                placeholder="Search users..."
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
                <option value="Regular">Regular</option>
                <option value="Demo">Demo</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
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
                <th>User</th>
                <th>Email</th>
                <th>Account Type</th>
                <th>Status</th>
                <th>Interviews</th>
                <th>Joined</th>
                <th>Last Active</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--admin-text-muted)' }}>
                    No users matching criteria.
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
                          {u.avatar}
                        </div>
                        <span className="user-cell-name">{u.name}</span>
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
                        {u.accountType === 'Demo' ? '★ Demo' : 'Regular'}
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
                        {u.interviewsCount} sessions
                      </span>
                    </td>

                    {/* Joined Date */}
                    <td style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                      {u.joinedDate}
                    </td>

                    {/* Last Active */}
                    <td style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                      {u.lastActive}
                    </td>

                    {/* Actions Menu */}
                    <td style={{ textAlign: 'right' }}>
                      <div className="user-actions-container">
                        <button
                          type="button"
                          className="user-action-trigger-btn"
                          onClick={() =>
                            setOpenActionMenuId((prev) => (prev === u.id ? null : u.id))
                          }
                          title="Open actions"
                          aria-label="Actions menu"
                        >
                          •••
                        </button>

                        {openActionMenuId === u.id && (
                          <div className="user-action-menu">
                            <button
                              type="button"
                              className="user-action-menu-item"
                              onClick={() => {
                                setSelectedUser(u)
                                setOpenActionMenuId(null)
                              }}
                            >
                              <UsersIcon size={14} />
                              View Profile
                            </button>

                            <button
                              type="button"
                              className="user-action-menu-item"
                              onClick={() => {
                                setOpenActionMenuId(null)
                                navigate('/admin/interviews')
                              }}
                            >
                              <ClockIcon size={14} />
                              View Interviews
                            </button>

                            <button
                              type="button"
                              className="user-action-menu-item"
                              onClick={() => {
                                setDemoManageUser(u)
                                setOpenActionMenuId(null)
                              }}
                            >
                              <PilotAccessIcon size={14} />
                              Manage Demo Access
                            </button>
                          </div>
                        )}
                      </div>
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
            of <strong>{filteredUsers.length}</strong> users
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
          USER DETAILS MODAL (VIEW PROFILE)
          ================================================================== */}
      {selectedUser && (
        <div
          className="user-details-modal-backdrop"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="user-details-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="user-details-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-accent-cyan)' }}>
                  User Profile Details
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
                onClick={() => setSelectedUser(null)}
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
                  {selectedUser.avatar}
                </div>
                <div>
                  <h3 style={{ fontSize: '19px', fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
                    {selectedUser.name}
                  </h3>
                  <div style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                    {selectedUser.email}
                  </div>
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
                  <span className="user-details-meta-item__val">{selectedUser.interviewsCount}</span>
                </div>

                <div className="user-details-meta-item">
                  <span className="user-details-meta-item__label">Completed Sessions</span>
                  <span className="user-details-meta-item__val" style={{ color: 'var(--admin-accent-emerald)' }}>
                    {selectedUser.completedInterviews}
                  </span>
                </div>
              </div>

              {/* Demo Status Banner */}
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '8px',
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
                </div>

                <button
                  type="button"
                  className="admin-btn admin-btn--secondary admin-btn--sm"
                  onClick={() => {
                    setDemoManageUser(selectedUser)
                  }}
                >
                  Manage Access
                </button>
              </div>

              {/* Small Recent Interviews Section */}
              <div className="user-details-interviews-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
                    Recent Candidate Interviews
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
                    Telemetry Log
                  </span>
                </div>

                {selectedUser.recentInterviews?.map((intv, idx) => (
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
                      <span
                        className={`admin-badge ${
                          intv.status === 'Completed'
                            ? 'admin-badge--emerald'
                            : 'admin-badge--rose'
                        }`}
                      >
                        {intv.status}
                      </span>
                    </div>
                  </div>
                ))}
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
                onClick={() => setSelectedUser(null)}
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================
          MANAGE DEMO ACCESS QUICK MODAL
          ================================================================== */}
      {demoManageUser && (
        <div
          className="user-details-modal-backdrop"
          onClick={() => setDemoManageUser(null)}
        >
          <div
            className="user-details-modal-card"
            style={{ maxWidth: '440px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="user-details-modal-header">
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                Manage Demo Access
              </span>
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
                <strong style={{ color: 'var(--admin-text-primary)' }}>{demoManageUser.name}</strong> (
                {demoManageUser.email})
              </div>

              <div style={{ fontSize: '12.5px', color: 'var(--admin-text-secondary)', lineHeight: 1.5 }}>
                Current Access: <strong style={{ color: 'var(--admin-accent-cyan)' }}>{demoManageUser.accountType}</strong>.
                {demoManageUser.accountType === 'Demo'
                  ? ' You can revoke demo privileges and return them to Regular tier, or renew their trial period.'
                  : ' Granting demo access will unlock enterprise questions and full telemetry.'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  onClick={() => handleToggleDemoAccess(demoManageUser)}
                  style={{ justifyContent: 'center' }}
                >
                  {demoManageUser.accountType === 'Demo' ? 'Revoke Demo (Set Regular)' : 'Grant Demo Access (30 Days)'}
                </button>
              </div>
            </div>

            <div className="user-details-modal-footer">
              <button
                type="button"
                className="admin-btn admin-btn--secondary admin-btn--sm"
                onClick={() => setDemoManageUser(null)}
              >
                Cancel
              </button>
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
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <span style={{ color: 'var(--admin-accent-emerald)' }}>✓</span>
          {demoFeedbackToast}
        </div>
      )}
    </div>
  )
}
