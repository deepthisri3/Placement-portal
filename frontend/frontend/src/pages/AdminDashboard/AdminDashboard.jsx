import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import AppShell from '../../components/AppShell/AppShell.jsx'
import './AdminDashboard.css'

/**
 * AdminDashboard — landing page for admins. Same role logic
 * (super_admin sees the management actions), presented as quick-action
 * cards inside the shared AppShell, plus a live Student Change Requests
 * queue that both admins and super admins can action inline.
 */
function ActionIcon({ d }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
  )
}



function errText(err, fallback) {
  const d = err?.response?.data?.detail
  if (Array.isArray(d)) return d.map((x) => x.msg || x).join(' ')
  return d || fallback
}

/**
 * Student Change Requests — pending queue with inline accept/decline.
 * Deliberately shows only the newest few; the full queue lives on
 * /admin/change-requests.
 */
function ChangeRequestsSection() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [declining, setDeclining] = useState(null)
  const [declineNote, setDeclineNote] = useState('')
  const [declineError, setDeclineError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await api.get('/change-requests/admin/summary')
      setSummary(res.data)
      setError('')
    } catch (err) {
      setError(errText(err, 'Could not load change requests.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function accept(req) {
    setBusyId(req.id); setNotice(''); setError('')
    try {
      await api.post(`/change-requests/admin/${req.id}/accept`, { admin_note: null })
      setNotice(`Updated ${req.field_label} for ${req.student_name}.`)
      await load()
    } catch (err) {
      setError(errText(err, 'Could not accept that request.'))
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDecline() {
    if (!declineNote.trim()) { setDeclineError('A reason is required.'); return }
    setBusyId(declining.id); setDeclineError('')
    try {
      await api.post(`/change-requests/admin/${declining.id}/decline`, {
        admin_note: declineNote.trim(),
      })
      setNotice(`Declined ${declining.field_label} for ${declining.student_name}.`)
      setDeclining(null)
      setDeclineNote('')
      await load()
    } catch (err) {
      setDeclineError(errText(err, 'Could not decline that request.'))
    } finally {
      setBusyId(null)
    }
  }

  const pending = summary?.pending_count ?? 0
  const recent = summary?.recent ?? []

  return (
    <section className="card ad-cr">
      <div className="ad-cr-head">
        <div>
          <h3 className="ad-cr-title">
            Student Change Requests
            {pending > 0 && <span className="badge badge-warning ad-cr-count">{pending} pending</span>}
          </h3>
          <p className="ad-cr-sub muted">
            {pending > 0
              ? `From ${summary.student_count} student${summary.student_count > 1 ? 's' : ''} · profile corrections awaiting review`
              : 'Profile corrections submitted by students.'}
          </p>
        </div>
        <div className="ad-cr-head-actions">
          <button className="btn btn-ghost ad-cr-refresh" onClick={load} title="Refresh">↻</button>
          <Link to="/admin/change-requests" className="btn btn-ghost">View all</Link>
        </div>
      </div>

      {notice && <p className="alert alert-success">{notice}</p>}
      {error && <p className="alert alert-error">{error}</p>}

      {loading && <p className="muted">Loading…</p>}

      {!loading && recent.length === 0 && !error && (
        <p className="subtle ad-cr-empty">No pending requests right now.</p>
      )}

      {!loading && recent.length > 0 && (
        <div className="ad-cr-list">
          {recent.map((r) => (
            <div key={r.id} className="ad-cr-item">
              <div className="ad-cr-student">
                <span className="ad-cr-name">{r.student_name || '—'}</span>
                <code className="ad-cr-reg">{r.register_number || '—'}</code>
                {r.branch && <span className="ad-cr-branch">{r.branch}</span>}
              </div>

              <div className="ad-cr-change">
                <span className="ad-cr-field">{r.field_label}</span>
                <div className="ad-cr-values">
                  <span className="ad-cr-old">{r.current_value || 'not set'}</span>
                  <span className="ad-cr-arrow">→</span>
                  <span className="ad-cr-new">{r.requested_value}</span>
                </div>
                {r.is_stale && (
                  <span className="ad-cr-stale" title={`Record now reads: ${r.live_value || 'not set'}`}>
                    ⚠ Record changed since this was filed (now: {r.live_value || 'not set'})
                  </span>
                )}
              </div>

              <div className="ad-cr-meta">
                <span className="badge badge-warning">{r.status}</span>
                <span className="ad-cr-date">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>

              <div className="ad-cr-actions">
                <button
                  className="btn btn-primary ad-cr-btn"
                  disabled={busyId === r.id}
                  onClick={() => accept(r)}
                >
                  {busyId === r.id ? '…' : 'Accept'}
                </button>
                <button
                  className="btn btn-ghost ad-cr-btn"
                  disabled={busyId === r.id}
                  onClick={() => { setDeclining(r); setDeclineNote(''); setDeclineError('') }}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
          {pending > recent.length && (
            <Link to="/admin/change-requests" className="ad-cr-more">
              + {pending - recent.length} more pending
            </Link>
          )}
        </div>
      )}

      {declining && (
        <div className="ad-cr-overlay" onClick={() => busyId === null && setDeclining(null)}>
          <div className="ad-cr-modal" onClick={(e) => e.stopPropagation()}>
            <h4 className="ad-cr-modal-title">Decline change request</h4>
            <p className="ad-cr-modal-body">
              <strong>{declining.student_name}</strong> asked to change{' '}
              <strong>{declining.field_label}</strong> to <em>"{declining.requested_value}"</em>.
              Their record will be left unchanged.
            </p>
            <label className="field-label">Reason (sent to the student)</label>
            <textarea
              className="textarea"
              rows={3}
              autoFocus
              placeholder="e.g. This does not match the documents on file — please visit the placement cell."
              value={declineNote}
              onChange={(e) => setDeclineNote(e.target.value)}
            />
            {declineError && <p className="alert alert-error">{declineError}</p>}
            <div className="ad-cr-modal-actions">
              <button className="btn btn-ghost" disabled={busyId !== null} onClick={() => setDeclining(null)}>
                Cancel
              </button>
              <button className="ad-cr-decline-confirm" disabled={busyId !== null} onClick={confirmDecline}>
                {busyId !== null ? 'Declining…' : 'Confirm decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function AdminDashboard() {
  const { role } = useAuth()
  const isSuper = role === 'super_admin'
  return (
  <AppShell title="Dashboard">
    {/* Welcome Back */}
    <div className="ad-hero card">
      <div>
        <h2 className="ad-hero-title">Welcome back</h2>
        <p className="ad-hero-sub muted">
          {isSuper
            ? 'Manage drives, companies, records and students from one place.'
            : 'Your placement cell workspace.'}
        </p>
      </div>
      <span className="badge badge-accent">{isSuper ? 'Super Admin' : 'Admin'}</span>
    </div>

    {/* Student Change Requests */}
    <ChangeRequestsSection />
  </AppShell>
)
}

export default AdminDashboard
