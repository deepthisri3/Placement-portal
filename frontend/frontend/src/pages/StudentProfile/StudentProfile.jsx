import { useEffect, useState, useMemo } from 'react'
import api from '../../services/api.js'
import AppShell from '../../components/AppShell/AppShell.jsx'
import './StudentProfile.css'

const MAX_RESUME_MB = 2

const STATUS_CLASS = {
  ACCEPTED: 'badge-success',
  DECLINED: 'badge-danger',
  PENDING: 'badge-warning',
}

function val(v, fallback = '—') {
  if (v === null || v === undefined || v === '') return fallback
  return v
}

function DetailSection({ title, rows }) {
  return (
    <div className="pf-detail-section">
      <h4 className="pf-detail-title">{title}</h4>
      <div className="pf-detail-rows">
        {rows.map(([label, value]) => (
          <div key={label} className="pf-row">
            <span>{label}</span>
            <b>{val(value)}</b>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReportChangesPanel({ onClose }) {
  const [fields, setFields] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [selections, setSelections] = useState({})
  const [search, setSearch] = useState('')
  const [openGroup, setOpenGroup] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadAll() {
    setLoading(true)
    try {
      const [fieldsRes, histRes] = await Promise.all([
        api.get('/change-requests/fields'),
        api.get('/change-requests/me'),
      ])
      const list = fieldsRes.data || []
      setFields(list)
      setHistory(histRes.data || [])
      setOpenGroup((g) => g ?? (list[0]?.group || null))
    } catch (err) {
      const d = err?.response?.data?.detail
      setError(Array.isArray(d) ? d.map((x) => x.msg).join(' ') : (d || 'Could not load profile fields.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const groups = useMemo(() => {
    const map = new Map()
    for (const f of fields) {
      if (!map.has(f.group)) map.set(f.group, [])
      map.get(f.group).push(f)
    }
    return [...map.entries()]
  }, [fields])

  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return groups
    return groups
      .map(([name, items]) => [name, items.filter((f) => f.field_label.toLowerCase().includes(q))])
      .filter(([, items]) => items.length > 0)
  }, [groups, search])

  const selectedList = useMemo(
    () => Object.values(selections).sort((a, b) => a.field_label.localeCompare(b.field_label)),
    [selections]
  )

  function toggleField(f) {
    if (f.pending_value) return
    setError('')
    setSelections((prev) => {
      const next = { ...prev }
      if (next[f.field_name]) delete next[f.field_name]
      else next[f.field_name] = { ...f, requested_value: '' }
      return next
    })
  }

  function setValue(fieldName, value) {
    setSelections((prev) => ({ ...prev, [fieldName]: { ...prev[fieldName], requested_value: value } }))
  }

  async function submit() {
    if (selectedList.length === 0) { setError('Select at least one field to report.'); return }
    const blank = selectedList.filter((s) => !String(s.requested_value).trim())
    if (blank.length > 0) {
      setError(`Enter the corrected value for: ${blank.map((s) => s.field_label).join(', ')}`)
      return
    }
    setSubmitting(true); setError(''); setSuccess('')
    try {
      await api.post('/change-requests/me', {
        changes: selectedList.map((s) => ({
          field_name: s.field_name,
          requested_value: String(s.requested_value).trim(),
        })),
      })
      setSuccess(`Submitted ${selectedList.length} correction${selectedList.length > 1 ? 's' : ''}. You will be notified once reviewed.`)
      setSelections({})
      await loadAll()
    } catch (err) {
      const d = err?.response?.data?.detail
      setError(Array.isArray(d) ? d.map((x) => x.msg).join(' ') : (d || 'Submission failed.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function withdraw(id) {
    setError(''); setSuccess('')
    try {
      const res = await api.delete(`/change-requests/me/${id}`)
      setSuccess(res.data?.message || 'Request withdrawn.')
      await loadAll()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not withdraw that request.')
    }
  }

  function renderInput(s) {
    const common = { value: s.requested_value, onChange: (e) => setValue(s.field_name, e.target.value) }
    if (s.kind === 'select') {
      return (
        <select className="select rc-new-input" {...common}>
          <option value="">— Select —</option>
          {s.choices.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )
    }
    if (s.kind === 'textarea') {
      return <textarea className="textarea rc-new-input" rows={2} placeholder="Enter correct value…" {...common} />
    }
    const type = s.kind === 'date' ? 'date'
      : s.kind === 'int' || s.kind === 'decimal' ? 'number'
      : s.kind === 'email' ? 'email'
      : s.kind === 'phone' ? 'tel'
      : 'text'
    return <input className="input rc-new-input" type={type} step={s.kind === 'decimal' ? '0.01' : undefined} placeholder="Enter correct value…" {...common} />
  }

  const pendingCount = history.filter((h) => h.status === 'PENDING').length

  return (
    <div className="pf-rc-overlay" onClick={onClose}>
      <div className="pf-rc-panel" onClick={(e) => e.stopPropagation()}>

        <div className="pf-rc-head">
          <div>
            <h3 className="pf-rc-title">Request a Profile Correction</h3>
            <p className="pf-rc-sub">
              Select what is incorrect, enter the correct value, and submit.
              Nothing changes until the placement cell approves it.
            </p>
          </div>
          <button className="btn btn-ghost pf-rc-close" onClick={onClose}>✕ Close</button>
        </div>

        {error   && <div style={{ padding: '0 24px 0' }}><p className="alert alert-error">{error}</p></div>}
        {success && <div style={{ padding: '0 24px 0' }}><p className="alert alert-success">{success}</p></div>}

        {loading && <p className="muted" style={{ padding: '16px 24px' }}>Loading fields…</p>}

        {!loading && (
          <div className="pf-rc-body">

            {/* Step 1 */}
            <div className="pf-rc-section">
              <div className="pf-rc-section-head">
                <span className="pf-rc-section-label">Step 1 — Pick what is incorrect</span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {pendingCount > 0 && (
                    <span className="badge badge-warning">{pendingCount} awaiting review</span>
                  )}
                  <input
                    className="input pf-rc-search"
                    placeholder="Search fields…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {visibleGroups.length === 0 && (
                <p className="subtle">No fields match &ldquo;{search}&rdquo;.</p>
              )}

              {visibleGroups.map(([groupName, items]) => {
                const expanded = search.trim() ? true : openGroup === groupName
                const chosen = items.filter((f) => selections[f.field_name]).length
                return (
                  <div key={groupName} className="rc-group">
                    <button
                      type="button"
                      className="rc-group-head"
                      onClick={() => setOpenGroup(expanded && !search.trim() ? null : groupName)}
                    >
                      <span className="rc-group-name">{groupName}</span>
                      {chosen > 0 && <span className="badge badge-accent rc-group-count">{chosen}</span>}
                      <span className="rc-group-arrow">{expanded ? '−' : '+'}</span>
                    </button>
                    {expanded && (
                      <div className="rc-field-list">
                        {items.map((f) => {
                          const selected = Boolean(selections[f.field_name])
                          const locked = Boolean(f.pending_value)
                          return (
                            <button
                              type="button"
                              key={f.field_name}
                              disabled={locked}
                              className={`rc-field-chip ${selected ? 'selected' : ''} ${locked ? 'locked' : ''}`}
                              onClick={() => toggleField(f)}
                              title={locked ? `Awaiting review: ${f.pending_value}` : (f.help || '')}
                            >
                              <span className="rc-check">{locked ? '⏳' : selected ? '✓' : '○'}</span>
                              <span className="rc-chip-text">
                                <span className="rc-chip-label">{f.field_label}</span>
                                <span className="rc-chip-current">
                                  {locked ? `Pending → ${f.pending_value}` : (f.current_value || 'not set')}
                                </span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Step 2 */}
            {selectedList.length > 0 && (
              <div className="pf-rc-section">
                <span className="pf-rc-section-label">Step 2 — Enter the correct values</span>
                <div className="rc-editor">
                  {selectedList.map((s) => (
                    <div key={s.field_name} className="rc-editor-row">
                      <div className="rc-editor-label">
                        {s.field_label}
                        {s.help && <span className="rc-help">{s.help}</span>}
                      </div>
                      <div className="rc-editor-vals">
                        <div className="rc-current">
                          <span className="rc-val-label">Currently</span>
                          <span className="rc-val-value">{s.current_value || <em className="muted">not set</em>}</span>
                        </div>
                        {renderInput(s)}
                      </div>
                      <button type="button" className="rc-remove-btn" onClick={() => toggleField(s)}>✕</button>
                    </div>
                  ))}
                </div>
                <div className="pf-rc-submit-row">
                  <button className="btn btn-ghost" onClick={() => setSelections({})} disabled={submitting}>
                    Clear all
                  </button>
                  <button className="btn btn-primary" disabled={submitting} onClick={submit}>
                    {submitting
                      ? 'Submitting…'
                      : `Submit ${selectedList.length} correction${selectedList.length > 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
            )}

            {/* History */}
            <div className="pf-rc-section">
              <span className="pf-rc-section-label">My previous requests</span>
              {history.length === 0 ? (
                <p className="subtle">No requests submitted yet.</p>
              ) : (
                <div className="pf-rc-hist-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>From → To</th>
                        <th>Status</th>
                        <th>Admin note</th>
                        <th>Date</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((r) => (
                        <tr key={r.id}>
                          <td><strong>{r.field_label}</strong></td>
                          <td className="rc-hist-values">
                            <span className="rc-hist-old">{r.current_value || '—'}</span>
                            <span className="rc-hist-arrow"> → </span>
                            <strong className="rc-hist-new">{r.requested_value}</strong>
                          </td>
                          <td>
                            <span className={`badge ${STATUS_CLASS[r.status] || ''}`}>{r.status}</span>
                          </td>
                          <td>{r.admin_note || <span className="subtle">—</span>}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {new Date(r.created_at).toLocaleDateString()}
                          </td>
                          <td>
                            {r.status === 'PENDING' && (
                              <button className="rc-withdraw" onClick={() => withdraw(r.id)}>Withdraw</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

// ── Main StudentProfile ──────────────────────────────────────────────────────
function StudentProfile() {
  const [profile, setProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [photoUrl, setPhotoUrl] = useState(null)
  const [photoError, setPhotoError] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [showReportChanges, setShowReportChanges] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [placement, setPlacement] = useState(null)
  const [pendingChanges, setPendingChanges] = useState(0)

  async function loadProfile() {
    setIsLoading(true); setLoadError('')
    try {
      const response = await api.get('/students/me/profile')
      setProfile(response.data)
      if (response.data?.photo_filename) fetchPhoto()
    } catch (err) {
      const detail = err.response?.data?.detail
      setLoadError(typeof detail === 'string' ? detail : 'Could not load your profile.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadProfile() }, [])

  useEffect(() => {
    api.get('/students/me/placement-status')
      .then((res) => setPlacement(res.data))
      .catch(() => setPlacement(null))
  }, [])

  useEffect(() => {
    api.get('/change-requests/me')
      .then((res) => setPendingChanges((res.data || []).filter((r) => r.status === 'PENDING').length))
      .catch(() => setPendingChanges(0))
  }, [])

  function extractErrorMessage(err, fallback) {
    const detail = err.response?.data?.detail
    if (Array.isArray(detail)) return detail.map((d) => d.msg).join(' ')
    return detail || fallback
  }

  function handleFileChange(e) {
    const file = e.target.files[0]; setUploadError('')
    if (!file) { setSelectedFile(null); return }
    if (file.type !== 'application/pdf') {
      setUploadError('Resume must be a PDF file.'); setSelectedFile(null); return
    }
    if (file.size > MAX_RESUME_MB * 1024 * 1024) {
      setUploadError(`Resume must be smaller than ${MAX_RESUME_MB}MB.`); setSelectedFile(null); return
    }
    setSelectedFile(file)
  }

  async function handleUploadResume(e) {
    e.preventDefault(); setUploadError('')
    if (!selectedFile) { setUploadError('Choose a PDF file first.'); return }
    const formData = new FormData(); formData.append('file', selectedFile)
    setIsUploading(true)
    try {
      const response = await api.post('/students/me/resume', formData, {
        headers: { 'Content-Type': undefined },
      })
      setProfile(response.data); setSelectedFile(null)
    } catch (err) {
      setUploadError(extractErrorMessage(err, 'Could not upload your resume.'))
    } finally { setIsUploading(false) }
  }

  async function handleDownloadResume() {
    try {
      const response = await api.get('/students/me/resume', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a'); link.href = url
      link.setAttribute('download', profile?.resume_filename || 'resume.pdf')
      document.body.appendChild(link); link.click(); link.remove()
      window.URL.revokeObjectURL(url)
    } catch { setUploadError('Could not download resume.') }
  }

  async function fetchPhoto() {
    try {
      const res = await api.get('/students/me/photo', { responseType: 'blob' })
      setPhotoUrl(window.URL.createObjectURL(new Blob([res.data])))
    } catch { setPhotoUrl(null) }
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0]; setPhotoError('')
    if (!file) return
    if (!file.type.startsWith('image/')) { setPhotoError('Please choose an image file.'); return }
    uploadPhoto(file)
  }

  async function uploadPhoto(file) {
    setPhotoError('')
    const fd = new FormData(); fd.append('file', file)
    try {
      const res = await api.post('/students/me/photo', fd, { headers: { 'Content-Type': undefined } })
      setProfile(res.data); await fetchPhoto()
    } catch (err) {
      setPhotoError(err.response?.data?.detail || 'Could not upload photo.')
    }
  }

  const initials = (profile?.full_name || '?')
    .split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')

  return (
    <AppShell title="My Profile">
      {isLoading && (
        <div className="pf-grid">
          <div className="skeleton" style={{ height: 380, borderRadius: 14 }} />
          <div className="pf-right-col">
            <div className="skeleton" style={{ height: 180, borderRadius: 14 }} />
            <div className="skeleton" style={{ height: 160, borderRadius: 14 }} />
          </div>
        </div>
      )}

      {loadError && <p className="alert alert-error">{loadError}</p>}

      {profile && (
        <div className="pf-grid">

          {/* ── Left: Summary card ── */}
          <section className="card pf-card pf-main-card">
            <div className="pf-avatar-section">
              <div className="pf-avatar-wrap">
                {photoUrl
                  ? <img className="pf-avatar" src={photoUrl} alt="Profile" />
                  : <div className="pf-avatar pf-avatar-initials">{initials}</div>}
                <label className="pf-avatar-edit" title="Change photo">
                  <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                  <span className="pf-avatar-icon">✎</span>
                </label>
              </div>
              <div>
                <h2 className="pf-name">{profile.full_name}</h2>
                <span className={`badge ${placement?.is_placed ? 'badge-success' : 'badge-warning'} pf-status-badge`}>
                  {placement?.is_placed ? 'Placed' : 'Not placed yet'}
                </span>
              </div>
            </div>

            <div className="pf-summary-rows">
              <div className="pf-row"><span>Register No.</span><b>{val(profile.register_number)}</b></div>
              <div className="pf-row"><span>Email</span><b>{val(profile.email)}</b></div>
              <div className="pf-row"><span>Phone</span><b>{val(profile.phone)}</b></div>
              <div className="pf-row"><span>CGPA</span><b>{val(profile.cgpa)}</b></div>
              <div className="pf-row pf-row-last"><span>Branch</span><b>{val(profile.branch)}</b></div>
            </div>

            {photoError && (
              <p className="alert alert-error" style={{ margin: '0 16px 12px' }}>{photoError}</p>
            )}

            <div className="pf-actions">
              <button
                className="btn btn-primary btn-block pf-details-btn"
                onClick={() => setShowDetails(true)}
              >
                See Full Details
              </button>
              <button
                className="btn btn-ghost btn-block pf-report-btn"
                onClick={() => setShowReportChanges(true)}
              >
                ✎ Report Changes
                {pendingChanges > 0 && (
                  <span className="badge badge-warning pf-report-badge">{pendingChanges}</span>
                )}
              </button>
              <p className="subtle pf-report-hint">Something incorrect? Request a correction.</p>
            </div>
          </section>

          {/* ── Right column ── */}
          <div className="pf-right-col">

            {/* Resume card */}
            <section className="card pf-card">
              <h3 className="pf-card-title">Resume</h3>
              {uploadError && <p className="alert alert-error">{uploadError}</p>}
              {profile.resume_filename ? (
                <p className="pf-resume-status">
                  Current: <strong>{profile.resume_filename}</strong>{' '}
                  <button className="pf-link" onClick={handleDownloadResume}>Download</button>
                </p>
              ) : (
                <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
                  No resume uploaded yet.
                </p>
              )}
              <form onSubmit={handleUploadResume} noValidate className="pf-resume-form">
                <input
                  className="pf-file"
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                />
                <button type="submit" className="btn btn-primary btn-block" disabled={isUploading}>
                  {isUploading ? 'Uploading…' : 'Upload Resume'}
                </button>
                <p className="subtle" style={{ fontSize: 12, margin: 0 }}>
                  PDF only · max {MAX_RESUME_MB} MB
                </p>
              </form>
            </section>

            {/* Placement card */}
            <section className="card pf-card">
              <h3 className="pf-card-title">Placement Status</h3>
              {!placement ? (
                <p className="muted" style={{ marginTop: 0 }}>Loading…</p>
              ) : placement.is_placed ? (
                <>
                  <div className="pf-row">
                    <span>Status</span>
                    <b style={{ color: 'var(--success)' }}>Placed ✓</b>
                  </div>
                  <div className="pf-row">
                    <span>Total Offers</span>
                    <b>{placement.total_offers}</b>
                  </div>
                  <div className="pf-row pf-row-last">
                    <span>Highest Package</span>
                    <b>{placement.highest_package != null ? `${placement.highest_package} LPA` : '—'}</b>
                  </div>
                </>
              ) : (
                <p className="muted" style={{ marginTop: 0 }}>Not placed yet.</p>
              )}
            </section>

          </div>
        </div>
      )}

      {/* ── Full details modal ── */}
      {showDetails && profile && (
        <div className="pf-modal" onClick={() => setShowDetails(false)}>
          <div className="pf-modal-content card" onClick={(e) => e.stopPropagation()}>
            <div className="pf-modal-head">
              <h3>Full Profile Details</h3>
              <button className="btn btn-ghost" onClick={() => setShowDetails(false)}>Close</button>
            </div>
            <div className="pf-modal-body">
              <DetailSection title="Personal & Registration" rows={[
                ['Name', profile.full_name],
                ['Surname', profile.last_name],
                ['Register Number', profile.register_number],
                ['Email', profile.email],
                ['Phone', profile.phone],
                ['Date of Birth', profile.date_of_birth],
                ['Alternative Email', profile.alt_email],
                ['Category', profile.category],
              ]} />
              <DetailSection title="Academic & Identity" rows={[
                ['Course', profile.course],
                ['Batch', profile.batch],
                ['Branch', profile.branch],
                ['Section', profile.section],
                ['Graduation Year', profile.graduation_year],
                ['CGPA', profile.cgpa],
                ['Skills', profile.skills],
                ['Stay Type', profile.stay_type],
                ['Aadhar Number', profile.aadhar_no],
                ['Name as per Aadhar', profile.name_as_per_aadhar],
                ['PAN Number', profile.pan_number],
              ]} />
              <DetailSection title="Family & Address" rows={[
                ['Father Name', profile.father_name],
                ['Father Occupation', profile.father_occupation],
                ['Mother Name', profile.mother_name],
                ['Mother Maiden Name', profile.mother_maiden_name],
                ['Parent Mobile', profile.parent_mobile_no],
                ['Address for Communication', profile.address_for_communication],
                ['Hometown', profile.hometown],
                ['District', profile.district],
                ['State', profile.state],
                ['Pincode', profile.pincode],
              ]} />
              <DetailSection title="SSC / Class X" rows={[
                ['School Name', profile.ssc_school_name],
                ['Board', profile.ssc_board],
                ['Year of Passing', profile.ssc_year_of_passing],
                ['Marks Obtained', profile.ssc_marks_obtained],
                ['Maximum Marks', profile.ssc_maximum_marks],
                ['Percentage', profile.ssc_percentage],
              ]} />
              <DetailSection title="Intermediate / Diploma" rows={[
                ['Course Type', profile.intermediate_course_type],
                ['College Name', profile.intermediate_college_name],
                ['Board', profile.intermediate_board],
                ['Year of Passing', profile.intermediate_year_of_passing],
                ['Marks Obtained', profile.intermediate_marks_obtained],
                ['Maximum Marks', profile.intermediate_maximum_marks],
                ['Percentage', profile.intermediate_percentage],
              ]} />
              <DetailSection title="Entrance & Gap" rows={[
                ['Entrance Exam', profile.entrance_exam],
                ['Entrance Rank', profile.entrance_rank],
                ['Seat Status', profile.seat_status],
                ['Education Gap Years', profile.education_gap_years],
                ['Education Gap Reason', profile.education_gap_reason],
                ['Foreign Languages Known', profile.foreign_languages_known],
              ]} />
            </div>
          </div>
        </div>
      )}

      {/* ── Report Changes slide-over ── */}
      {showReportChanges && (
        <ReportChangesPanel onClose={() => setShowReportChanges(false)} />
      )}
    </AppShell>
  )
}

export default StudentProfile