import { useState, useEffect } from "react";
import api from "../../services/api";
import AppShell from "../../components/AppShell/AppShell.jsx";
import "./PlacementRecords.css";

/**
 * PlacementRecords (admin / super_admin).
 *
 * Upload rules (enforced server-side, explained here for admin clarity):
 *   1. Only rows with Status = "Selected" are saved.
 *   2. Register number MUST match a student in the database — unmatched rows
 *      are rejected with a clear reason so the admin knows which students
 *      need to be registered first.
 *   3. Dedup: same student + same company upserts the row (no duplicates).
 *      Same student + different companies = multiple offers = correct.
 */
export default function PlacementRecords() {
  const [companies, setCompanies] = useState([]);
  const companyMap = {};
  companies.forEach((c) => { companyMap[c.id] = c.name; });

  const [years, setYears]       = useState([]);
  const [branches, setBranches] = useState([]);

  // upload
  const [file, setFile]           = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]       = useState(null);
  const [uploadError, setUploadError] = useState("");

  // get records
  const [year, setYear]           = useState("");
  const [branch, setBranch]       = useState("");
  const [companyId, setCompanyId] = useState("");
  const [records, setRecords]     = useState({ items: [], total: 0, page: 1, page_size: 25 });
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.get("/companies", { params: { page: 1, page_size: 500 } })
      .then((res) => {
        const items = (res.data.items || []).sort((a, b) => a.name.localeCompare(b.name));
        setCompanies(items);
      })
      .catch(() => {});

    api.get("/academic/batches")
      .then((res) => setYears((res.data || []).map((b) => String(b.graduation_year))))
      .catch(() => setYears([]));

    api.get("/academic/branches")
      .then((res) => setBranches((res.data || []).map((b) => b.code)))
      .catch(() => setBranches([]));
  }, []);

  function buildParams(extra = {}) {
    const params = { ...extra };
    if (year)      params.year       = Number(year);
    if (branch)    params.branch     = branch;
    if (companyId) params.company_id = Number(companyId);
    return params;
  }

  async function upload() {
    if (!file) { setUploadError("Choose a .csv or .xlsx file first."); return; }
    setUploading(true);
    setUploadError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/placement-records/upload", fd, {
        headers: { "Content-Type": undefined },
      });
      setResult(res.data);
      setFile(null);
    } catch (err) {
      setUploadError(err?.response?.data?.detail || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function fetchRecords(goToPage = 1) {
    setLoading(true);
    setFetchError("");
    try {
      const res = await api.get("/placement-records", {
        params: buildParams({ page: goToPage, page_size: 25 }),
      });
      setRecords(res.data);
      setPage(goToPage);
    } catch (err) {
      setFetchError(err?.response?.data?.detail || "Could not fetch records.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadExcel() {
    setDownloading(true);
    try {
      const res = await api.get("/placement-records/export", {
        params: buildParams(),
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "placement_records.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err?.response?.data?.detail || "Download failed.");
    } finally {
      setDownloading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil((records.total || 0) / (records.page_size || 25)));

  // Separate unmatched errors from other errors for clearer display
  const unmatchedErrors = (result?.errors || []).filter((e) =>
    e.reason?.toLowerCase().includes("not found in the student database")
  );
  const otherErrors = (result?.errors || []).filter((e) =>
    !e.reason?.toLowerCase().includes("not found in the student database")
  );

  return (
    <AppShell title="Placement Records">

      {/* ── Upload ─────────────────────────────────────────────────────── */}
      <section className="card pr-card">
        <h3 className="pr-card-title">Upload Placement Records</h3>

        <div className="pr-rules">
          <p className="pr-rule">
            <span className="pr-rule-icon">✓</span>
            Only rows where <strong>Status = Selected</strong> are saved.
          </p>
          <p className="pr-rule">
            <span className="pr-rule-icon">✓</span>
            Register number must match a student in the database — unmatched rows are rejected.
          </p>
          <p className="pr-rule">
            <span className="pr-rule-icon">✓</span>
            One student + one company = one record. Same student at 3 companies = 3 offers, counted as 1 unique placed student.
          </p>
        </div>

        <p className="muted pr-cols">
          Expected columns: <code>Register Number</code> · <code>Student Name</code> · <code>Department</code> ·
          <code>Company Name</code> · <code>Role</code> · <code>Package</code> · <code>Status</code>
        </p>

        <div className="pr-upload-row">
          <input
            type="file"
            accept=".csv,.xlsx"
            className="pr-file"
            onChange={(e) => { setFile(e.target.files[0] || null); setResult(null); }}
          />
          <button className="btn btn-primary" disabled={uploading || !file} onClick={upload}>
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>

        {uploadError && <p className="alert alert-error">{uploadError}</p>}

        {result && (
          <div className="pr-result">
            <div className="pr-stats">
              <Stat label="Inserted"   value={result.inserted}   color="var(--success)" />
              <Stat label="Updated"    value={result.updated}    color="var(--accent)" />
              <Stat label="Not Selected" value={result.skipped - (result.unmatched || 0)} color="var(--text-subtle)" />
              <Stat label="Unmatched"  value={result.unmatched || 0} color="var(--warning)" />
              <Stat label="Total Rows" value={result.total_rows} color="var(--text-muted)" />
            </div>

            {result.inserted + result.updated > 0 && (
              <p className="alert alert-success">
                ✓ {result.inserted + result.updated} record{result.inserted + result.updated > 1 ? "s" : ""} saved successfully.
              </p>
            )}

            {result.companies_created?.length > 0 && (
              <p className="muted pr-companies">
                New companies created: {result.companies_created.join(", ")}
              </p>
            )}

            {unmatchedErrors.length > 0 && (
              <div className="pr-errors pr-errors-warn">
                <strong>⚠ Unmatched students ({unmatchedErrors.length} rows not saved)</strong>
                <p className="pr-errors-hint">
                  These register numbers were not found in your student database.
                  Make sure the students are registered, then re-upload.
                </p>
                <ul>
                  {unmatchedErrors.map((e, i) => (
                    <li key={i}>Row {e.row}: {e.reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {otherErrors.length > 0 && (
              <div className="pr-errors">
                <strong>Skipped rows ({otherErrors.length})</strong>
                <ul>
                  {otherErrors.map((e, i) => (
                    <li key={i}>Row {e.row}: {e.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Get Records ────────────────────────────────────────────────── */}
      <section className="card pr-card">
        <h3 className="pr-card-title">View Records</h3>

        <div className="pr-filters">
          <select className="select pr-sel" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All Years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="select pr-sel" value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select className="select pr-sel-wide" value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">All Companies</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => fetchRecords(1)}>
            Search
          </button>
          <button className="btn btn-ghost" disabled={downloading} onClick={downloadExcel}>
            {downloading ? "Preparing…" : "⬇ Export Excel"}
          </button>
        </div>

        {fetchError && <p className="alert alert-error">{fetchError}</p>}
        {loading    && <p className="muted">Loading…</p>}

        {!loading && (
          <>
            {records.total > 0 && (
              <p className="pr-total-label">
                Showing {records.items.length} of {records.total} record{records.total > 1 ? "s" : ""}
              </p>
            )}

            <div className="pr-table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Register No.</th>
                    <th>Name</th>
                    <th>Branch</th>
                    <th>Year</th>
                    <th>Company</th>
                    <th>Role</th>
                    <th>Package (LPA)</th>
                  </tr>
                </thead>
                <tbody>
                  {records.items.map((r) => (
                    <tr key={r.id}>
                      <td><code>{r.roll_number}</code></td>
                      <td>{r.student_name || "—"}</td>
                      <td>{r.branch || "—"}</td>
                      <td>{r.graduation_year || "—"}</td>
                      <td>{companyMap[r.company_id] || "—"}</td>
                      <td>{r.role || "—"}</td>
                      <td>{r.package != null ? Number(r.package).toFixed(2) : "—"}</td>
                    </tr>
                  ))}
                  {records.items.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <span className="subtle">
                          {records.total === 0 && page === 1
                            ? "No records yet. Set filters and click Search, or upload records above."
                            : "No records match the current filters."}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {records.total > records.page_size && (
              <div className="pr-pager">
                <button className="btn btn-ghost" disabled={page <= 1}
                        onClick={() => fetchRecords(page - 1)}>← Prev</button>
                <span className="muted pr-page-info">
                  Page {records.page} of {totalPages}
                </span>
                <button className="btn btn-ghost" disabled={page >= totalPages}
                        onClick={() => fetchRecords(page + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </section>

    </AppShell>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="pr-stat">
      <div className="pr-stat-val" style={{ color }}>{value}</div>
      <div className="pr-stat-lbl">{label}</div>
    </div>
  );
}