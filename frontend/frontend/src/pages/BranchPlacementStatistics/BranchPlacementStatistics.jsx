import { useEffect, useMemo, useState } from 'react'
import AppShell from '../../components/AppShell/AppShell.jsx'
import api from '../../services/api.js'
import './BranchPlacementStatistics.css'

function BranchPlacementStatistics() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [branches, setBranches] = useState([])
  const [years, setYears] = useState([])
  const [branchFilter, setBranchFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [academicError, setAcademicError] = useState('')
  const [academicLoading, setAcademicLoading] = useState(false)

  const fetchReport = async (branch = branchFilter, graduationYear = yearFilter) => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const params = {}
      if (branch) params.branch = branch
      if (graduationYear) params.graduation_year = graduationYear
      const { data } = await api.get('/admin/reports/branch-placement-statistics', { params })
      setRows(data || [])
      setMessage('Report generated successfully.')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Unable to load the report right now.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()

    let active = true
    async function loadAcademic() {
      setAcademicLoading(true)
      setAcademicError('')
      try {
        const [branchesRes, batchesRes] = await Promise.all([
          api.get('/academic/branches'),
          api.get('/academic/batches'),
        ])
        if (!active) return
        setBranches(branchesRes.data || [])
        setYears(
          Array.from(
            new Set((batchesRes.data || []).map((b) => String(b.graduation_year)))
          ).sort((a, b) => Number(a) - Number(b))
        )
      } catch (err) {
        if (!active) return
        setAcademicError('Unable to load branch or batch options. Filters will remain empty until reloaded.')
      } finally {
        if (!active) return
        setAcademicLoading(false)
      }
    }
    loadAcademic()
    return () => {
      active = false
    }
  }, [])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        totalStudents: acc.totalStudents + Number(row.total_students || 0),
        eligibleStudents: acc.eligibleStudents + Number(row.eligible_students || 0),
        totalOffers: acc.totalOffers + Number(row.total_offers || 0),
        uniquePlacedStudents: acc.uniquePlacedStudents + Number(row.unique_placed_students || 0),
      }),
      { totalStudents: 0, eligibleStudents: 0, totalOffers: 0, uniquePlacedStudents: 0 }
    )
  }, [rows])

  const handleDownload = async () => {
    setDownloading(true)
    setError('')
    setMessage('')
    try {
      const params = {}
      if (branchFilter) params.branch = branchFilter
      if (yearFilter) params.graduation_year = yearFilter
      const response = await api.get('/admin/reports/branch-placement-statistics/export', {
        responseType: 'blob',
        params,
      })
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const link = document.createElement('a')
      const url = window.URL.createObjectURL(blob)
      link.href = url
      link.download = `branch-placement-statistics-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      setMessage('Excel file downloaded successfully.')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Unable to download the Excel report.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <AppShell title="Branch-wise Placement Statistics">
      <div className="bps-page">
        <div className="bps-card card">
          <div className="bps-header">
            <div className="bps-hero">
              <div className="bps-hero-icon">📊</div>
              <div>
                <h2 className="bps-title">Branch-wise Placement Statistics</h2>
                <p className="bps-subtitle">Eligibility rule: SSC ≥ 60%, Intermediate ≥ 60%, and B.Tech CGPA ≥ 6.5.</p>
              </div>
            </div>
            <div className="bps-actions">
              <label className="bps-filter">
                <span>Branch</span>
                <select className="select" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
                  <option value="">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.code} value={b.code}>{`${b.code} — ${b.name}`}</option>
                  ))}
                </select>
              </label>
              <label className="bps-filter">
                <span>Batch</span>
                <select className="select" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                  <option value="">All Batches</option>
                  {years.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </label>
              <button className="btn btn-secondary" onClick={() => fetchReport(branchFilter, yearFilter)} disabled={loading || academicLoading}>
                {loading ? 'Generating...' : 'Generate Report'}
              </button>
              <button className="btn btn-secondary" onClick={() => fetchReport(branchFilter, yearFilter)} disabled={loading || academicLoading}>
                Refresh
              </button>
              <button className="btn btn-primary" onClick={handleDownload} disabled={downloading || loading}>
                {downloading ? 'Preparing...' : 'Download Excel'}
              </button>
            </div>
          </div>

          {academicError && <div className="bps-error">{academicError}</div>}
          {message && <div className="bps-success">{message}</div>}
          {error && <div className="bps-error">{error}</div>}

          <div className="bps-summary-grid">
            <div className="bps-summary-card bps-card-accent-blue">
              <span>Total Students</span>
              <strong>{totals.totalStudents}</strong>
            </div>
            <div className="bps-summary-card bps-card-accent-green">
              <span>Eligible Students</span>
              <strong>{totals.eligibleStudents}</strong>
            </div>
            <div className="bps-summary-card bps-card-accent-purple">
              <span>Total Offers</span>
              <strong>{totals.totalOffers}</strong>
            </div>
            <div className="bps-summary-card bps-card-accent-orange">
              <span>Unique Placed</span>
              <strong>{totals.uniquePlacedStudents}</strong>
            </div>
          </div>

          <div className="bps-table-wrap">
            {loading ? (
              <div className="bps-loading">
                <div className="bps-spinner" />
                <span>Preparing the latest placement statistics...</span>
              </div>
            ) : rows.length === 0 ? (
              <div className="bps-empty">No data available for the selected report yet.</div>
            ) : (
              <table className="bps-table">
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>Total Students</th>
                    <th>Eligible (SSC ≥ 60%, Inter ≥ 60%, B.Tech ≥ 6.5)</th>
                    <th>Total Offers</th>
                    <th>Unique Placed Students</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.branch}>
                      <td>{row.branch}</td>
                      <td>{row.total_students}</td>
                      <td>{row.eligible_students}</td>
                      <td>{row.total_offers}</td>
                      <td>{row.unique_placed_students}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export default BranchPlacementStatistics
