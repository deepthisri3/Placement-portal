import { useEffect, useMemo, useState } from "react";
import api from "../../services/api.js";
import AppShell from "../../components/AppShell/AppShell.jsx";
import "./AdminChangeRequests.css";

const STATUS_CLASS = {
  ACCEPTED: "badge-success",
  DECLINED: "badge-danger",
  PENDING: "badge-warning",
};

function errText(err, fallback) {
  const d = err?.response?.data?.detail;
  if (Array.isArray(d)) return d.map((x) => x.msg || x).join(" ");
  return d || fallback;
}

export default function AdminChangeRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [actionBusy, setActionBusy] = useState(false);
  const [declining, setDeclining] = useState(null);
  const [declineNote, setDeclineNote] = useState("");
  const [declineError, setDeclineError] = useState("");

  async function load(f = filter) {
    setLoading(true);
    setError("");
    try {
      const url = f === "all" ? "/change-requests/admin/all" : "/change-requests/admin/pending";
      const res = await api.get(url);
      setRequests(res.data || []);
      setSelected(new Set());
    } catch (err) {
      setError(errText(err, "Could not load change requests."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function switchFilter(f) { setFilter(f); load(f); }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) =>
      [r.student_name, r.register_number, r.field_label, r.requested_value, r.branch]
        .some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [requests, search]);

  const pendingVisible = visible.filter((r) => r.status === "PENDING");

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === pendingVisible.length ? new Set() : new Set(pendingVisible.map((r) => r.id))
    );
  }

  async function handleAccept(req) {
    setActionBusy(true); setSuccessMsg(""); setError("");
    try {
      await api.post(`/change-requests/admin/${req.id}/accept`, { admin_note: null });
      setSuccessMsg(`Accepted — ${req.field_label} updated for ${req.student_name}.`);
      await load(filter);
    } catch (err) {
      setError(errText(err, "Accept failed."));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleBulkAccept() {
    if (selected.size === 0) return;
    setActionBusy(true); setSuccessMsg(""); setError("");
    try {
      const res = await api.post("/change-requests/admin/bulk-accept", {
        request_ids: [...selected],
      });
      setSuccessMsg(res.data?.message || "Done.");
      if (res.data?.failed?.length) {
        setError(res.data.failed.map((f) => `#${f.id}: ${f.reason}`).join(" "));
      }
      await load(filter);
    } catch (err) {
      setError(errText(err, "Bulk accept failed."));
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmDecline() {
    if (!declineNote.trim()) { setDeclineError("Please provide a reason."); return; }
    setActionBusy(true); setDeclineError("");
    try {
      await api.post(`/change-requests/admin/${declining.id}/decline`, {
        admin_note: declineNote.trim(),
      });
      setSuccessMsg(`Declined — ${declining.field_label} request from ${declining.student_name}.`);
      setDeclining(null);
      setDeclineNote("");
      await load(filter);
    } catch (err) {
      setDeclineError(errText(err, "Decline failed."));
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <AppShell title="Student Change Requests">
      <div className="acr-head">
        <div>
          <h2 className="acr-title">Student Change Requests</h2>
          <p className="muted acr-sub">
            Accepting writes the new value straight to the student's record and notifies them.
            Declining leaves the record untouched and sends them your reason.
          </p>
        </div>
        <div className="acr-filter">
          <button
            className={`btn ${filter === "pending" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => switchFilter("pending")}
          >
            Pending
          </button>
          <button
            className={`btn ${filter === "all" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => switchFilter("all")}
          >
            All history
          </button>
          <button className="btn btn-ghost" onClick={() => load(filter)} title="Refresh">↻</button>
        </div>
      </div>

      <div className="acr-toolbar">
        <input
          className="input acr-search"
          placeholder="Search name, register number, field…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {selected.size > 0 && (
          <button className="btn btn-primary" disabled={actionBusy} onClick={handleBulkAccept}>
            Accept {selected.size} selected
          </button>
        )}
      </div>

      {successMsg && <p className="alert alert-success">{successMsg}</p>}
      {error && <p className="alert alert-error">{error}</p>}
      {loading && <p className="muted">Loading…</p>}

      {!loading && visible.length === 0 && (
        <div className="card acr-empty">
          <p className="subtle">
            {filter === "pending" ? "No pending requests." : "No requests found."}
          </p>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="card acr-table-card">
          <table className="table">
            <thead>
              <tr>
                <th className="acr-check-col">
                  {pendingVisible.length > 0 && (
                    <input
                      type="checkbox"
                      checked={selected.size === pendingVisible.length && selected.size > 0}
                      onChange={toggleAll}
                      aria-label="Select all pending"
                    />
                  )}
                </th>
                <th>Student</th>
                <th>Reg No</th>
                <th>Field</th>
                <th>Existing</th>
                <th>Requested</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className={r.is_stale ? "acr-row-stale" : ""}>
                  <td className="acr-check-col">
                    {r.status === "PENDING" && (
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleOne(r.id)}
                        aria-label={`Select request ${r.id}`}
                      />
                    )}
                  </td>
                  <td>
                    {r.student_name || "—"}
                    {r.branch && <div className="acr-branch">{r.branch}</div>}
                  </td>
                  <td><code>{r.register_number || "—"}</code></td>
                  <td><strong>{r.field_label}</strong></td>
                  <td className="acr-val acr-cur">
                    {r.current_value || <span className="subtle">not set</span>}
                    {r.is_stale && (
                      <div className="acr-stale" title="The record changed after this request was filed">
                        ⚠ now: {r.live_value || "not set"}
                      </div>
                    )}
                  </td>
                  <td className="acr-val acr-req">{r.requested_value}</td>
                  <td className="acr-date">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${STATUS_CLASS[r.status] || ""}`}>{r.status}</span>
                    {r.reviewed_by_name && (
                      <div className="acr-reviewer">by {r.reviewed_by_name}</div>
                    )}
                    {r.admin_note && (
                      <div className="acr-note" title={r.admin_note}>
                        💬 {r.admin_note.slice(0, 40)}{r.admin_note.length > 40 ? "…" : ""}
                      </div>
                    )}
                  </td>
                  <td>
                    {r.status === "PENDING" ? (
                      <div className="acr-actions">
                        <button
                          className="btn btn-primary acr-btn"
                          disabled={actionBusy}
                          onClick={() => handleAccept(r)}
                        >
                          Accept
                        </button>
                        <button
                          className="btn btn-ghost acr-btn"
                          disabled={actionBusy}
                          onClick={() => { setDeclining(r); setDeclineNote(""); setDeclineError(""); }}
                        >
                          Decline
                        </button>
                      </div>
                    ) : (
                      <span className="subtle">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {declining && (
        <div className="acr-overlay" onClick={() => !actionBusy && setDeclining(null)}>
          <div className="acr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="acr-modal-title">Decline change request</h3>
            <p className="acr-modal-body">
              <strong>{declining.student_name}</strong> wants to change{" "}
              <strong>{declining.field_label}</strong> to <em>"{declining.requested_value}"</em>.
            </p>
            <label className="field-label">Reason for declining (required — the student sees this)</label>
            <textarea
              className="textarea"
              rows={3}
              autoFocus
              placeholder="e.g. This does not match the documents on file — please visit the placement cell."
              value={declineNote}
              onChange={(e) => setDeclineNote(e.target.value)}
            />
            {declineError && <p className="alert alert-error">{declineError}</p>}
            <div className="acr-modal-actions">
              <button className="btn btn-ghost" disabled={actionBusy} onClick={() => setDeclining(null)}>
                Cancel
              </button>
              <button className="acr-decline-btn" disabled={actionBusy} onClick={confirmDecline}>
                {actionBusy ? "Declining…" : "Confirm decline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
