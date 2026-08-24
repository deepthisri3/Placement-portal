import { useEffect, useState } from 'react'
import api from '../../services/api.js'
import AppShell from '../../components/AppShell/AppShell.jsx'
import './AdminMessages.css'

function errText(err, fallback) {
  const d = err?.response?.data?.detail
  return Array.isArray(d) ? d.map((x) => x.msg || x).join(' ') : (d || fallback)
}

export default function AdminMessages() {
  const [messages, setMessages] = useState([])
  const [unread, setUnread]     = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [filter, setFilter]     = useState('all')
  const [selected, setSelected] = useState(null)

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await api.get('/messages/admin/inbox')
      setMessages(res.data.messages || [])
      setUnread(res.data.unread_count || 0)
    } catch (err) {
      setError(errText(err, 'Could not load messages.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function open(msg) {
    setSelected(msg)
    if (msg.status === 'unread') {
      try {
        await api.post(`/messages/admin/${msg.id}/read`)
        setMessages((prev) =>
          prev.map((m) => m.id === msg.id ? { ...m, status: 'read' } : m)
        )
        setSelected((s) => s && s.id === msg.id ? { ...s, status: 'read' } : s)
        setUnread((u) => Math.max(u - 1, 0))
      } catch { /* ignore */ }
    }
  }

  async function markAllRead() {
    try {
      await api.post('/messages/admin/read-all')
      setMessages((prev) => prev.map((m) => ({ ...m, status: 'read' })))
      setUnread(0)
    } catch { /* ignore */ }
  }

  const visible = messages.filter((m) => {
    if (filter === 'unread') return m.status === 'unread'
    if (filter === 'read')   return m.status === 'read'
    return true
  })

  return (
    <AppShell title="Student Messages">
      <div className="am-layout">

        {/* ── Left: message list ── */}
        <div className="am-list-col">
          <div className="am-list-head">
            <div>
              <h3 className="am-list-title">
                Inbox
                {unread > 0 && <span className="badge badge-warning am-unread-badge">{unread}</span>}
              </h3>
            </div>
            <div className="am-list-actions">
              <div className="am-filter">
                {['all', 'unread', 'read'].map((f) => (
                  <button
                    key={f}
                    className={`btn ${filter === f ? 'btn-primary' : 'btn-ghost'} am-filter-btn`}
                    onClick={() => setFilter(f)}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              {unread > 0 && (
                <button className="btn btn-ghost am-filter-btn" onClick={markAllRead}>
                  Mark all read
                </button>
              )}
              <button className="btn btn-ghost am-filter-btn" onClick={load} title="Refresh">↻</button>
            </div>
          </div>

          {error   && <p className="alert alert-error">{error}</p>}
          {loading && <div className="skeleton am-skeleton" />}

          {!loading && visible.length === 0 && (
            <div className="card am-empty">
              <p className="subtle">
                {filter === 'all' ? 'No messages yet.' : `No ${filter} messages.`}
              </p>
            </div>
          )}

          {!loading && visible.map((m) => (
            <div
              key={m.id}
              className={`card am-item ${m.status === 'unread' ? 'am-item-unread' : ''} ${selected?.id === m.id ? 'am-item-active' : ''}`}
              onClick={() => open(m)}
            >
              <div className="am-item-head">
                <div className="am-item-student">
                  {m.status === 'unread' && <span className="am-dot" />}
                  <span className="am-item-name">{m.student_name || '—'}</span>
                  <code className="am-item-reg">{m.register_number || ''}</code>
                </div>
                <span className="am-item-date">{new Date(m.created_at).toLocaleDateString()}</span>
              </div>
              <div className="am-item-subject">{m.subject}</div>
              <div className="am-item-preview">
                {m.message.length > 80 ? m.message.slice(0, 80) + '…' : m.message}
              </div>
            </div>
          ))}
        </div>

        {/* ── Right: message detail ── */}
        <div className="card am-detail-col">
          {!selected ? (
            <p className="subtle am-no-selection">Select a message to read it.</p>
          ) : (
            <>
              <div className="am-detail-head">
                <h3 className="am-detail-subject">{selected.subject}</h3>
                <span className={`badge ${selected.status === 'read' ? 'badge-success' : 'badge-warning'}`}>
                  {selected.status === 'read' ? 'Read' : 'Unread'}
                </span>
              </div>

              <div className="am-detail-meta">
                <div className="am-meta-row">
                  <span>From</span>
                  <b>{selected.student_name || '—'}</b>
                </div>
                <div className="am-meta-row">
                  <span>Register No.</span>
                  <code>{selected.register_number || '—'}</code>
                </div>
                <div className="am-meta-row">
                  <span>Received</span>
                  <b>{new Date(selected.created_at).toLocaleString()}</b>
                </div>
                {selected.read_at && (
                  <div className="am-meta-row">
                    <span>Read at</span>
                    <b>{new Date(selected.read_at).toLocaleString()}</b>
                  </div>
                )}
              </div>

              <div className="am-detail-body">{selected.message}</div>
            </>
          )}
        </div>

      </div>
    </AppShell>
  )
}