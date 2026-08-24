import { useState } from 'react'
import api from '../../services/api'
import AppShell from '../../components/AppShell/AppShell.jsx'

export default function ResumeReminder() {
  const [busy, setBusy]     = useState(false)
  const [result, setResult] = useState('')
  const [error, setError]   = useState('')

  async function sendNow() {
    if (!window.confirm('Send a resume-update reminder email to ALL students now?')) return
    setBusy(true); setResult(''); setError('')
    try {
      const res = await api.post('/admin/resume-reminders/send-now')
      setResult(res.data.message || 'Reminders sent successfully.')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not send reminders.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell title="Resume Reminders">
      <div className="page-header">
        <div>
          <h1 className="page-title">Resume Update Reminders</h1>
          <p className="page-desc">Manually trigger reminder emails to all students.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 13.5, fontWeight: 700 }}>
          Send Reminder Now
        </h3>

        <p className="muted" style={{ fontSize: 13, lineHeight: 1.65, margin: '0 0 20px' }}>
          This emails every registered student a reminder to keep their resume
          up to date. Students are BCC'd on a single email. The reminder is also
          sent automatically every 3 days via a scheduled task on the server.
        </p>

        {result && <p className="alert alert-success" style={{ marginBottom: 16 }}>{result}</p>}
        {error  && <p className="alert alert-error"   style={{ marginBottom: 16 }}>{error}</p>}

        <button className="btn btn-primary" disabled={busy} onClick={sendNow}>
          {busy ? 'Sending…' : 'Send Reminder to All Students Now'}
        </button>

        <p style={{ marginTop: 14, fontSize: 12, color: 'var(--text-subtle)', lineHeight: 1.6 }}>
          Note: emails only send when the server has email enabled
          (EMAIL_ENABLED=true with valid SMTP settings).
        </p>
      </div>
    </AppShell>
  )
}