import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import logoDarkImg from '../assets/images/logo-dark.png'
import {
  DashboardIcon,
  UsersIcon,
  PilotAccessIcon,
  InterviewsIcon,
  FeedbackIcon,
  AnalyticsIcon,
  AiControlIcon,
  ReportsIcon,
  LogsIcon,
  SettingsIcon,
  SearchIcon,
  BellIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from './AdminIcons'
import './AdminLayout.css'

// Navigation schema
const ADMIN_NAV_ITEMS = [
  {
    path: '/admin/dashboard',
    label: 'Dashboard',
    icon: DashboardIcon,
    section: 'Overview',
  },
  {
    path: '/admin/users',
    label: 'Users',
    icon: UsersIcon,
    badge: '2.8k',
  },
  {
    path: '/admin/pilot-access',
    label: 'Pilot / Demo Access',
    icon: PilotAccessIcon,
    badge: '5 New',
  },
  {
    path: '/admin/interviews',
    label: 'Interview Sessions',
    icon: InterviewsIcon,
    section: 'Recruitment & AI',
  },
  {
    path: '/admin/feedback',
    label: 'Feedback',
    icon: FeedbackIcon,
  },
  {
    path: '/admin/analytics',
    label: 'Analytics',
    icon: AnalyticsIcon,
  },
  {
    path: '/admin/ai-control',
    label: 'AI Control',
    icon: AiControlIcon,
    section: 'Management',
  },
  {
    path: '/admin/reports',
    label: 'Reports',
    icon: ReportsIcon,
  },
  {
    path: '/admin/logs',
    label: 'System Logs',
    icon: LogsIcon,
  },
  {
    path: '/admin/settings',
    label: 'Settings',
    icon: SettingsIcon,
  },
]

// Route metadata for top header title and description
const ROUTE_META = {
  '/admin/dashboard': {
    title: 'Dashboard',
    desc: 'Overview of your HireMind platform and pilot performance.',
  },
  '/admin/users': {
    title: 'Users',
    desc: 'View and manage HireMind users.',
  },
  '/admin/pilot-access': {
    title: 'Pilot / Demo Access',
    desc: 'Manage participants and demo access for HireMind pilot testing.',
  },
  '/admin/interviews': {
    title: 'Interview Sessions',
    desc: 'Live and completed AI mock interview rounds, durations, and evaluations.',
  },
  '/admin/feedback': {
    title: 'User Feedback',
    desc: 'Review feedback collected directly through HireMind.',
  },
  '/admin/analytics': {
    title: 'Analytics',
    desc: 'Platform usage trends, interview completion telemetry, and pilot conversion metrics.',
  },
  '/admin/ai-control': {
    title: 'AI Control',
    desc: 'Service status, model orchestration, runtime parameters, and telemetry.',
  },
  '/admin/reports': {
    title: 'Reports',
    desc: 'Generate, preview, and export pilot testing summaries, user activity, and audit reports.',
  },
  '/admin/logs': {
    title: 'System Logs',
    desc: 'Live telemetry logs, authentication events, and administrative audit trails.',
  },
  '/admin/settings': {
    title: 'Settings',
    desc: 'Platform parameters, interview limits, pilot targets, and CV upload policies.',
  },
}

import { useAuth } from '../context/AuthContext'

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showLogoutToast, setShowLogoutToast] = useState(false)

  // Auto-close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false)
    setShowNotifications(false)
  }, [location.pathname])

  // Get current page meta or fallback
  const currentMeta = ROUTE_META[location.pathname] || {
    title: 'Admin Control Center',
    desc: 'HireMind administration, candidate analytics, and AI pipeline control.',
  }

  // Admin Logout handler
  const handleMockLogout = () => {
    setShowLogoutToast(true)
    setTimeout(() => {
      logout()
      setShowLogoutToast(false)
      navigate('/login')
    }, 800)
  }

  // Mock Notifications list
  const mockNotifications = [
    {
      id: 1,
      title: 'New Enterprise Pilot Request',
      desc: 'Stripe Engineering requested a 20-seat team trial.',
      time: '12m ago',
    },
    {
      id: 2,
      title: 'AI Evaluation Peak',
      desc: '254 concurrent technical mock interviews handled smoothly.',
      time: '1h ago',
    },
    {
      id: 3,
      title: 'Model Prompt Updated',
      desc: 'v2.4 Technical Evaluation Prompt deployed to production.',
      time: '4h ago',
    },
  ]

  return (
    <div className="admin-root">
      {/* Mobile Drawer Backdrop */}
      <div
        className={`admin-backdrop ${isMobileOpen ? 'is-visible' : ''}`}
        onClick={() => setIsMobileOpen(false)}
        aria-hidden="true"
      />

      {/* ====================================================================
          FIXED LEFT SIDEBAR (MAIN ADMIN NAVBAR)
          ==================================================================== */}
      <aside
        className={`admin-sidebar ${isCollapsed ? 'admin-sidebar--collapsed' : ''} ${
          isMobileOpen ? 'admin-sidebar--mobile-open' : ''
        }`}
        aria-label="Admin Navigation"
      >
        {/* Sidebar Header: Logo + Admin Badge */}
        <div className="admin-sidebar__header">
          <div
            className="admin-sidebar__brand"
            onClick={() => navigate('/admin/dashboard')}
            title="HireMind Admin Home"
          >
            <img src={logoDarkImg} alt="HireMind" className="admin-sidebar__logo-img" />
            <span className="admin-sidebar__badge">ADMIN</span>
          </div>

          {/* Desktop/Tablet Collapse Toggle */}
          <button
            type="button"
            className="admin-sidebar__collapse-btn"
            onClick={() => setIsCollapsed((prev) => !prev)}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar width"
          >
            {isCollapsed ? <ChevronRightIcon size={14} /> : <ChevronLeftIcon size={14} />}
          </button>
        </div>

        {/* Sidebar Navigation Items */}
        <nav className="admin-sidebar__nav">
          {ADMIN_NAV_ITEMS.map((item, index) => {
            const Icon = item.icon
            return (
              <div key={item.path}>
                {item.section && !isCollapsed && (
                  <div className="admin-sidebar__nav-section-title">{item.section}</div>
                )}
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `admin-sidebar__link ${isActive ? 'is-active' : ''}`
                  }
                  title={item.label}
                >
                  <span className="admin-sidebar__link-icon">
                    <Icon size={18} />
                  </span>
                  <span className="admin-sidebar__link-text">{item.label}</span>
                  {item.badge && (
                    <span className="admin-sidebar__link-badge">{item.badge}</span>
                  )}
                </NavLink>
              </div>
            )
          })}
        </nav>

        {/* Sidebar Footer: Mock Admin Profile & Logout UI Button */}
        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__user-box" title="Admin User">
            <div className="admin-sidebar__avatar-wrapper">
              <div className="admin-sidebar__avatar">
                {user?.firstName ? user.firstName.charAt(0).toUpperCase() : 'A'}
              </div>
              <span className="admin-sidebar__status-dot" title="Online" />
            </div>
            <div className="admin-sidebar__user-info">
              <span className="admin-sidebar__user-name">{user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Administrator'}</span>
              <span className="admin-sidebar__user-email">{user?.email || 'admin@gmail.com'}</span>
            </div>
          </div>

          <button
            type="button"
            className="admin-sidebar__logout-btn"
            onClick={handleMockLogout}
            title="Sign out of administrator account"
            aria-label="Sign out"
          >
            <LogoutIcon size={16} />
          </button>
        </div>
      </aside>

      {/* ====================================================================
          MAIN CONTENT AREA (HEADER + PAGE OUTLET)
          ==================================================================== */}
      <div className={`admin-main ${isCollapsed ? 'admin-main--collapsed' : ''}`}>
        {/* Top Header */}
        <header className="admin-header">
          <div className="admin-header__left">
            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              className="admin-header__mobile-toggle"
              onClick={() => setIsMobileOpen((prev) => !prev)}
              aria-label="Open navigation drawer"
            >
              <MenuIcon size={20} />
            </button>

            {/* Page Title & Short Description */}
            <div className="admin-header__title-block">
              <h1 className="admin-header__title">{currentMeta.title}</h1>
              <p className="admin-header__desc">{currentMeta.desc}</p>
            </div>
          </div>

          <div className="admin-header__right">
            {/* Mock Global Search */}
            <div className="admin-header__search">
              <span className="admin-header__search-icon">
                <SearchIcon size={15} />
              </span>
              <input
                type="text"
                className="admin-header__search-input"
                placeholder="Search candidates, logs, pilots..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="admin-header__search-kbd">⌘K</span>
            </div>

            {/* Live Environment Pill */}
            <div className="admin-header__env-pill">
              <span className="admin-header__env-dot" />
              <span>LIVE MOCK</span>
            </div>

            {/* Notification Bell with Dropdown */}
            <div className="admin-header__notif-wrapper">
              <button
                type="button"
                className="admin-header__icon-btn"
                onClick={() => setShowNotifications((prev) => !prev)}
                title="Notifications"
                aria-label="View notifications"
              >
                <BellIcon size={18} />
                <span className="admin-header__notif-badge" />
              </button>

              {showNotifications && (
                <div className="admin-header__notif-dropdown">
                  <div className="admin-header__notif-header">
                    <span>System Alerts</span>
                    <span style={{ fontSize: '11px', color: 'var(--admin-accent-cyan)' }}>
                      3 Unread
                    </span>
                  </div>
                  <ul className="admin-header__notif-list">
                    {mockNotifications.map((notif) => (
                      <li key={notif.id} className="admin-header__notif-item">
                        <span className="admin-header__notif-item-title">{notif.title}</span>
                        <span className="admin-header__notif-item-desc">{notif.desc}</span>
                        <span className="admin-header__notif-item-time">{notif.time}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Quick Sign Out Action */}
            <button
              type="button"
              className="admin-btn admin-btn--secondary admin-btn--sm"
              onClick={handleMockLogout}
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: 'rgba(244, 63, 94, 0.3)',
                color: '#f8fafc',
              }}
              title="Sign out of administrator session"
            >
              <LogoutIcon size={14} />
              <span>Sign Out</span>
            </button>

            {/* Admin Avatar */}
            <div
              className="admin-header__avatar"
              title={`Admin Profile (${user?.email || 'admin@gmail.com'})`}
              onClick={() => navigate('/admin/settings')}
            >
              {user?.firstName ? user.firstName.charAt(0).toUpperCase() : 'A'}
            </div>
          </div>
        </header>

        {/* Logout Toast Notification */}
        {showLogoutToast && (
          <div
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              background: '#0f172a',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              color: '#f8fafc',
              padding: '12px 20px',
              borderRadius: '10px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <span style={{ color: '#f43f5e' }}>●</span>
            Signed out successfully. Redirecting to login...
          </div>
        )}

        {/* Dynamic Route Content */}
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
