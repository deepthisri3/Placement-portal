import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api.js'
import AppShell from '../../components/AppShell/AppShell.jsx'
import './AdminStudentProfile.css'

// ── Option lists (mirrored from StudentRegister / StudentDetails) ─────────────
const CATEGORY_OPTIONS   = ['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'SC', 'ST']
const STAY_TYPE_OPTIONS  = ['Day Scholar', 'Hosteler']
const BOARD_OPTIONS      = ['State Board', 'CBSE', 'ICSE', 'Other']
const INTER_BOARD_OPTIONS= ['Board of Intermediate Education, AP', 'State Board', 'CBSE', 'Other']
const COURSE_TYPES       = ['Intermediate', 'Diploma']
const ENTRANCE_EXAMS     = ['AP EAPCET', 'AP ECET', 'AP ICET', 'JEE Main', 'Other']
const SEAT_STATUS_OPTIONS= ['Management', 'Counselling', 'NRI', 'Other']

function val(v, fallback = '—') {
  if (v === null || v === undefined || v === '') return fallback
  return v
}

function errText(err, fallback) {
  const d = err?.response?.data?.detail
  if (Array.isArray(d)) return d.map((x) => x.msg || x).join(' ')
  return d || fallback
}

function DetailSection({ title, rows }) {
  return (
    <div className="asp-detail-section">
      <h4 className="asp-detail-title">{title}</h4>
      <div className="asp-detail-rows">
        {rows.map(([label, value]) => (
          <div key={label} className="asp-row">
            <span>{label}</span>
            <b>{val(value)}</b>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Field helpers ─────────────────────────────────────────────────────────────
function Field({ label, name, form, onChange, type = 'text', options, required }) {
  const v = form[name] ?? ''
  if (options) {
    return (
      <label className="asp-edit-field">
        <span>{label}{required && ' *'}</span>
        <select className="select" name={name} value={v} onChange={onChange}>
          <option value="">— Select —</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    )
  }
  if (type === 'textarea') {
    return (
      <label className="asp-edit-field asp-edit-field--wide">
        <span>{label}</span>
        <textarea className="textarea" name={name} value={v} rows={2} onChange={onChange} />
      </label>
    )
  }
  return (
    <label className="asp-edit-field">
      <span>{label}{required && ' *'}</span>
      <input className="input" type={type} name={name} value={v} onChange={onChange} />
    </label>
  )
}

// ── Edit slide-over panel ─────────────────────────────────────────────────────
function EditPanel({ student, onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name:                    student.full_name         ?? '',
    last_name:                    student.last_name         ?? '',
    phone:                        student.phone             ?? '',
    alt_email:                    student.alt_email         ?? '',
    date_of_birth:                student.date_of_birth     ?? '',
    category:                     student.category          ?? '',
    course:                       student.course            ?? '',
    batch:                        student.batch             ?? '',
    branch:                       student.branch            ?? '',
    section:                      student.section           ?? '',
    father_name:                  student.father_name       ?? '',
    father_occupation:            student.father_occupation ?? '',
    mother_name:                  student.mother_name       ?? '',
    mother_maiden_name:           student.mother_maiden_name ?? '',
    parent_mobile_no:             student.parent_mobile_no  ?? '',
    address_for_communication:    student.address_for_communication ?? '',
    hometown:                     student.hometown          ?? '',
    district:                     student.district          ?? '',
    state:                        student.state             ?? '',
    pincode:                      student.pincode           ?? '',
    stay_type:                    student.stay_type         ?? '',
    aadhar_no:                    student.aadhar_no         ?? '',
    name_as_per_aadhar:           student.name_as_per_aadhar ?? '',
    pan_number:                   student.pan_number        ?? '',
    ssc_school_name:              student.ssc_school_name   ?? '',
    ssc_board:                    student.ssc_board         ?? '',
    ssc_year_of_passing:          student.ssc_year_of_passing  ?? '',
    ssc_marks_obtained:           student.ssc_marks_obtained   ?? '',
    ssc_maximum_marks:            student.ssc_maximum_marks    ?? '',
    intermediate_course_type:     student.intermediate_course_type     ?? '',
    intermediate_college_name:    student.intermediate_college_name    ?? '',
    intermediate_board:           student.intermediate_board           ?? '',
    intermediate_year_of_passing: student.intermediate_year_of_passing ?? '',
    intermediate_marks_obtained:  student.intermediate_marks_obtained  ?? '',
    intermediate_maximum_marks:   student.intermediate_maximum_marks   ?? '',
    entrance_exam:                student.entrance_exam     ?? '',
    entrance_rank:                student.entrance_rank     ?? '',
    seat_status:                  student.seat_status       ?? '',
    education_gap_years:          student.education_gap_years  ?? '',
    education_gap_reason:         student.education_gap_reason ?? '',
    foreign_languages_known:      student.foreign_languages_known ?? '',
    skills:                       student.skills            ?? '',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [success, setSuccess] = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  async function save() {
    if (!form.full_name.trim()) { setError('Full Name is required.'); return }
    if (!form.phone.trim())     { setError('Phone is required.'); return }

    setSaving(true); setError(''); setSuccess('')
    // Send only non-empty strings (convert '' to null so backend treats them as unset)
    const payload = {}
    for (const [k, v] of Object.entries(form)) {
      if (v === '' || v === null || v === undefined) payload[k] = null
      else if (['ssc_year_of_passing','intermediate_year_of_passing','entrance_rank','education_gap_years'].includes(k))
        payload[k] = Number(v) || null
      else if (['ssc_marks_obtained','ssc_maximum_marks','intermediate_marks_obtained','intermediate_maximum_marks'].includes(k))
        payload[k] = parseFloat(v) || null
      else payload[k] = v
    }

    try {
      await api.put(`/students/${student.id}/admin-edit`, payload)
      setSuccess('Profile updated successfully.')
      onSaved()
    } catch (err) {
      setError(errText(err, 'Could not save changes.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="asp-panel-overlay" onClick={onClose}>
      <div className="asp-panel" onClick={(e) => e.stopPropagation()}>

        <div className="asp-panel-head">
          <div>
            <h3 className="asp-panel-title">Edit Student Profile</h3>
            <p className="asp-panel-sub muted">{student.full_name} · {student.register_number}</p>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>✕ Close</button>
        </div>

        {error   && <p className="alert alert-error"   style={{ margin: '0 24px 4px' }}>{error}</p>}
        {success && <p className="alert alert-success" style={{ margin: '0 24px 4px' }}>{success}</p>}

        <div className="asp-panel-body">

          <section className="asp-edit-section">
            <h4 className="asp-edit-section-title">Personal</h4>
            <div className="asp-edit-grid">
              <Field label="First Name"        name="full_name"    form={form} onChange={handleChange} required />
              <Field label="Last Name"          name="last_name"    form={form} onChange={handleChange} />
              <Field label="Phone"              name="phone"        form={form} onChange={handleChange} type="tel" required />
              <Field label="Alternative Email"  name="alt_email"    form={form} onChange={handleChange} type="email" />
              <Field label="Date of Birth"      name="date_of_birth" form={form} onChange={handleChange} type="date" />
              <Field label="Category"           name="category"     form={form} onChange={handleChange} options={CATEGORY_OPTIONS} />
            </div>
          </section>

          <section className="asp-edit-section">
            <h4 className="asp-edit-section-title">Academic</h4>
            <div className="asp-edit-grid">
              <Field label="Course"          name="course"  form={form} onChange={handleChange} />
              <Field label="Batch"           name="batch"   form={form} onChange={handleChange} />
              <Field label="Branch"          name="branch"  form={form} onChange={handleChange} />
              <Field label="Section"         name="section" form={form} onChange={handleChange} />
              <Field label="Stay Type"       name="stay_type" form={form} onChange={handleChange} options={STAY_TYPE_OPTIONS} />
              <Field label="Skills"          name="skills"  form={form} onChange={handleChange} type="textarea" />
              <Field label="Foreign Languages Known" name="foreign_languages_known" form={form} onChange={handleChange} />
            </div>
          </section>

          <section className="asp-edit-section">
            <h4 className="asp-edit-section-title">Family</h4>
            <div className="asp-edit-grid">
              <Field label="Father's Name"       name="father_name"       form={form} onChange={handleChange} />
              <Field label="Father's Occupation" name="father_occupation"  form={form} onChange={handleChange} />
              <Field label="Mother's Name"       name="mother_name"        form={form} onChange={handleChange} />
              <Field label="Mother's Maiden Name" name="mother_maiden_name" form={form} onChange={handleChange} />
              <Field label="Parent Mobile"       name="parent_mobile_no"  form={form} onChange={handleChange} type="tel" />
            </div>
          </section>

          <section className="asp-edit-section">
            <h4 className="asp-edit-section-title">Address</h4>
            <div className="asp-edit-grid">
              <Field label="Address for Communication" name="address_for_communication" form={form} onChange={handleChange} type="textarea" />
              <Field label="Hometown" name="hometown" form={form} onChange={handleChange} />
              <Field label="District" name="district" form={form} onChange={handleChange} />
              <Field label="State"    name="state"    form={form} onChange={handleChange} />
              <Field label="Pincode"  name="pincode"  form={form} onChange={handleChange} />
            </div>
          </section>

          <section className="asp-edit-section">
            <h4 className="asp-edit-section-title">Identity</h4>
            <div className="asp-edit-grid">
              <Field label="Aadhar Number"      name="aadhar_no"          form={form} onChange={handleChange} />
              <Field label="Name as per Aadhar" name="name_as_per_aadhar" form={form} onChange={handleChange} />
              <Field label="PAN Number"         name="pan_number"         form={form} onChange={handleChange} />
            </div>
          </section>

          <section className="asp-edit-section">
            <h4 className="asp-edit-section-title">SSC / Class X</h4>
            <div className="asp-edit-grid">
              <Field label="School Name"      name="ssc_school_name"    form={form} onChange={handleChange} />
              <Field label="Board"            name="ssc_board"          form={form} onChange={handleChange} options={BOARD_OPTIONS} />
              <Field label="Year of Passing"  name="ssc_year_of_passing" form={form} onChange={handleChange} type="number" />
              <Field label="Marks Obtained"   name="ssc_marks_obtained"  form={form} onChange={handleChange} type="number" />
              <Field label="Maximum Marks"    name="ssc_maximum_marks"   form={form} onChange={handleChange} type="number" />
            </div>
          </section>

          <section className="asp-edit-section">
            <h4 className="asp-edit-section-title">Intermediate / Diploma</h4>
            <div className="asp-edit-grid">
              <Field label="Course Type"     name="intermediate_course_type"     form={form} onChange={handleChange} options={COURSE_TYPES} />
              <Field label="College Name"    name="intermediate_college_name"    form={form} onChange={handleChange} />
              <Field label="Board"           name="intermediate_board"           form={form} onChange={handleChange} options={INTER_BOARD_OPTIONS} />
              <Field label="Year of Passing" name="intermediate_year_of_passing" form={form} onChange={handleChange} type="number" />
              <Field label="Marks Obtained"  name="intermediate_marks_obtained"  form={form} onChange={handleChange} type="number" />
              <Field label="Maximum Marks"   name="intermediate_maximum_marks"   form={form} onChange={handleChange} type="number" />
            </div>
          </section>

          <section className="asp-edit-section">
            <h4 className="asp-edit-section-title">Entrance &amp; Gap</h4>
            <div className="asp-edit-grid">
              <Field label="Entrance Exam"      name="entrance_exam"        form={form} onChange={handleChange} options={ENTRANCE_EXAMS} />
              <Field label="Entrance Rank"      name="entrance_rank"        form={form} onChange={handleChange} type="number" />
              <Field label="Seat Status"        name="seat_status"          form={form} onChange={handleChange} options={SEAT_STATUS_OPTIONS} />
              <Field label="Education Gap Years" name="education_gap_years" form={form} onChange={handleChange} type="number" />
              <Field label="Gap Reason"         name="education_gap_reason" form={form} onChange={handleChange} type="textarea" />
            </div>
          </section>

        </div>

        <div className="asp-panel-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

      </div>
    </div>
  )
}

// ── Delete confirmation modal ─────────────────────────────────────────────────
function DeleteModal({ student, onCancel, onDeleted }) {
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState('')

  const match = student.register_number

  async function doDelete() {
    if (confirmed.trim() !== match) {
      setError(`Type the register number exactly: ${match}`)
      return
    }
    setBusy(true); setError('')
    try {
      await api.delete(`/change-requests/admin/students/${student.id}`)
      onDeleted()
    } catch (err) {
      setError(errText(err, 'Deletion failed.'))
      setBusy(false)
    }
  }

  return (
    <div className="asp-modal-overlay" onClick={() => !busy && onCancel()}>
      <div className="asp-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="asp-modal-title">Delete student — are you sure?</h3>
        <p className="asp-modal-body">
          You are about to permanently delete <strong>{student.full_name}</strong> ({student.register_number}).
          This will remove their account, all change requests, notifications, and applications.
          <strong> This cannot be undone.</strong>
        </p>
        <p className="asp-modal-body">
          To confirm, type the student's register number: <code>{match}</code>
        </p>
        <input
          className="input"
          placeholder={match}
          value={confirmed}
          onChange={(e) => { setConfirmed(e.target.value); setError('') }}
          autoFocus
        />
        {error && <p className="alert alert-error" style={{ marginTop: 8 }}>{error}</p>}
        <div className="asp-modal-actions">
          <button className="btn btn-ghost" disabled={busy} onClick={onCancel}>Cancel</button>
          <button className="asp-delete-confirm" disabled={busy || confirmed.trim() !== match} onClick={doDelete}>
            {busy ? 'Deleting…' : 'Permanently delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminStudentProfile() {
  const { registerNumber } = useParams()
  const navigate = useNavigate()
  const [p, setP]           = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [resumeBusy, setResumeBusy] = useState(false)
  const [showEdit, setShowEdit]     = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState('')

  function load() {
    setLoading(true); setError('')
    api.get(`/students/by-register/${encodeURIComponent(registerNumber)}/full-profile`)
      .then((res) => setP(res.data))
      .catch((err) => setError(err?.response?.data?.detail || 'Student not found.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [registerNumber])

  function handleSaved() {
    setShowEdit(false)
    setSaveSuccess('Profile updated successfully.')
    load()
    setTimeout(() => setSaveSuccess(''), 4000)
  }

  function handleDeleted() {
    setShowDelete(false)
    navigate('/admin/students', { state: { deleted: p?.full_name } })
  }

  async function openResume() {
    if (!p) return
    try {
      const res = await api.get(`/students/${p.id}/resume/view`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      window.open(url, '_blank', 'noopener')
      setTimeout(() => window.URL.revokeObjectURL(url), 10000)
    } catch (err) {
      alert(err?.response?.data?.detail || 'Could not open resume.')
    }
  }

  async function downloadResume() {
    if (!p) return
    setResumeBusy(true)
    try {
      const res = await api.get(`/students/${p.id}/resume/download`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url
      a.download = `${p.register_number}-RESUME.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert(err?.response?.data?.detail || 'Could not download resume.')
    } finally {
      setResumeBusy(false)
    }
  }

  const initials = (p?.full_name || '?')
    .split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')

  return (
    <AppShell title="Student Profile">
      <div className="asp-topbar">
        <button className="asp-back" onClick={() => navigate('/admin/students')}>← Back to Student Search</button>
        {p && (
          <div className="asp-actions">
            <button className="btn btn-ghost" onClick={() => { setSaveSuccess(''); setShowEdit(true) }}>
              ✎ Edit Profile
            </button>
            <button className="asp-delete-btn" onClick={() => setShowDelete(true)}>
              🗑 Delete Student
            </button>
          </div>
        )}
      </div>

      {loading && <div className="skeleton" style={{ height: 240, borderRadius: 12 }} />}
      {error && <p className="alert alert-error">{error}</p>}
      {saveSuccess && <p className="alert alert-success">{saveSuccess}</p>}

      {p && (
        <>
          <div className="asp-top-grid">
            {/* Summary */}
            <section className="card asp-card">
              <div className="asp-main-top">
                <div className="asp-avatar asp-avatar-initials">{initials}</div>
                <div>
                  <h2 className="asp-name">{p.full_name}</h2>
                  <span className={`badge ${p.placement?.is_placed ? 'badge-success' : 'badge-warning'}`}>
                    {p.placement?.is_placed ? 'Placed' : 'Not placed yet'}
                  </span>
                </div>
              </div>
              <div className="asp-summary">
                <div className="asp-row"><span>Register Number</span><b>{val(p.register_number)}</b></div>
                <div className="asp-row"><span>Email</span><b>{val(p.email)}</b></div>
                <div className="asp-row"><span>Phone</span><b>{val(p.phone)}</b></div>
                <div className="asp-row"><span>CGPA</span><b>{val(p.cgpa)}</b></div>
                <div className="asp-row asp-row-last"><span>Branch</span><b>{val(p.branch)}</b></div>
              </div>
            </section>

            {/* Resume */}
            <section className="card asp-card">
              <h3 className="asp-card-title">Resume</h3>
              {p.has_resume ? (
                <div className="asp-resume-btns">
                  <button className="btn btn-ghost" onClick={openResume}>Open</button>
                  <button className="btn btn-primary" disabled={resumeBusy} onClick={downloadResume}>
                    {resumeBusy ? '…' : 'Download'}
                  </button>
                </div>
              ) : (
                <p className="muted" style={{ marginTop: 0 }}>No resume uploaded.</p>
              )}
            </section>

            {/* Placement */}
            <section className="card asp-card">
              <h3 className="asp-card-title">Placement Status</h3>
              {p.placement?.is_placed ? (
                <>
                  <div className="asp-row"><span>Status</span><b style={{ color: 'var(--success)' }}>Placed ✓</b></div>
                  <div className="asp-row"><span>Total Offers</span><b>{p.placement.total_offers}</b></div>
                  <div className="asp-row asp-row-last">
                    <span>Highest Package</span>
                    <b>{p.placement.highest_package != null ? `${p.placement.highest_package} LPA` : '—'}</b>
                  </div>
                </>
              ) : (
                <p className="muted" style={{ marginTop: 0 }}>Not placed yet.</p>
              )}
            </section>
          </div>

          {/* Full details (read-only) */}
          <div className="card asp-details-card">
            <DetailSection title="Personal & Registration" rows={[
              ['Name', p.full_name], ['Surname', p.last_name], ['Register Number', p.register_number],
              ['Email', p.email], ['Phone', p.phone], ['Date of Birth', p.date_of_birth],
              ['Alternative Email', p.alt_email], ['Category', p.category],
            ]} />
            <DetailSection title="Academic & Identity" rows={[
              ['Course', p.course], ['Batch', p.batch], ['Branch', p.branch], ['Section', p.section],
              ['Graduation Year', p.graduation_year], ['CGPA', p.cgpa], ['Skills', p.skills],
              ['Stay Type', p.stay_type], ['Aadhar Number', p.aadhar_no],
              ['Name as per Aadhar', p.name_as_per_aadhar], ['PAN Number', p.pan_number],
            ]} />
            <DetailSection title="Family & Address" rows={[
              ['Father Name', p.father_name], ['Father Occupation', p.father_occupation],
              ['Mother Name', p.mother_name], ['Mother Maiden Name', p.mother_maiden_name],
              ['Parent Mobile', p.parent_mobile_no], ['Address for Communication', p.address_for_communication],
              ['Hometown', p.hometown], ['District', p.district], ['State', p.state], ['Pincode', p.pincode],
            ]} />
            <DetailSection title="SSC / X Details" rows={[
              ['School Name', p.ssc_school_name], ['Board', p.ssc_board],
              ['Year of Passing', p.ssc_year_of_passing], ['Marks Obtained', p.ssc_marks_obtained],
              ['Maximum Marks', p.ssc_maximum_marks], ['Percentage', p.ssc_percentage],
            ]} />
            <DetailSection title="Intermediate / Diploma" rows={[
              ['Course Type', p.intermediate_course_type], ['College Name', p.intermediate_college_name],
              ['Board', p.intermediate_board], ['Year of Passing', p.intermediate_year_of_passing],
              ['Marks Obtained', p.intermediate_marks_obtained], ['Maximum Marks', p.intermediate_maximum_marks],
              ['Percentage', p.intermediate_percentage],
            ]} />
            <DetailSection title="Entrance & Gap" rows={[
              ['Entrance Exam', p.entrance_exam], ['Entrance Rank', p.entrance_rank],
              ['Seat Status', p.seat_status], ['Education Gap Years', p.education_gap_years],
              ['Education Gap Reason', p.education_gap_reason],
              ['Foreign Languages Known', p.foreign_languages_known],
            ]} />
            <DetailSection title={`Applications (${p.applications.length})`} rows={
              p.applications.length === 0
                ? [['Applications', 'None yet']]
                : p.applications.map((a) => [
                    a.opportunity_type === 'on_campus' ? 'On-campus' : 'Off-campus',
                    a.company_or_title || `#${a.opportunity_id}`,
                  ])
            } />
          </div>
        </>
      )}

      {showEdit && p && (
        <EditPanel student={p} onClose={() => setShowEdit(false)} onSaved={handleSaved} />
      )}

      {showDelete && p && (
        <DeleteModal student={p} onCancel={() => setShowDelete(false)} onDeleted={handleDeleted} />
      )}
    </AppShell>
  )
}