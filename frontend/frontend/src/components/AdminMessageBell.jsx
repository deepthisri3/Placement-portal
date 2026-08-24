import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

/**
 * AdminMessageBell — shows in the admin topbar.
 * Polls /messages/admin/unread-count every 30s.
 * Clicking opens a dropdown of recent unread messages.
 * Clicking a message marks it read and opens /admin/messages.
 */
export default function AdminMessageBell() {
  const [open, setOpen]     = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  async function loadCount() {
    try {
      const res = await api.get('/messages/admin/unread-count')
      setUnread(res.data.unread_count || 0)
    } catch { /* ignore */ }
  }

  async function loadMessages() {
    setLoading(true)
    try {
      const res = await api.get('/messages/admin/inbox')
      const all = res.data.messages || []
      setUnread(res.data.unread_count || 0)
      // Show newest 5 unread first, then read
      const unreadFirst = [
        ...all.filter(m => m.status === 'unread'),
        ...all.filter(m => m.status === 'read'),
      ].slice(0, 6)
      setItems(unreadFirst)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    loadCount()
    const t = setInterval(loadCount, 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) loadMessages()
  }

  async function onItemClick(msg) {
    // Mark as read
    if (msg.status === 'unread') {
      try {
        await api.post(`/messages/admin/${msg.id}/read`)
        setItems(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'read' } : m))
        setUnread(u => Math.max(u - 1, 0))
      } catch { /* ignore */ }
    }
    setOpen(false)
    navigate('/admin/messages')
  }

  async function markAll() {
    try {
      await api.post('/messages/admin/read-all')
      setItems(prev => prev.map(m => ({ ...m, status: 'read' })))
      setUnread(0)
    } catch { /* ignore */ }
  }

  return (
    <div ref={ref} className="nb-wrap">
      <button
        className={`nb-btn ${open ? 'active' : ''}`}
        onClick={toggle}
        aria-label="Student Messages"
        title="Student Messages"
      >
        {/* Envelope icon — distinct from the notification bell */}
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
        {unread > 0 && (
          <span className="nb-badge">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="nb-panel" style={{ width: 320 }}>
          <div className="nb-head">
            <strong>Student Messages</strong>
            {unread > 0 && (
              <button className="nb-markall" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>

          {loading && <div className="nb-muted">Loading…</div>}

          {!loading && items.length === 0 && (
            <div className="nb-muted">No messages yet.</div>
          )}

          <div className="nb-list">
            {items.map((m) => (
              <div
                key={m.id}
                className={`nb-item ${m.status === 'unread' ? 'unread' : ''}`}
                onClick={() => onItemClick(m)}
              >
                <div className="nb-item-top">
                  <span className="nb-item-title">{m.subject}</span>
                  {m.status === 'unread' && (
                    <span className="badge badge-accent" style={{ fontSize: 10 }}>New</span>
                  )}
                </div>
                <div className="nb-item-msg">
                  From: <strong>{m.student_name || 'Student'}</strong>
                  {m.register_number ? ` · ${m.register_number}` : ''}
                </div>
                <div className="nb-item-time">
                  {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {/* Footer link to full inbox */}
          <div className="nb-footer">
            <a
              href="/admin/messages"
              onClick={(e) => { e.preventDefault(); setOpen(false); navigate('/admin/messages') }}
            >
              View all messages →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}