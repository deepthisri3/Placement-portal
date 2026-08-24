import { useEffect, useState } from 'react'
import api from '../../services/api.js'
import AppShell from '../../components/AppShell/AppShell.jsx'
import './ManageBranchesBatches.css'

export default function ManageBranchesBatches() {
  const [branches, setBranches] = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)

  const [bName, setBName] = useState('')
  const [bCode, setBCode] = useState('')
  const [branchErr, setBranchErr] = useState('')
  const [branchBusy, setBranchBusy] = useState(false)

  const [year, setYear] = useState('')
  const [batchErr, setBatchErr] = useState('')
  const [batchBusy, setBatchBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [br, ba] = await Promise.all([
        api.get('/academic/branches'),
        api.get('/academic/batches'),
      ])
      setBranches(br.data || [])
      setBatches(ba.data || [])
    } catch {
      // ignore; sections show empty
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function errMsg(err, fallback) {
    const d = err?.response?.data?.detail
    if (Array.isArray(d)) return d.map((x) => x.msg).join(' ')
    return d || fallback
  }

  async function addBranch(e) {
    e.preventDefault()
    setBranchErr('')
    if (!bName.trim() || !bCode.trim()) { setBranchErr('Both name and code are required.'); return }
    setBranchBusy(true)
    try {
      await api.post('/academic/branches', { name: bName, code: bCode })
      setBName(''); setBCode('')
      load()
    } catch (err) {
      setBranchErr(errMsg(err, 'Could not add branch.'))
    } finally {
      setBranchBusy(false)
    }
  }

  async function removeBranch(id) {
    if (!window.confirm('Delete this branch?')) return
    try { await api.delete(`/academic/branches/${id}`); load() }
    catch (err) { alert(errMsg(err, 'Could not delete branch.')) }
  }

  async function addBatch(e) {
    e.preventDefault()
    setBatchErr('')
    if (!year.trim()) { setBatchErr('Enter a graduation year.'); return }
    setBatchBusy(true)
    try {
      await api.post('/academic/batches', { graduation_year: Number(year) })
      setYear('')
      load()
    } catch (err) {
      setBatchErr(errMsg(err, 'Could not add batch.'))
    } finally {
      setBatchBusy(false)
    }
  }

  async function removeBatch(id) {
    if (!window.confirm('Delete this batch?')) return
    try { await api.delete(`/academic/batches/${id}`); load() }
    catch (err) { alert(errMsg(err, 'Could not delete batch.')) }
  }

  return (
    <AppShell title="Manage Branches & Batches">
      <div className="mbb-grid">
        {/* Branches */}
        <section className="card mbb-card">
          <h3 className="mbb-title">Branches</h3>
          <form className="mbb-form" onSubmit={addBranch}>
            {branchErr && <p className="alert alert-error">{branchErr}</p>}
            <input className="input" placeholder="Branch name (e.g. Computer Science)"
                   value={bName} onChange={(e) => setBName(e.target.value)} />
            <input className="input" placeholder="Branch code (e.g. CSE)"
                   value={bCode} onChange={(e) => setBCode(e.target.value.toUpperCase())} />
            <button className="btn btn-primary" disabled={branchBusy}>
              {branchBusy ? 'Adding…' : '+ Add Branch'}
            </button>
          </form>

          {loading ? <p className="muted">Loading…</p> : (
            <div className="mbb-list">
              {branches.length === 0 && <p className="subtle">No branches yet.</p>}
              {branches.map((b) => (
                <div key={b.id} className="mbb-item">
                  <div>
                    <b>{b.code}</b> <span className="muted">— {b.name}</span>
                  </div>
                  <button className="mbb-del" onClick={() => removeBranch(b.id)}>Delete</button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Batches */}
        <section className="card mbb-card">
          <h3 className="mbb-title">Batches (Graduation Year)</h3>
          <form className="mbb-form" onSubmit={addBatch}>
            {batchErr && <p className="alert alert-error">{batchErr}</p>}
            <input className="input" type="number" placeholder="Graduation year (e.g. 2028)"
                   value={year} onChange={(e) => setYear(e.target.value)} />
            <button className="btn btn-primary" disabled={batchBusy}>
              {batchBusy ? 'Adding…' : '+ Add Batch'}
            </button>
          </form>

          {loading ? <p className="muted">Loading…</p> : (
            <div className="mbb-list">
              {batches.length === 0 && <p className="subtle">No batches yet.</p>}
              {batches.map((b) => (
                <div key={b.id} className="mbb-item">
                  <b>{b.graduation_year}</b>
                  <button className="mbb-del" onClick={() => removeBatch(b.id)}>Delete</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}