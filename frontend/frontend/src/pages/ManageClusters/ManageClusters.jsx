import { useEffect, useRef, useState } from 'react'
import api from '../../services/api.js'
import AppShell from '../../components/AppShell/AppShell.jsx'
import './ManageClusters.css'

export default function ManageClusters() {
  const [clusters, setClusters] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // 'list' | 'create' | 'edit'
  const [editing, setEditing] = useState(null) // cluster object when editing

  async function loadClusters() {
    setLoading(true)
    try {
      const res = await api.get('/clusters')
      setClusters(res.data || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { loadClusters() }, [])

  function onSaved() {
    setView('list')
    setEditing(null)
    loadClusters()
  }

  function startEdit(cluster) {
    setEditing(cluster)
    setView('edit')
  }

  async function deleteCluster(id, name) {
    if (!window.confirm(`Delete cluster "${name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/clusters/${id}`)
      loadClusters()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Could not delete cluster.')
    }
  }

  return (
    <AppShell title="Manage Clusters">
      {view === 'list' && (
        <>
          <div className="mc-topbar">
            <button className="btn btn-primary" onClick={() => setView('create')}>
              + New Cluster
            </button>
          </div>
          {loading ? <p className="muted">Loading…</p> : (
            clusters.length === 0 ? (
              <p className="muted">No clusters yet. Create one to get started.</p>
            ) : (
              <div className="card mc-table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Name</th><th>Students</th><th>Created</th><th></th><th></th></tr>
                  </thead>
                  <tbody>
                    {clusters.map((c) => (
                      <tr key={c.id}>
                        <td><b>{c.name}</b></td>
                        <td>{c.member_count}</td>
                        <td>{new Date(c.created_at).toLocaleDateString()}</td>
                        <td>
                          <button className="btn btn-ghost mc-sm" onClick={() => startEdit(c)}>
                            Edit
                          </button>
                        </td>
                        <td>
                          <button className="mc-del" onClick={() => deleteCluster(c.id, c.name)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}

      {(view === 'create' || view === 'edit') && (
        <ClusterForm
          existing={view === 'edit' ? editing : null}
          onSaved={onSaved}
          onCancel={() => { setView('list'); setEditing(null) }}
        />
      )}
    </AppShell>
  )
}

function ClusterForm({ existing, onSaved, onCancel }) {
  const [name, setName] = useState(existing?.name || '')
  const [members, setMembers] = useState([]) // {id, full_name, register_number, branch, email}
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const boxRef = useRef(null)

  // Load existing members when editing.
  useEffect(() => {
    if (!existing) return
    api.get(`/clusters/${existing.id}`)
      .then((res) => setMembers(res.data.members || []))
      .catch(() => {})
  }, [existing])

  // Debounced search.
  useEffect(() => {
    const term = q.trim()
    if (!term) { setResults([]); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await api.get('/students/search', { params: { q: term } })
        setResults(res.data || [])
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    function onOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function addMember(s) {
    if (members.find((m) => m.id === s.id)) return
    setMembers((prev) => [...prev, s])
    setQ('')
    setResults([])
    setOpen(false)
  }

  function removeMember(id) {
    setMembers((prev) => prev.filter((m) => m.id !== id))
  }

  async function save() {
    setErr('')
    if (!name.trim()) { setErr('Cluster name is required.'); return }
    if (members.length === 0) { setErr('Add at least one student.'); return }
    setBusy(true)
    try {
      const payload = { name: name.trim(), student_ids: members.map((m) => m.id) }
      if (existing) {
        await api.put(`/clusters/${existing.id}`, payload)
      } else {
        await api.post('/clusters', payload)
      }
      onSaved()
    } catch (e) {
      const d = e?.response?.data?.detail
      setErr(Array.isArray(d) ? d.map((x) => x.msg).join(' ') : d || 'Could not save cluster.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card mc-form-card">
      <h3 className="mc-form-title">{existing ? 'Edit Cluster' : 'New Cluster'}</h3>
      {err && <p className="alert alert-error">{err}</p>}

      <label className="field-label">Cluster name</label>
      <input className="input mc-mb" placeholder="e.g. Aptitude Training Group"
             value={name} onChange={(e) => setName(e.target.value)} />

      <label className="field-label">Search & add students</label>
      <div ref={boxRef} className="mc-search-box">
        <input className="input" placeholder="Search by name, register no, email, phone, CGPA…"
               value={q} onChange={(e) => setQ(e.target.value)}
               onFocus={() => results.length && setOpen(true)} />
        {open && (
          <div className="mc-dropdown">
            {searching && <div className="mc-drop-muted">Searching…</div>}
            {!searching && results.length === 0 && <div className="mc-drop-muted">No matches</div>}
            {!searching && results.map((s) => (
              <div key={s.id} className="mc-drop-item"
                   onClick={() => addMember(s)}
                   onMouseDown={(e) => e.preventDefault()}>
                <div className="mc-drop-name">{s.full_name || '—'}</div>
                <div className="mc-drop-meta">
                  {s.register_number}{s.branch ? ` · ${s.branch}` : ''}{s.email ? ` · ${s.email}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mc-members">
        {members.length === 0 && <p className="subtle mc-no-members">No students added yet.</p>}
        {members.map((m) => (
          <div key={m.id} className="mc-member-chip">
            <div>
              <b>{m.full_name || m.register_number}</b>
              <span className="mc-chip-meta">{m.register_number}{m.branch ? ` · ${m.branch}` : ''}</span>
            </div>
            <button className="mc-chip-remove" onClick={() => removeMember(m.id)}>×</button>
          </div>
        ))}
      </div>

      <div className="mc-form-actions">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : existing ? 'Save Changes' : 'Create Cluster'}
        </button>
      </div>
    </div>
  )
}