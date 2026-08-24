import { useState } from 'react'
import api from '../../services/api'
import AppShell from '../../components/AppShell/AppShell.jsx'

export default function CgpaUpload() {
  const [file, setFile]     = useState(null)
  const [busy, setBusy]     = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError]   = useState('')

  async function upload() {
    if (!file) { setError('Choose a .csv or .xlsx file first.'); return }
    setBusy(true); setError(''); setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/students/cgpa/upload', fd, {
        headers: { 'Content-Type': undefined },
      })
      setResult(res.data)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell title="Upload CGPA">
      <div className="page-header">
        <div>
          <h1 className="page-title">Upload CGPA</h1>
          <p className="page-desc">Bulk-update student CGPA from a CSV or Excel file.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 640, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 13.5, fontWeight: 700 }}>
          File Format
        </h3>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.65, margin: '0 0 16px' }}>
          Upload a <code>.csv</code> or <code>.xlsx</code> with two columns:
          <strong style={{ color: 'var(--text)' }}> Register Number</strong> and
          <strong style={{ color: 'var(--text)' }}> CGPA</strong> (0–10).
          Each matching row updates that student's CGPA.
          Rows whose register number doesn't match a student are skipped.
        </p>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          <input
            type="file"
            accept=".csv,.xlsx"
            style={{ fontSize: 13, color: 'var(--text-muted)', flex: 1, minWidth: 200 }}
            onChange={(e) => { setFile(e.target.files[0] || null); setError(''); setResult(null) }}
          />
          <button className="btn btn-primary" disabled={busy || !file} onClick={upload}>
            {busy ? 'Uploading…' : 'Upload'}
          </button>
        </div>

        {error && <p className="alert alert-error">{error}</p>}
      </div>

      {result && (
        <div className="card" style={{ maxWidth: 640 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 13.5, fontWeight: 700 }}>Result</h3>

          <div style={{ display: 'flex', gap: 32, marginBottom: 16, flexWrap: 'wrap' }}>
            <Stat label="Updated"    value={result.updated}    color="var(--success)" />
            <Stat label="Skipped"    value={result.skipped}    color="var(--warning)" />
            <Stat label="Total rows" value={result.total_rows} color="var(--text-muted)" />
          </div>

          {result.updated > 0 && (
            <p className="alert alert-success" style={{ marginBottom: 12 }}>
              ✓ {result.updated} student CGPA{result.updated > 1 ? 's' : ''} updated successfully.
            </p>
          )}

          {result.errors?.length > 0 && (
            <div className="alert alert-warning" style={{ display: 'block' }}>
              <strong style={{ display: 'block', marginBottom: 6 }}>
                Skipped rows ({result.errors.length}):
              </strong>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
                {result.errors.map((e, i) => (
                  <li key={i}>Row {e.row}: {e.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 4 }}>{label}</div>
    </div>
  )
}