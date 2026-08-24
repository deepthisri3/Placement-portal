import { useEffect, useState } from 'react'
import api from '../../services/api.js'
import AppShell from '../../components/AppShell/AppShell.jsx'
import './MessageAdmin.css'

function errText(err, fallback) {
  const d = err?.response?.data?.detail
  if (Array.isArray(d)) return d.map((x) => x.msg || x).join(' ')
  return d || fallback
}

const ROLE_LABEL = {
  super_admin: 'Super Admin',
  admin: 'Admin',
}

export default function MessageAdmin() {
  const [admins, setAdmins]           = useState([])
  const [sent, setSent]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [selectedAdmin, setSelectedAdmin] = useState(null)
  const [subject, setSubject]         = useState('')
  const [message, setMessage]         = useState('')
  const [busy, setBusy]               = useState(false)
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState('')
  const [tab, setTab]                 = useState('compose')

  async function load() {
    setLoading(true)
    try {
      const [adminRes, sentRes] = await Promise.all([
        api.get('/messages/admins'),
        api.get('/messages/sent'),
      ])
      const a = adminRes.data || []
      setAdmins(a)
      setSent(sentRes.data || [])
      if (!selectedAdmin && a.length) setSelectedAdmin(a[0])
    } catch (err) {
      setError(errText(err, 'Could not load admins.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function send(e) {
    e.preventDefault()
    if (!selectedAdmin) { setError('Select a recipient.'); return }
    if (!subject.trim()) { setError('Enter a subject.'); return }
    if (!message.trim()) { setError('Write your message.'); return }
    setBusy(true); setError(''); setSuccess('')
    try {
      await api.post('/messages', {
        admin_id: selectedAdmin.id,
        subject: subject.trim(),
        message: message.trim(),
      })
      setSuccess(`Message sent to ${selectedAdmin.full_name || selectedAdmin.email}.`)
      setSubject('')
      setMessage('')
      const res = await api.get('/messages/sent')
      setSent(res.data || [])
    } catch (err) {
      setError(errText(err, 'Could not send message.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell title="Message Admin">

      <div className="tabs ma-tabs">
        <button className={`tab-btn ${tab === 'compose' ? 'active' : ''}`}
          onClick={() => setTab('compose')}>
          Compose
        </button>
        <button className={`tab-btn ${tab === 'sent' ? 'active' : ''}`}
          onClick={() => setTab('sent')}>
          Sent Messages
          {sent.length > 0 && <span className="ma-sent-count">{sent.length}</span>}
        </button>
      </div>

      {tab === 'compose' && (
        <div className="ma-compose-layout">

          {/* Admin picker */}
          <div className="card ma-admin-list">
            <h3 className="ma-list-title">Select Recipient</h3>
            <p className="ma-list-hint">Choose which admin to send your message to.</p>

            {loading ? (
              <div className="ma-skeletons">
                {[1,2,3].map(i => <div key={i} className="skeleton ma-skeleton-row" />)}
              </div>
            ) : admins.length === 0 ? (
              <p className="subtle">No admins available.</p>
            ) : (
              <div className="ma-admin-options">
                {admins.map((a) => {
                  const active = selectedAdmin?.id === a.id
                  const initials = (a.full_name || a.email)
                    .split(' ').filter(Boolean).slice(0, 2)
                    .map(s => s[0]?.toUpperCase()).join('')
                  return (
                    <button key={a.id} type="button"
                      className={`ma-admin-card ${active ? 'selected' : ''}`}
                      onClick={() => { setSelectedAdmin(a); setError('') }}>
                      <div className="ma-admin-avatar">{initials}</div>
                      <div className="ma-admin-info">
                        <span className="ma-admin-name">
                          {a.full_name || a.email}
                        </span>
                        <div className="ma-admin-meta">
                          <span className={`badge ${a.role === 'super_admin' ? 'badge-accent' : ''}`}>
                            {ROLE_LABEL[a.role] || a.role}
                          </span>
                          <span className="ma-admin-branch">
                            {a.branch || <span className="muted">Branch: —</span>}
                          </span>
                        </div>
                      </div>
                      {active && <span className="ma-check">✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Compose form */}
          <div className="card ma-compose-form">
            <h3 className="ma-form-title">New Message</h3>

            {selectedAdmin && (
              <div className="ma-to-pill">
                <span className="ma-to-label">To:</span>
                <span className="ma-to-name">
                  {selectedAdmin.full_name || selectedAdmin.email}
                </span>
                <span className={`badge ${selectedAdmin.role === 'super_admin' ? 'badge-accent' : ''}`}>
                  {ROLE_LABEL[selectedAdmin.role]}
                </span>
              </div>
            )}

            {error   && <p className="alert alert-error">{error}</p>}
            {success && <p className="alert alert-success">{success}</p>}

            <form onSubmit={send} noValidate className="ma-form">
              <div className="form-group">
                <label className="field-label">Subject</label>
                <input className="input" value={subject}
                  onChange={(e) => { setSubject(e.target.value); setError('') }}
                  placeholder="e.g. Query about placement eligibility"
                  disabled={busy} />
              </div>

              <div className="form-group">
                <label className="field-label">Message</label>
                <textarea className="textarea" rows={7} value={message}
                  onChange={(e) => { setMessage(e.target.value); setError('') }}
                  placeholder="Write your message here…"
                  disabled={busy}
                  style={{ minHeight: 160 }} />
              </div>

              <div className="ma-form-footer">
                <span className="muted" style={{ fontSize: 12 }}>
                  {message.length} / 5000 characters
                </span>
                <button type="submit" className="btn btn-primary"
                  disabled={busy || !selectedAdmin || !subject.trim() || !message.trim()}>
                  {busy ? 'Sending…' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>

        </div>
      )}

      {tab === 'sent' && (
        <div className="card ma-sent-wrap">
          <h3 className="ma-list-title" style={{ marginBottom: 16 }}>Sent Messages</h3>

          {loading ? (
            <p className="muted">Loading…</p>
          ) : sent.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm18 2-10 7L2 6"/>
                </svg>
              </div>
              <p className="empty-state-title">No messages sent yet</p>
              <p className="empty-state-desc">
                Use the Compose tab to send your first message to an admin.
              </p>
            </div>
          ) : (
            <div className="ma-sent-list">
              {sent.map((m) => (
                <div key={m.id} className="ma-sent-item">
                  <div className="ma-sent-head">
                    <div className="ma-sent-to-info">
                      <span className="ma-to-label">To</span>
                      <span className="ma-sent-to-name">{m.admin_name || 'Admin'}</span>
                    </div>
                    <div className="ma-sent-right">
                      <span className={`badge ${m.status === 'read' ? 'badge-success' : 'badge-warning'}`}>
                        {m.status === 'read' ? 'Read' : 'Unread'}
                      </span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {new Date(m.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="ma-sent-subject">{m.subject}</div>
                  <div className="ma-sent-body">{m.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </AppShell>
  )
}