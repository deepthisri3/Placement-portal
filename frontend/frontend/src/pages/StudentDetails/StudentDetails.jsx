import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api.js'
import './StudentDetails.css'

const BOARD_OPTIONS = ['State Board', 'CBSE', 'ICSE', 'Other']
const INTERMEDIATE_BOARD_OPTIONS = ['Board of Intermediate Education, AP', 'State Board', 'CBSE', 'Other']
const COURSE_TYPES = ['Intermediate', 'Diploma']
const ENTRANCE_EXAMS = ['AP EAPCET', 'AP ECET', 'AP ICET', 'JEE Main', 'Other']
const SEAT_STATUS_OPTIONS = ['Management', 'Counselling', 'NRI', 'Other']

const EMPTY = {
  full_name: '',
  last_name: '',
  register_number: '',
  branch: '',
  ssc_school_name: '',
  ssc_board: '',
  ssc_year_of_passing: '',
  ssc_marks_obtained: '',
  ssc_maximum_marks: '',
  ssc_percentage: '',
  intermediate_course_type: '',
  intermediate_college_name: '',
  intermediate_board: '',
  intermediate_year_of_passing: '',
  intermediate_marks_obtained: '',
  intermediate_maximum_marks: '',
  intermediate_percentage: '',
  entrance_exam: '',
  entrance_rank: '',
  seat_status: '',
  foreign_languages_known: '',
}

function calcPercentage(marks, maximumMarks) {
  const marksValue = Number(marks)
  const maxValue = Number(maximumMarks)
  if (!marksValue || !maxValue || maxValue <= 0) return ''
  return ((marksValue / maxValue) * 100).toFixed(2)
}

function isFilled(value) {
  return value !== '' && value !== null && value !== undefined
}

function validate(form) {
  const errors = {}

  if (form.full_name.trim().length < 2) errors.full_name = 'Enter your full name.'
  if (form.last_name.trim().length < 1) errors.last_name = 'Enter your surname.'
  if (!form.ssc_school_name.trim()) errors.ssc_school_name = 'Enter your school name.'
  if (!form.ssc_board) errors.ssc_board = 'Select a board.'
  if (!/^(19|20)\d{2}$/.test(String(form.ssc_year_of_passing))) errors.ssc_year_of_passing = 'Enter a valid year.'
  if (!isFilled(form.ssc_marks_obtained)) errors.ssc_marks_obtained = 'Enter marks obtained.'
  if (!isFilled(form.ssc_maximum_marks)) errors.ssc_maximum_marks = 'Enter maximum marks.'

  if (!form.intermediate_course_type) errors.intermediate_course_type = 'Select course type.'
  if (!form.intermediate_college_name.trim()) errors.intermediate_college_name = 'Enter college name.'
  if (!form.intermediate_board) errors.intermediate_board = 'Select a board.'
  if (!/^(19|20)\d{2}$/.test(String(form.intermediate_year_of_passing))) errors.intermediate_year_of_passing = 'Enter a valid year.'
  if (!isFilled(form.intermediate_marks_obtained)) errors.intermediate_marks_obtained = 'Enter marks obtained.'
  if (!isFilled(form.intermediate_maximum_marks)) errors.intermediate_maximum_marks = 'Enter maximum marks.'

  if (!form.seat_status) errors.seat_status = 'Choose seat status.'
  if (isFilled(form.entrance_rank) && Number(form.entrance_rank) < 0) errors.entrance_rank = 'Rank must be zero or greater.'
  return errors
}

