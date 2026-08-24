import { useEffect, useRef, useState } from "react";
import api from "../../services/api";
import AppShell from "../../components/AppShell/AppShell.jsx";
import "./SendNotification.css";

// ── Cluster form (create / edit) ─────────────────────────────────────────────
function ClusterForm({ existing, onSaved, onCancel }) {
  const [name, setName] = useState(existing?.name || "");
  const [members, setMembers] = useState([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const boxRef = useRef(null);

  useEffect(() => {
    if (!existing) return;
    api.get(`/clusters/${existing.id}`)
      .then((res) => setMembers(res.data.members || []))
      .catch(() => {});
  }, [existing]);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.get("/students/search", { params: { q: term } });
        setResults(res.data || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function addMember(s) {
    if (members.find((m) => m.id === s.id)) return;
    setMembers((prev) => [...prev, s]);
    setQ(""); setResults([]); setOpen(false);
  }

  function removeMember(id) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  async function save() {
    setErr("");
    if (!name.trim()) { setErr("Cluster name is required."); return; }
    if (members.length === 0) { setErr("Add at least one student."); return; }
    setBusy(true);
    try {
      const payload = { name: name.trim(), student_ids: members.map((m) => m.id) };
      if (existing) {
        await api.put(`/clusters/${existing.id}`, payload);
      } else {
        await api.post("/clusters", payload);
      }
      onSaved();
    } catch (e) {
      const d = e?.response?.data?.detail;
      setErr(Array.isArray(d) ? d.map((x) => x.msg).join(" ") : (d || "Could not save cluster."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sn-cluster-form card">
      <h4 className="sn-cluster-form-title">{existing ? "Edit Cluster" : "New Cluster"}</h4>
      {err && <p className="alert alert-error">{err}</p>}

      <label className="field-label">Cluster name</label>
      <input className="input sn-mb" placeholder="e.g. Aptitude Training Group"
             value={name} onChange={(e) => setName(e.target.value)} />

      <label className="field-label">Search & add students</label>
      <div ref={boxRef} className="mc-search-box">
        <input className="input" placeholder="Search by name, register no, branch…"
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
                <div className="mc-drop-name">{s.full_name || "—"}</div>
                <div className="mc-drop-meta">
                  {s.register_number}{s.branch ? ` · ${s.branch}` : ""}{s.email ? ` · ${s.email}` : ""}
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
              <span className="mc-chip-meta">{m.register_number}{m.branch ? ` · ${m.branch}` : ""}</span>
            </div>
            <button className="mc-chip-remove" onClick={() => removeMember(m.id)}>×</button>
          </div>
        ))}
      </div>

      <div className="sn-cluster-form-actions">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : existing ? "Save Changes" : "Create Cluster"}
        </button>
      </div>
    </div>
  );
}

// ── Cluster list ─────────────────────────────────────────────────────────────
function ClusterManager({ clusters, onRefresh, onSelectForNotif }) {
  const [formMode, setFormMode] = useState(null); // null | 'create' | cluster-object
  const [deleting, setDeleting] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteErr, setDeleteErr] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function doDelete() {
    if (deleteConfirm.trim() !== deleting.name) {
      setDeleteErr(`Type the cluster name exactly: ${deleting.name}`);
      return;
    }
    setDeleteBusy(true);
    try {
      await api.delete(`/clusters/${deleting.id}`);
      setDeleting(null);
      setDeleteConfirm("");
      onRefresh();
    } catch (err) {
      setDeleteErr(err?.response?.data?.detail || "Could not delete cluster.");
    } finally {
      setDeleteBusy(false);
    }
  }

  if (formMode) {
    return (
      <ClusterForm
        existing={formMode === "create" ? null : formMode}
        onSaved={() => { setFormMode(null); onRefresh(); }}
        onCancel={() => setFormMode(null)}
      />
    );
  }

  return (
    <div className="sn-cluster-manager">
      <div className="sn-cluster-manager-head">
        <span className="sn-cluster-manager-label">Clusters</span>
        <button className="btn btn-ghost sn-cluster-new" onClick={() => setFormMode("create")}>
          + New Cluster
        </button>
      </div>

      {clusters.length === 0 ? (
        <p className="subtle" style={{ margin: "8px 0" }}>No clusters yet. Create one above.</p>
      ) : (
        <div className="sn-cluster-list">
          {clusters.map((c) => (
            <div key={c.id} className="sn-cluster-row">
              <div className="sn-cluster-info">
                <span className="sn-cluster-name">{c.name}</span>
                <span className="sn-cluster-count">{c.member_count} student{c.member_count !== 1 ? "s" : ""}</span>
              </div>
              <div className="sn-cluster-row-actions">
                <button className="btn btn-ghost sn-cluster-sm" onClick={() => onSelectForNotif(c)}>
                  Select
                </button>
                <button className="btn btn-ghost sn-cluster-sm" onClick={() => setFormMode(c)}>
                  Edit
                </button>
                <button className="sn-cluster-del" onClick={() => { setDeleting(c); setDeleteConfirm(""); setDeleteErr(""); }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleting && (
        <div className="sn-del-overlay" onClick={() => !deleteBusy && setDeleting(null)}>
          <div className="sn-del-modal" onClick={(e) => e.stopPropagation()}>
            <h4 className="sn-del-title">Delete cluster?</h4>
            <p className="sn-del-body">
              Deleting <strong>{deleting.name}</strong> removes it permanently. Type the cluster name to confirm.
            </p>
            <input
              className="input"
              placeholder={deleting.name}
              value={deleteConfirm}
              onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteErr(""); }}
              autoFocus
            />
            {deleteErr && <p className="alert alert-error" style={{ marginTop: 8 }}>{deleteErr}</p>}
            <div className="sn-del-actions">
              <button className="btn btn-ghost" disabled={deleteBusy} onClick={() => setDeleting(null)}>Cancel</button>
              <button
                className="sn-del-confirm"
                disabled={deleteBusy || deleteConfirm.trim() !== deleting.name}
                onClick={doDelete}
              >
                {deleteBusy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SendNotification() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState("all");
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [clusterId, setClusterId] = useState("");
  const [years, setYears] = useState([]);
  const [branches, setBranches] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [showClusters, setShowClusters] = useState(false);

  async function loadClusters() {
    try {
      const res = await api.get("/clusters");
      const cs = res.data || [];
      setClusters(cs);
      // keep current selection valid
      if (clusterId && !cs.find((c) => String(c.id) === clusterId)) {
        setClusterId(cs.length ? String(cs[0].id) : "");
      } else if (!clusterId && cs.length) {
        setClusterId(String(cs[0].id));
      }
    } catch { setClusters([]); }
  }

  useEffect(() => {
    api.get("/academic/batches")
      .then((res) => {
        const ys = (res.data || []).map((b) => String(b.graduation_year));
        setYears(ys);
        if (ys.length) setYear(ys[0]);
      })
      .catch(() => setYears([]));

    api.get("/academic/branches")
      .then((res) => {
        const bs = (res.data || []).map((b) => b.code);
        setBranches(bs);
        if (bs.length) setBranch(bs[0]);
      })
      .catch(() => setBranches([]));

    loadClusters();
  }, []);

  const needsBranch  = targetType === "branch" || targetType === "year_branch";
  const needsYear    = targetType === "year"   || targetType === "year_branch";
  const needsCluster = targetType === "cluster";

  async function send() {
    setBusy(true); setResult(""); setError("");
    try {
      const payload = { title, message, target_type: targetType };
      if (needsBranch)  payload.target_branch = branch;
      if (needsYear)    payload.target_year = Number(year);
      if (needsCluster) payload.target_cluster_id = Number(clusterId);
      const res = await api.post("/notifications/broadcast", payload);
      setResult(res.data.message || "Sent.");
      setTitle(""); setMessage("");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.map((d) => d.msg).join(" ") : (detail || "Could not send."));
    } finally {
      setBusy(false);
    }
  }

  function handleSelectCluster(c) {
    setTargetType("cluster");
    setClusterId(String(c.id));
    setShowClusters(false);
  }

  const disabled = busy || !title || !message ||
    (needsYear    && !year) ||
    (needsBranch  && !branch) ||
    (needsCluster && !clusterId);

  const selectedCluster = clusters.find((c) => String(c.id) === clusterId);

  return (
    <AppShell title="Send Notification">
      <div className="sn-layout">

        {/* ── Left: Notification form ── */}
        <div className="card sn-card">
          {result && <p className="alert alert-success">{result}</p>}
          {error  && <p className="alert alert-error">{error}</p>}

          <label className="field-label">Title</label>
          <input className="input sn-mb" value={title}
                 onChange={(e) => setTitle(e.target.value)}
                 placeholder="e.g. Campus drive schedule updated" />

          <label className="field-label">Message</label>
          <textarea className="textarea sn-mb" rows={5} value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write the announcement students will see…" />

          <label className="field-label">Send to</label>
          <div className="sn-row">
            <select className="select" value={targetType}
                    onChange={(e) => setTargetType(e.target.value)}>
              <option value="all">All students</option>
              <option value="branch">A specific branch</option>
              <option value="year">A specific batch (year)</option>
              <option value="year_branch">A batch + branch</option>
              <option value="cluster">Cluster</option>
            </select>

            {needsYear && (
              <select className="select" value={year}
                      onChange={(e) => setYear(e.target.value)}>
                {years.length === 0 && <option value="">No batches</option>}
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}

            {needsBranch && (
              <select className="select" value={branch}
                      onChange={(e) => setBranch(e.target.value)}>
                {branches.length === 0 && <option value="">No branches</option>}
                {branches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            )}

            {needsCluster && (
              <select className="select" value={clusterId}
                      onChange={(e) => setClusterId(e.target.value)}>
                {clusters.length === 0
                  ? <option value="">No clusters — create one →</option>
                  : clusters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.member_count} students)
                      </option>
                    ))
                }
              </select>
            )}
          </div>

          {needsCluster && selectedCluster && (
            <p className="sn-cluster-hint">
              Sending to <strong>{selectedCluster.name}</strong> — {selectedCluster.member_count} student{selectedCluster.member_count !== 1 ? "s" : ""}.
            </p>
          )}

          <button className="btn btn-primary sn-send" disabled={disabled} onClick={send}>
            {busy ? "Sending…" : "Send Notification"}
          </button>
        </div>

        {/* ── Right: Cluster management ── */}
        <div className="sn-cluster-panel">
          <button
            className="sn-cluster-toggle"
            onClick={() => setShowClusters((v) => !v)}
          >
            <span>Manage Clusters</span>
            <span className="sn-cluster-toggle-count">
              {clusters.length} cluster{clusters.length !== 1 ? "s" : ""}
            </span>
            <span>{showClusters ? "−" : "+"}</span>
          </button>

          {showClusters && (
            <ClusterManager
              clusters={clusters}
              onRefresh={loadClusters}
              onSelectForNotif={handleSelectCluster}
            />
          )}
        </div>

      </div>
    </AppShell>
  );
}