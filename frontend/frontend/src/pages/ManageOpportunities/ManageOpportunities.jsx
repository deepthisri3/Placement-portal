import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.js'
import AppShell from '../../components/AppShell/AppShell.jsx'
import './ManageOpportunities.css'

const EMPTY_ON_CAMPUS_FORM = {
  company_name: '',
  is_existing_company: false,
  registration_link: '',
  last_date_to_apply: '',
  eligibility_criteria: '',
  package_offered: '',
  target_graduation_years: [],
  target_branches: [],
}
const EMPTY_OFF_CAMPUS_FORM = {
  title: '',
  description: '',
  link: '',
  photo_url: '',
  last_date_to_apply: '',
  target_graduation_years: [],
  target_branches: [],
}

function formatDeadline(isoString) {
  return new Date(isoString).toLocaleString()
}
function isExpired(isoString) {
  return new Date(isoString) < new Date()
}
function toDatetimeLocalValue(isoString) {
  const d = new Date(isoString)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function TargetSelector({ label, options, selected, onChange, emptyText }) {
  function toggle(value) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }
  return (
    <div className="mo-field">
      <label className="field-label">{label}</label>
      {options.length === 0 ? (
        <p className="mo-hint">{emptyText || 'No options available.'}</p>
      ) : (
        <div className="mo-target-options">
          {options.map((opt) => (
            <label key={opt} className={`mo-chip ${selected.includes(opt) ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      )}
      <p className="mo-hint">Leave all unchecked to show this to everyone.</p>
    </div>
  )
}

function ManageOpportunities() {
  const [activeTab, setActiveTab] = useState('on-campus')
  const [onCampusList, setOnCampusList] = useState([])
  const [offCampusList, setOffCampusList] = useState([])
  const [years, setYears] = useState([])
  const [branches, setBranches] = useState([])
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [listError, setListError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [onCampusForm, setOnCampusForm] = useState(EMPTY_ON_CAMPUS_FORM)
  const [offCampusForm, setOffCampusForm] = useState(EMPTY_OFF_CAMPUS_FORM)
  const [isPosting, setIsPosting] = useState(false)
  const [formError, setFormError] = useState('')

  async function loadLists() {
    setIsLoadingList(true)
    setListError('')
    try {
      const [onCampusRes, offCampusRes] = await Promise.all([
        api.get('/opportunities/on-campus?include_expired=true'),
        api.get('/opportunities/off-campus?include_expired=true'),
      ])
      setOnCampusList(onCampusRes.data)
      setOffCampusList(offCampusRes.data)
    } catch (err) {
      const detail = err.response?.data?.detail
      setListError(typeof detail === 'string' ? detail : 'Could not load opportunities.')
    } finally {
      setIsLoadingList(false)
    }
  }

  useEffect(() => {
    loadLists()
    // Batches (graduation years) and branches now come from the admin-managed tables.
    api.get('/academic/batches')
      .then((res) => setYears((res.data || []).map((b) => String(b.graduation_year))))
      .catch(() => setYears([]))
    api.get('/academic/branches')
      .then((res) => setBranches((res.data || []).map((b) => b.code)))
      .catch(() => setBranches([]))
  }, [])

  function extractErrorMessage(err, fallback) {
    const detail = err.response?.data?.detail
    if (Array.isArray(detail)) return detail.map((d) => d.msg).join(' ')
    return detail || fallback
  }

  function startCreating() {
    setEditingId(null)
    setOnCampusForm(EMPTY_ON_CAMPUS_FORM)
    setOffCampusForm(EMPTY_OFF_CAMPUS_FORM)
    setFormError('')
    setShowForm((prev) => (editingId !== null ? true : !prev))
  }

  function startEditingOnCampus(item) {
    setEditingId(item.id)
    setOnCampusForm({
      company_name: item.company_name,
      is_existing_company: item.is_existing_company,
      registration_link: item.registration_link,
      last_date_to_apply: toDatetimeLocalValue(item.last_date_to_apply),
      eligibility_criteria: item.eligibility_criteria || '',
      package_offered: item.package_offered ?? '',
      target_graduation_years: item.target_graduation_years || [],
      target_branches: item.target_branches || [],
    })
    setFormError('')
    setShowForm(true)
  }

  function startEditingOffCampus(item) {
    setEditingId(item.id)
    setOffCampusForm({
      title: item.title,
      description: item.description || '',
      link: item.link,
      photo_url: item.photo_url || '',
      last_date_to_apply: toDatetimeLocalValue(item.last_date_to_apply),
      target_graduation_years: item.target_graduation_years || [],
      target_branches: item.target_branches || [],
    })
    setFormError('')
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setFormError('')
  }

  async function handleOnCampusSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!onCampusForm.company_name.trim() || !onCampusForm.registration_link.trim() || !onCampusForm.last_date_to_apply) {
      setFormError('Company name, registration link, and deadline are required.')
      return
    }
    const payload = {
      company_name: onCampusForm.company_name,
      is_existing_company: onCampusForm.is_existing_company,
      registration_link: onCampusForm.registration_link,
      last_date_to_apply: onCampusForm.last_date_to_apply,
      eligibility_criteria: onCampusForm.eligibility_criteria || null,
      package_offered: onCampusForm.package_offered === '' ? null : Number(onCampusForm.package_offered),
      target_graduation_years: onCampusForm.target_graduation_years,
      target_branches: onCampusForm.target_branches,
    }
    setIsPosting(true)
    try {
      if (editingId !== null) {
        await api.put(`/opportunities/on-campus/${editingId}`, payload)
      } else {
        await api.post('/opportunities/on-campus', payload)
      }
      setOnCampusForm(EMPTY_ON_CAMPUS_FORM)
      setShowForm(false)
      setEditingId(null)
      loadLists()
    } catch (err) {
      setFormError(extractErrorMessage(err, 'Could not save this opportunity.'))
    } finally {
      setIsPosting(false)
    }
  }

  async function handleOffCampusSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!offCampusForm.title.trim() || !offCampusForm.link.trim() || !offCampusForm.last_date_to_apply) {
      setFormError('Title, link, and deadline are required.')
      return
    }
    const payload = {
      title: offCampusForm.title,
      description: offCampusForm.description || null,
      link: offCampusForm.link,
      photo_url: offCampusForm.photo_url || null,
      last_date_to_apply: offCampusForm.last_date_to_apply,
      target_graduation_years: offCampusForm.target_graduation_years,
      target_branches: offCampusForm.target_branches,
    }
    setIsPosting(true)
    try {
      if (editingId !== null) {
        await api.put(`/opportunities/off-campus/${editingId}`, payload)
      } else {
        await api.post('/opportunities/off-campus', payload)
      }
      setOffCampusForm(EMPTY_OFF_CAMPUS_FORM)
      setShowForm(false)
      setEditingId(null)
      loadLists()
    } catch (err) {
      setFormError(extractErrorMessage(err, 'Could not save this opportunity.'))
    } finally {
      setIsPosting(false)
    }
  }

  function switchTab(tab) {
    setActiveTab(tab)
    setShowForm(false)
    setEditingId(null)
    setFormError('')
  }

  const currentList = activeTab === 'on-campus' ? onCampusList : offCampusList

  return (
    <AppShell title="Manage Opportunities">
      <div className="mo-head">
        <div className="mo-tabs">
          <button className={`mo-tab ${activeTab === 'on-campus' ? 'active' : ''}`} onClick={() => switchTab('on-campus')}>
            On-Campus
          </button>
          <button className={`mo-tab ${activeTab === 'off-campus' ? 'active' : ''}`} onClick={() => switchTab('off-campus')}>
            Off-Campus
          </button>
        </div>
        <button className="btn btn-primary" onClick={showForm ? cancelForm : startCreating}>
          {showForm ? 'Cancel' : activeTab === 'on-campus' ? '+ Post Company' : '+ Post Internship'}
        </button>
      </div>

      {showForm && activeTab === 'on-campus' && (
        <form className="card mo-form" onSubmit={handleOnCampusSubmit} noValidate>
          <h3 className="mo-form-title">{editingId !== null ? 'Edit Opportunity' : 'Post New Opportunity'}</h3>
          {formError && <p className="alert alert-error">{formError}</p>}
          <div className="mo-field">
            <label className="field-label">Company name</label>
            <input className="input" type="text" value={onCampusForm.company_name}
              onChange={(e) => setOnCampusForm({ ...onCampusForm, company_name: e.target.value })} placeholder="e.g. TCS" />
          </div>
          <label className="mo-check">
            <input type="checkbox" checked={onCampusForm.is_existing_company}
              onChange={(e) => setOnCampusForm({ ...onCampusForm, is_existing_company: e.target.checked })} />
            <span>Existing company (has visited before)</span>
          </label>
          <div className="mo-field">
            <label className="field-label">Registration link</label>
            <input className="input" type="text" value={onCampusForm.registration_link}
              onChange={(e) => setOnCampusForm({ ...onCampusForm, registration_link: e.target.value })} placeholder="https://..." />
          </div>
          <div className="mo-field">
            <label className="field-label">Last date to apply</label>
            <input className="input" type="datetime-local" value={onCampusForm.last_date_to_apply}
              onChange={(e) => setOnCampusForm({ ...onCampusForm, last_date_to_apply: e.target.value })} />
            <p className="mo-hint">Select both a date and a time (e.g. 23:59 for end of day).</p>
          </div>
          <div className="mo-field">
            <label className="field-label">Eligibility criteria</label>
            <textarea className="textarea" value={onCampusForm.eligibility_criteria}
              onChange={(e) => setOnCampusForm({ ...onCampusForm, eligibility_criteria: e.target.value })}
              placeholder="e.g. CGPA >= 7, CSE/IT only, no active backlogs" rows={3} />
          </div>
          <div className="mo-field">
            <label className="field-label">Package offered (optional — usually filled in after the drive)</label>
            <input className="input" type="number" step="0.01" value={onCampusForm.package_offered}
              onChange={(e) => setOnCampusForm({ ...onCampusForm, package_offered: e.target.value })} placeholder="e.g. 6.5" />
          </div>
          <TargetSelector label="Target batches (graduation year)" options={years}
            selected={onCampusForm.target_graduation_years}
            onChange={(v) => setOnCampusForm({ ...onCampusForm, target_graduation_years: v })}
            emptyText="No batches added yet. Add them in Manage Branches & Batches." />
          <TargetSelector label="Target branches" options={branches}
            selected={onCampusForm.target_branches}
            onChange={(v) => setOnCampusForm({ ...onCampusForm, target_branches: v })}
            emptyText="No branches added yet. Add them in Manage Branches & Batches." />
          <button type="submit" className="btn btn-primary btn-block" disabled={isPosting}>
            {isPosting ? 'Saving…' : editingId !== null ? 'Save Changes' : 'Post Opportunity'}
          </button>
        </form>
      )}

      {showForm && activeTab === 'off-campus' && (
        <form className="card mo-form" onSubmit={handleOffCampusSubmit} noValidate>
          <h3 className="mo-form-title">{editingId !== null ? 'Edit Opportunity' : 'Post New Opportunity'}</h3>
          {formError && <p className="alert alert-error">{formError}</p>}
          <div className="mo-field">
            <label className="field-label">Title</label>
            <input className="input" type="text" value={offCampusForm.title}
              onChange={(e) => setOffCampusForm({ ...offCampusForm, title: e.target.value })} placeholder="e.g. Flipkart GRiD" />
          </div>
          <div className="mo-field">
            <label className="field-label">Description</label>
            <textarea className="textarea" value={offCampusForm.description}
              onChange={(e) => setOffCampusForm({ ...offCampusForm, description: e.target.value })} rows={3} />
          </div>
          <div className="mo-field">
            <label className="field-label">Link</label>
            <input className="input" type="text" value={offCampusForm.link}
              onChange={(e) => setOffCampusForm({ ...offCampusForm, link: e.target.value })} placeholder="https://..." />
          </div>
          <div className="mo-field">
            <label className="field-label">Photo URL (optional)</label>
            <input className="input" type="text" value={offCampusForm.photo_url}
              onChange={(e) => setOffCampusForm({ ...offCampusForm, photo_url: e.target.value })} placeholder="https://..." />
          </div>
          <div className="mo-field">
            <label className="field-label">Last date to apply</label>
            <input className="input" type="datetime-local" value={offCampusForm.last_date_to_apply}
              onChange={(e) => setOffCampusForm({ ...offCampusForm, last_date_to_apply: e.target.value })} />
            <p className="mo-hint">Select both a date and a time (e.g. 23:59 for end of day).</p>
          </div>
          <TargetSelector label="Target batches (graduation year)" options={years}
            selected={offCampusForm.target_graduation_years}
            onChange={(v) => setOffCampusForm({ ...offCampusForm, target_graduation_years: v })}
            emptyText="No batches added yet. Add them in Manage Branches & Batches." />
          <TargetSelector label="Target branches" options={branches}
            selected={offCampusForm.target_branches}
            onChange={(v) => setOffCampusForm({ ...offCampusForm, target_branches: v })}
            emptyText="No branches added yet. Add them in Manage Branches & Batches." />
          <button type="submit" className="btn btn-primary btn-block" disabled={isPosting}>
            {isPosting ? 'Saving…' : editingId !== null ? 'Save Changes' : 'Post Opportunity'}
          </button>
        </form>
      )}

      <div className="mo-list">
        {isLoadingList && <p className="muted">Loading…</p>}
        {listError && <p className="alert alert-error">{listError}</p>}
        {!isLoadingList && !listError && currentList.length === 0 && (
          <div className="mo-empty">Nothing posted yet.</div>
        )}
        {!isLoadingList && currentList.length > 0 && (
          <div className="card mo-table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{activeTab === 'on-campus' ? 'Company' : 'Title'}</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {currentList.map((item) => {
                  const expired = isExpired(item.last_date_to_apply)
                  return (
                    <tr key={item.id}>
                      <td>{activeTab === 'on-campus' ? item.company_name : item.title}</td>
                      <td>{formatDeadline(item.last_date_to_apply)}</td>
                      <td>
                        <span className={`badge ${expired ? 'badge-danger' : 'badge-success'}`}>
                          {expired ? 'Closed' : 'Open'}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-ghost mo-sm"
                          onClick={() => activeTab === 'on-campus' ? startEditingOnCampus(item) : startEditingOffCampus(item)}>
                          Edit
                        </button>
                      </td>
                      <td>
                        <Link
                          to={`/admin/opportunities/${activeTab}/${item.id}/applicants`}
                          state={{ label: activeTab === 'on-campus' ? item.company_name : item.title }}
                          className="mo-link"
                        >
                          View Applicants →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  )
}

export default ManageOpportunities