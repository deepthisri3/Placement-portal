import { useEffect, useState } from 'react'
import api from '../../services/api'
import AppShell from '../../components/AppShell/AppShell.jsx'

export default function NotificationHistory() {
  const [list, setList]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [selected, setSelected]       = useState(null)
  const [detail, setDetail]           = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    api.get('/notifications/broadcasts')
      .then(res => setList(res.data || []))
      .catch(err => setError(err?.response?.data?.detail || 'Could not load history.'))
      .finally(() => setLoading(false))
  }, [])

  async function open(id) {
    setSelected(id); setDetail(null); setDetailLoading(true)
    try {
      const res = await api.get(`/notifications/broadcasts/${id}`)
      setDetail(res.data)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not load details.')
    } finally {
      setDetailLoading(false)
    }
  }

  function audienceLabel(b) {
    if (b.target_type === 'all')         return 'All students'
    if (b.target_type === 'branch')      return `${b.target_branch} (all batches)`
    if (b.target_type === 'year')        return `Batch ${b.target_year}`
    if (b.target_type === 'year_branch') return `${b.target_year} · ${b.target_branch}`
    return b.target_type
  }

  return (
    <AppShell title="Notification History">

      <div className="page-header">
        <div>
          <h1 className="page-title">Notification History</h1>
          <p className="page-desc">Past broadcasts with delivery and read analytics.</p>
        </div>
      </div>

      {error && <p className="alert alert-error" style={{ marginBottom: 16 }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,340px) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 10 }} />)
          ) : list.length === 0 ? (
            <div className="card">
              <p className="subtle" style={{ fontSize: 13 }}>No notifications sent yet.</p>
            </div>
          ) : list.map(b => (
            <div key={b.id}
              className="card"
              style={{
                padding: '12px 14px', cursor: 'pointer',
                borderColor: selected === b.id ? 'var(--accent)' : undefined,
                background: selected === b.id ? 'var(--accent-soft)' : undefined,
              }}
              onClick={() => open(b.id)}>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 3 }}>{b.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginBottom: 2 }}>
                {audienceLabel(b)} · {b.recipient_count} recipients
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-subtle)' }}>
                {new Date(b.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        {/* Detail */}
        <div className="card" style={{ minHeight: 220, padding: '18px 20px' }}>
          {!selected ? (
            <p className="subtle" style={{ fontSize: 13 }}>
              Select a notification to see its details and analytics.
            </p>
          ) : detailLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="skeleton" style={{ height: 20, width: '60%', borderRadius: 6 }} />
              <div className="skeleton" style={{ height: 60, borderRadius: 6 }} />
              <div className="skeleton" style={{ height: 40, borderRadius: 6 }} />
            </div>
          ) : detail ? (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 8px' }}>
                {detail.title}
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.65, whiteSpace: 'pre-wrap', marginBottom: 18 }}>
                {detail.message}
              </p>

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-subtle)', marginBottom: 3 }}>
                  Target Audience
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                  {detail.audience}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
                <Stat label="Delivered" value={detail.delivered} color="var(--accent)" />
                <Stat label="Read"      value={detail.read}      color="var(--success)" />
                <Stat label="Unread"    value={detail.unread}    color="var(--warning)" />
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-subtle)', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                Sent {new Date(detail.created_at).toLocaleString()}
              </div>
            </>
          ) : null}
        </div>

      </div>
    </AppShell>
  )
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1 }}>
        {value ?? '—'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 4 }}>{label}</div>
    </div>
  )
}