function StudentDetails() {
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [readonly, setReadonly] = useState({ register_number: '', branch: '' })

  useEffect(() => {
    api.get('/students/me/details')
      .then((res) => {
        const d = res.data || {}
        setReadonly({
          register_number: d.register_number || '',
          branch: d.branch || '',
        })
        setForm({
          ...EMPTY,
          ...Object.fromEntries(Object.keys(EMPTY).map((key) => [key, d[key] ?? ''])),
        })
      })
      .catch((err) => setError(err?.response?.data?.detail || 'Could not load your details.'))
      .finally(() => setLoading(false))
  }, [])

  const computedSscPercentage = useMemo(
    () => calcPercentage(form.ssc_marks_obtained, form.ssc_maximum_marks),
    [form.ssc_marks_obtained, form.ssc_maximum_marks],
  )
  const computedIntermediatePercentage = useMemo(
    () => calcPercentage(form.intermediate_marks_obtained, form.intermediate_maximum_marks),
    [form.intermediate_marks_obtained, form.intermediate_maximum_marks],
  )
  const computedGapYears = useMemo(() => {
    const sscYear = Number(form.ssc_year_of_passing)
    const intermediateYear = Number(form.intermediate_year_of_passing)
    if (!sscYear || !intermediateYear) return ''
    return String(Math.max(intermediateYear - sscYear - 2, 0))
  }, [form.ssc_year_of_passing, form.intermediate_year_of_passing])

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function extractError(err, fallback) {
    const detail = err?.response?.data?.detail
    if (Array.isArray(detail)) return detail.map((d) => d.msg).join(' ')
    return detail || fallback
  }

  async function save() {
    const validationErrors = validate(form)
    setError('')
    setSuccess('')
    if (Object.keys(validationErrors).length > 0) {
      setError(Object.values(validationErrors).join(' '))
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        ssc_percentage: computedSscPercentage || null,
        intermediate_percentage: computedIntermediatePercentage || null,
        education_gap_years: computedGapYears === '' ? null : Number(computedGapYears),
      }

      Object.keys(payload).forEach((key) => {
        if (payload[key] === '') payload[key] = null
      })

      const res = await api.put('/students/me/details', payload)
      const d = res.data || {}
      setForm({
        ...EMPTY,
        ...Object.fromEntries(Object.keys(EMPTY).map((key) => [key, d[key] ?? ''])),
      })
      setSuccess('Educational details saved. Redirecting to the portal...')
      setTimeout(() => navigate('/student/dashboard'), 500)
    } catch (err) {
      setError(extractError(err, 'Could not save your details.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="ed-page"><div className="ed-card skeleton" style={{ height: 420, borderRadius: 16 }} /></div>
  }

  return (
    <div className="ed-page">
      <div className="ed-card">
        <div className="ed-head">
          <div>
            <p className="ed-kicker">Student Information</p>
            <h1 className="ed-title">Educational Details Form</h1>
          </div>
          <p className="ed-note">Fill this once to unlock the placement portal.</p>
        </div>

        {error && <p className="alert alert-error">{error}</p>}
        {success && <p className="alert alert-success">{success}</p>}

        <div className="ed-section">
          <h2>Student Information</h2>
          <div className="ed-grid ed-grid-2">
            <Field label="Registered Number"><input className="input" value={readonly.register_number} readOnly /></Field>
            <Field label="Branch"><input className="input" value={readonly.branch} readOnly /></Field>
            <Field label="Full Name *"><input className="input" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="e.g. Deepthi Sri Valli" /></Field>
            <Field label="Last Name (Surname) *"><input className="input" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} placeholder="e.g. Kandulapati" /></Field>
          </div>
        </div>

        <div className="ed-section">
          <h2>SSC / X Details</h2>
          <div className="ed-grid ed-grid-3">
            <Field label="School Name *" full><input className="input" value={form.ssc_school_name} onChange={(e) => set('ssc_school_name', e.target.value)} placeholder="Enter School Name" /></Field>
            <Field label="Board *">
              <select className="select" value={form.ssc_board} onChange={(e) => set('ssc_board', e.target.value)}>
                <option value="">-Select Board-</option>
                {BOARD_OPTIONS.map((board) => <option key={board} value={board}>{board}</option>)}
              </select>
            </Field>
            <Field label="Year of Passing *"><input className="input" value={form.ssc_year_of_passing} onChange={(e) => set('ssc_year_of_passing', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="YYYY" /></Field>
            <Field label="Marks Obtained *"><input className="input" value={form.ssc_marks_obtained} onChange={(e) => set('ssc_marks_obtained', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="e.g. 458" /></Field>
            <Field label="Maximum Marks *"><input className="input" value={form.ssc_maximum_marks} onChange={(e) => set('ssc_maximum_marks', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="e.g. 600" /></Field>
            <Field label="Percentage (%)"><input className="input" value={computedSscPercentage} readOnly placeholder="Auto" /></Field>
          </div>
        </div>

        <div className="ed-section">
          <h2>Intermediate / Diploma</h2>
          <div className="ed-grid ed-grid-3">
            <Field label="Course Type *">
              <select className="select" value={form.intermediate_course_type} onChange={(e) => set('intermediate_course_type', e.target.value)}>
                <option value="">-Select Course Type-</option>
                {COURSE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="College Name *" full><input className="input" value={form.intermediate_college_name} onChange={(e) => set('intermediate_college_name', e.target.value)} placeholder="Enter College Name" /></Field>
            <Field label="Board *">
              <select className="select" value={form.intermediate_board} onChange={(e) => set('intermediate_board', e.target.value)}>
                <option value="">-Select Board-</option>
                {INTERMEDIATE_BOARD_OPTIONS.map((board) => <option key={board} value={board}>{board}</option>)}
              </select>
            </Field>
            <Field label="Year of Passing *"><input className="input" value={form.intermediate_year_of_passing} onChange={(e) => set('intermediate_year_of_passing', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="YYYY" /></Field>
            <Field label="Marks Obtained *"><input className="input" value={form.intermediate_marks_obtained} onChange={(e) => set('intermediate_marks_obtained', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="e.g. 885" /></Field>
            <Field label="Maximum Marks *"><input className="input" value={form.intermediate_maximum_marks} onChange={(e) => set('intermediate_maximum_marks', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="e.g. 1000" /></Field>
            <Field label="Percentage (%)"><input className="input" value={computedIntermediatePercentage} readOnly placeholder="Auto" /></Field>
          </div>
        </div>

        <div className="ed-section">
          <h2>Entrance Exam</h2>
          <div className="ed-grid ed-grid-3">
            <Field label="Entrance Exam (Optional)">
              <select className="select" value={form.entrance_exam} onChange={(e) => set('entrance_exam', e.target.value)}>
                <option value="">-Select Entrance Exam-</option>
                {ENTRANCE_EXAMS.map((exam) => <option key={exam} value={exam}>{exam}</option>)}
              </select>
            </Field>
            <Field label="Rank"><input className="input" value={form.entrance_rank} onChange={(e) => set('entrance_rank', e.target.value.replace(/\D/g, ''))} placeholder="Enter Rank" /></Field>
            <Field label="Seat Status *">
              <select className="select" value={form.seat_status} onChange={(e) => set('seat_status', e.target.value)}>
                <option value="">-Select Seat Status-</option>
                {SEAT_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div className="ed-section">
          <h2>Education Gap (Auto)</h2>
          <div className="ed-grid ed-grid-2">
            <Field label="Gap Years" full><input className="input" value={computedGapYears} readOnly placeholder="Auto-calculated from passing years" /></Field>
          </div>
        </div>

        <div className="ed-section">
          <h2>Foreign Languages Known</h2>
          <Field label="Foreign Languages Known"><input className="input" value={form.foreign_languages_known} onChange={(e) => set('foreign_languages_known', e.target.value)} placeholder="e.g. French, German, English" /></Field>
        </div>

        <div className="ed-actions">
          <button className="btn btn-secondary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save Details'}</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, full }) {
  return (
    <div className={`ed-field ${full ? 'ed-field-full' : ''}`}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  )
}

export default StudentDetails