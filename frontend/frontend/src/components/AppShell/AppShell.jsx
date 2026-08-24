import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import NotificationBell from '../NotificationBell'
import AdminMessageBell from '../AdminMessageBell'
import './AppShell.css'

// ── Icon system ───────────────────────────────────────────────────────────────
const icons = {
  grid:      'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
  user:      'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  search:    'M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
  briefcase: 'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2ZM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2',
  building:  'M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9h.01M9 13h.01M9 17h.01',
  records:   'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M8 13h8M8 17h6',
  bell:      'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  users:     'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11',
  upload:    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  shield:    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
  mail:      'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm18 2-10 7L2 6',
  edit:      'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z',
  chart:     'M18 20V10M12 20V4M6 20v-6',
  layers:    'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
}

function Icon({ d }) {
  if (!d) return null
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

// ── Student nav (flat — no sections) ─────────────────────────────────────────
const STUDENT_NAV = [
  { to: '/student/dashboard',     label: 'Dashboard',           icon: 'grid' },
  { to: '/company-search',        label: 'Companies',           icon: 'building' },
  { to: '/student/profile',       label: 'My Profile',          icon: 'user' },
  { to: '/student/details',       label: 'Educational Details', icon: 'records' },
  { to: '/student/notifications', label: 'Notifications',       icon: 'bell' },
  { to: '/student/message-admin', label: 'Message Admin',       icon: 'mail' },
]

// ── Admin grouped nav ─────────────────────────────────────────────────────────
// Each section has a label, an icon shown in the sidebar, and child pages shown
// in the sub-nav bar when that section is active.
const ADMIN_SECTIONS_SUPER = [
  {
    id:    'dashboard',
    label: 'Dashboard',
    icon:  'grid',
    // Dashboard has no children — clicking it goes straight to the page
    single: '/admin/dashboard',
  },
  {
    id:    'placement',
    label: 'Placement',
    icon:  'briefcase',
    children: [
      { to: '/admin/opportunities',    label: 'Opportunities',     icon: 'briefcase' },
      { to: '/admin/companies',        label: 'Companies',         icon: 'building'  },
      { to: '/admin/placement-records',label: 'Placement Records', icon: 'records'   },
    ],
  },
  {
    id:    'students',
    label: 'Students',
    icon:  'users',
    children: [
      { to: '/admin/students',    label: 'Student Search',    icon: 'search'  },
      { to: '/admin/cgpa-upload', label: 'Upload CGPA',       icon: 'upload'  },
      { to: '/admin/resume-reminders', label: 'Resume Reminders', icon: 'mail' },
    ],
  },
  {
    id:    'communication',
    label: 'Communication',
    icon:  'bell',
    children: [
      { to: '/admin/notifications',        label: 'Send Notification',   icon: 'bell'    },
      { to: '/admin/notification-history', label: 'Notification History', icon: 'records' },
      { to: '/admin/messages',             label: 'Student Messages',     icon: 'mail'    },
    ],
  },
  {
    id:    'reports',
    label: 'Reports',
    icon:  'chart',
    children: [
      { to: '/admin/branch-placement-statistics', label: 'Branch Statistics', icon: 'chart' },
    ],
  },
  {
    id:    'administration',
    label: 'Administration',
    icon:  'shield',
    children: [
      { to: '/admin/manage-admins',    label: 'Manage Admins',    icon: 'shield'   },
      { to: '/admin/branches-batches', label: 'Branches & Batches', icon: 'building' },
      { to: '/admin/change-requests',  label: 'Change Requests',  icon: 'edit'     },
      { to: '/admin/clusters',         label: 'Clusters',         icon: 'users'    },
    ],
  },
]

const ADMIN_SECTIONS_REGULAR = [
  {
    id:    'dashboard',
    label: 'Dashboard',
    icon:  'grid',
    single: '/admin/dashboard',
  },
  {
    id:    'reports',
    label: 'Reports',
    icon:  'chart',
    children: [
      { to: '/admin/branch-placement-statistics', label: 'Branch Statistics', icon: 'chart' },
    ],
  },
  {
    id:    'communication',
    label: 'Communication',
    icon:  'bell',
    children: [
      { to: '/admin/messages', label: 'Student Messages', icon: 'mail' },
      { to: '/admin/change-requests', label: 'Change Requests', icon: 'edit' },
    ],
  },
]

const REQUIRED_EDUCATION_FIELDS = [
  'full_name', 'last_name', 'ssc_school_name', 'ssc_board',
  'ssc_year_of_passing', 'ssc_marks_obtained', 'ssc_maximum_marks',
  'intermediate_course_type', 'intermediate_college_name', 'intermediate_board',
  'intermediate_year_of_passing', 'intermediate_marks_obtained',
  'intermediate_maximum_marks', 'seat_status',
]

// ── Helper: given the current path, find which section it belongs to ──────────
function findActiveSection(sections, pathname) {
  for (const s of sections) {
    if (s.single && pathname === s.single)        return s.id
    if (s.children?.some(c => pathname.startsWith(c.to))) return s.id
  }
  return sections[0]?.id ?? null
}

// ── Main AppShell ─────────────────────────────────────────────────────────────
export default function AppShell({ title, children, showBell }) {
  const { role, logout } = useAuth()
  const location  = useLocation()
  const navigate  = useNavigate()

  const [mobileOpen,     setMobileOpen]     = useState(false)
  const [detailsChecked, setDetailsChecked] = useState(role !== 'student')
  const [theme,          setTheme]          = useState(() => localStorage.getItem('theme') || 'dark')

  const isStudent      = role === 'student'
  const isSuperAdmin   = role === 'super_admin'
  const adminSections  = isSuperAdmin ? ADMIN_SECTIONS_SUPER : ADMIN_SECTIONS_REGULAR

  // Which sidebar section is currently active
  const activeSectionId = !isStudent
    ? findActiveSection(adminSections, location.pathname)
    : null

  const activeSection = adminSections.find(s => s.id === activeSectionId) ?? null

  const bell             = showBell ?? isStudent
  const showAdminMessages = !isStudent

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // Student education check
  useEffect(() => {
    if (!isStudent) return
    let active = true
    setDetailsChecked(false)
    api.get('/students/me/details')
      .then((res) => {
        if (!active) return
        const details = res.data || {}
        const isComplete = REQUIRED_EDUCATION_FIELDS.every((field) => {
          const value = details[field]
          return value !== null && value !== undefined && String(value).trim() !== ''
        })
        if (!isComplete && location.pathname !== '/student/details') {
          navigate('/student/details', { replace: true })
          return
        }
        setDetailsChecked(true)
      })
      .catch(() => { if (active) setDetailsChecked(true) })
    return () => { active = false }
  }, [isStudent, location.pathname, navigate])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  if (!detailsChecked && isStudent && location.pathname !== '/student/details') {
    return null
  }

  // ── Student flat nav ───────────────────────────────────────────────────────
  if (isStudent) {
    const studentNav = STUDENT_NAV.filter(
      item => item.to !== '/student/details' || !detailsChecked
    )
    return (
      <div className="shell">
        <aside className={`shell-sidebar ${mobileOpen ? 'open' : ''}`}>
          <div className="shell-brand">
            <div className="shell-logo">CP</div>
            <div className="shell-brand-text">
              <span className="shell-brand-name">Placement Portal</span>
              <span className="shell-brand-sub">Student</span>
            </div>
          </div>
          <nav className="shell-nav">
            {studentNav.map((item) => {
              const active = location.pathname === item.to
              return (
                <Link key={item.to} to={item.to}
                  className={`shell-nav-item ${active ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}>
                  <Icon d={icons[item.icon]} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
          <button className="shell-logout" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
                 strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            <span>Log out</span>
          </button>
        </aside>
        {mobileOpen && <div className="shell-backdrop" onClick={() => setMobileOpen(false)} />}
        <div className="shell-main">
          <header className="shell-topbar">
            <button className="shell-hamburger" onClick={() => setMobileOpen(true)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
            <h1 className="shell-title">{title}</h1>
            <div className="shell-topbar-right">
              <ThemeBtn theme={theme} setTheme={setTheme} />
              {bell && <NotificationBell />}
            </div>
          </header>
          <main className="shell-content">{children}</main>
        </div>
      </div>
    )
  }

  // ── Admin grouped nav ──────────────────────────────────────────────────────
  return (
    <div className="shell">
      {/* Sidebar — shows only section labels */}
      <aside className={`shell-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="shell-brand">
          <div className="shell-logo">CP</div>
          <div className="shell-brand-text">
            <span className="shell-brand-name">Placement Portal</span>
            <span className="shell-brand-sub">
              {isSuperAdmin ? 'Super Admin' : 'Admin'}
            </span>
          </div>
        </div>

        <nav className="shell-nav">
          {adminSections.map((section) => {
            const isActive = section.id === activeSectionId

            if (section.single) {
              // Direct link (e.g. Dashboard)
              return (
                <Link key={section.id} to={section.single}
                  className={`shell-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}>
                  <Icon d={icons[section.icon]} />
                  <span>{section.label}</span>
                </Link>
              )
            }

            // Section with children — clicking navigates to first child
            const firstChild = section.children?.[0]?.to
            return (
              <Link key={section.id}
                to={firstChild || '#'}
                className={`shell-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}>
                <Icon d={icons[section.icon]} />
                <span>{section.label}</span>
                {isActive && (
                  <svg style={{ marginLeft: 'auto', flexShrink: 0 }}
                    viewBox="0 0 24 24" width="12" height="12" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                )}
              </Link>
            )
          })}
        </nav>

        <button className="shell-logout" onClick={handleLogout}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
               strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          <span>Log out</span>
        </button>
      </aside>

      {mobileOpen && <div className="shell-backdrop" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="shell-main">
        {/* Primary topbar */}
        <header className="shell-topbar">
          <button className="shell-hamburger" onClick={() => setMobileOpen(true)}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          </button>
          <h1 className="shell-title">{title}</h1>
          <div className="shell-topbar-right">
            <ThemeBtn theme={theme} setTheme={setTheme} />
            {showAdminMessages && <AdminMessageBell />}
          </div>
        </header>

        {/* Sub-navigation bar (only when section has children) */}
        {activeSection?.children?.length > 0 && (
          <div className="shell-subnav">
            <span className="shell-subnav-label">{activeSection.label}</span>
            <div className="shell-subnav-links">
              {activeSection.children.map((child) => {
                const isActive = location.pathname === child.to ||
                  location.pathname.startsWith(child.to + '/')
                return (
                  <Link key={child.to} to={child.to}
                    className={`shell-subnav-link ${isActive ? 'active' : ''}`}>
                    <Icon d={icons[child.icon]} />
                    {child.label}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        <main className="shell-content">{children}</main>
      </div>
    </div>
  )
}

// ── Theme button (shared) ─────────────────────────────────────────────────────
function ThemeBtn({ theme, setTheme }) {
  return (
    <button
      onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="shell-theme-btn"
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
             strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
             strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>
        </svg>
      )}
    </button>
  )
}