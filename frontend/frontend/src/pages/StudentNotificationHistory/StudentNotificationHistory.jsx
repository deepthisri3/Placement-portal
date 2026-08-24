import { useEffect, useState } from 'react'
import api from '../../services/api.js'
import AppShell from '../../components/AppShell/AppShell.jsx'

const TYPE_LABEL = {
  announcement:   'Announcement',
  deadline:       'Deadline',
  change_request: 'Profile Change',
  general:        'General',
}

export default function StudentNotificationHistory() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [filter, setFilter]   = useState('all') // all | unread | read

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await api.get('/notifications')
      setItems(res.data.items || [])
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not load notifications.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function markRead(id) {
    try {
      await api.post(`/notifications/${id}/read`)
      setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch { /* ignore */ }
  }

  async function markAllRead() {
    try {
      await api.post('/notifications/read-all')
      setItems(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch { /* ignore */ }
  }

  const visible = items.filter(n => {
    if (filter === 'unread') return !n.is_read
    if (filter === 'read')   return  n.is_read
    return true
  })

  const unreadCount = items.filter(n => !n.is_read).length

  return (
    <AppShell title="Notifications">

      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            Notifications
            {unreadCount > 0 && (
              <span className="badge badge-warning" style={{ fontSize: 11 }}>
                {unreadCount} unread
              </span>
            )}
          </h1>
          <p className="page-desc">
            All notifications sent to you. Reading a notification does not delete it.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 3 }}>
            {['all', 'unread', 'read'].map(f => (
              <button key={f}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={markAllRead}>
              Mark all read
            </button>
          )}
        </div>
      </div>

      {error && <p className="alert alert-error" style={{ marginBottom: 16 }}>{error}</p>}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 88, borderRadius: 12 }} />
          ))}
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>
              </svg>
            </div>
            <p className="empty-state-title">
              {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
            </p>
            <p className="empty-state-desc">
              {filter === 'all'
                ? 'When the placement cell sends announcements or updates, they will appear here.'
                : `You have no ${filter} notifications right now.`}
            </p>
          </div>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(n => (
            <div
              key={n.id}
              className="card"
              style={{
                borderLeft: n.is_read ? undefined : '3px solid var(--accent)',
                cursor: n.is_read ? 'default' : 'pointer',
                opacity: n.is_read ? 0.85 : 1,
                padding: '14px 18px',
              }}
              onClick={() => !n.is_read && markRead(n.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {!n.is_read && (
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: 'var(--accent)', flexShrink: 0, display: 'inline-block',
                    }} />
                  )}
                  <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>
                    {n.title}
                  </span>
                  <span className="badge" style={{ fontSize: 10.5 }}>
                    {TYPE_LABEL[n.type] || n.type}
                  </span>
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-subtle)', whiteSpace: 'nowrap' }}>
                  {new Date(n.created_at).toLocaleString()}
                </span>
              </div>

              <p style={{
                fontSize: 13.5, color: 'var(--text-muted)',
                lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: '0 0 8px',
              }}>
                {n.message}
              </p>

              {!n.is_read && (
                <button
                  style={{
                    background: 'none', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xs)', padding: '3px 10px',
                    fontSize: 12, cursor: 'pointer', color: 'var(--text-subtle)',
                    fontFamily: 'inherit', transition: 'color 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent-border)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-subtle)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                  onClick={ev => { ev.stopPropagation(); markRead(n.id) }}
                >
                  Mark as read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  )
}