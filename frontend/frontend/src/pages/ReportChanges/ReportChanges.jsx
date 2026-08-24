import { useEffect, useMemo, useState } from "react";
import api from "../../services/api.js";
import AppShell from "../../components/AppShell/AppShell.jsx";
import "./ReportChanges.css";

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

export default function ReportChanges() {
  const [fields, setFields] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState({});
  const [search, setSearch] = useState("");
  const [openGroup, setOpenGroup] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadAll() {
    setLoading(true);
    try {
      const [fieldsRes, histRes] = await Promise.all([
        api.get("/change-requests/fields"),
        api.get("/change-requests/me"),
      ]);
      const list = fieldsRes.data || [];
      setFields(list);
      setHistory(histRes.data || []);
      setOpenGroup((g) => g ?? (list[0]?.group || null));
    } catch (err) {
      setError(errText(err, "Could not load your profile fields."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const groups = useMemo(() => {
    const map = new Map();
    for (const f of fields) {
      if (!map.has(f.group)) map.set(f.group, []);
      map.get(f.group).push(f);
    }
    return [...map.entries()];
  }, [fields]);

  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map(([name, items]) => [name, items.filter((f) => f.field_label.toLowerCase().includes(q))])
      .filter(([, items]) => items.length > 0);
  }, [groups, search]);

  const selectedList = useMemo(
    () => Object.values(selections).sort((a, b) => a.field_label.localeCompare(b.field_label)),
    [selections]
  );

  const pendingCount = history.filter((h) => h.status === "PENDING").length;

  function toggleField(f) {
    if (f.pending_value) return; // already awaiting review
    setError("");
    setSelections((prev) => {
      const next = { ...prev };
      if (next[f.field_name]) delete next[f.field_name];
      else next[f.field_name] = { ...f, requested_value: "" };
      return next;
    });
  }

  function setValue(fieldName, value) {
    setSelections((prev) => ({
      ...prev,
      [fieldName]: { ...prev[fieldName], requested_value: value },
    }));
  }

  async function submit() {
    if (selectedList.length === 0) {
      setError("Select at least one field to report.");
      return;
    }
    const blank = selectedList.filter((s) => !String(s.requested_value).trim());
    if (blank.length > 0) {
      setError(`Enter the corrected value for: ${blank.map((s) => s.field_label).join(", ")}`);
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/change-requests/me", {
        changes: selectedList.map((s) => ({
          field_name: s.field_name,
          requested_value: String(s.requested_value).trim(),
        })),
      });
      setSuccess(
        `Submitted ${selectedList.length} correction${selectedList.length > 1 ? "s" : ""}. ` +
        `You'll be notified once the placement cell reviews ${selectedList.length > 1 ? "them" : "it"}.`
      );
      setSelections({});
      await loadAll();
    } catch (err) {
      setError(errText(err, "Submission failed."));
    } finally {
      setSubmitting(false);
    }
  }

  async function withdraw(id) {
    setError("");
    setSuccess("");
    try {
      const res = await api.delete(`/change-requests/me/${id}`);
      setSuccess(res.data?.message || "Request withdrawn.");
      await loadAll();
    } catch (err) {
      setError(errText(err, "Could not withdraw that request."));
    }
  }

  function renderInput(s) {
    const common = {
      value: s.requested_value,
      onChange: (e) => setValue(s.field_name, e.target.value),
    };
    if (s.kind === "select") {
      return (
        <select className="select rc-new-input" {...common}>
          <option value="">— Select —</option>
          {s.choices.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      );
    }
    if (s.kind === "textarea") {
      return <textarea className="textarea rc-new-input" rows={2} placeholder="Enter correct value…" {...common} />;
    }
    const type =
      s.kind === "date" ? "date"
      : s.kind === "int" || s.kind === "decimal" ? "number"
      : s.kind === "email" ? "email"
      : s.kind === "phone" ? "tel"
      : "text";
    return (
      <input
        className="input rc-new-input"
        type={type}
        step={s.kind === "decimal" ? "0.01" : undefined}
        placeholder="Enter correct value…"
        {...common}
      />
    );
  }

  if (loading) {
    return <AppShell title="Report Changes"><div className="skeleton rc-skeleton" /></AppShell>;
  }

  return (
    <AppShell title="Report Profile Changes">
      <div className="card rc-intro">
        <div>
          <h2 className="rc-intro-title">Request a correction</h2>
          <p className="rc-intro-sub muted">
            Pick the details that are wrong, enter what they should say, and submit.
            Nothing changes on your profile until the placement cell approves it.
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="badge badge-warning">{pendingCount} awaiting review</span>
        )}
      </div>

      {error && <p className="alert alert-error">{error}</p>}
      {success && <p className="alert alert-success">{success}</p>}

      <div className="card rc-card">
        <div className="rc-card-head">
          <h3 className="rc-section-title">Step 1 — Pick what's incorrect</h3>
          <input
            className="input rc-search"
            placeholder="Search fields…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {visibleGroups.length === 0 && <p className="subtle">No fields match "{search}".</p>}

        {visibleGroups.map(([groupName, items]) => {
          const expanded = search.trim() ? true : openGroup === groupName;
          const chosen = items.filter((f) => selections[f.field_name]).length;
          return (
            <div key={groupName} className="rc-group">
              <button
                type="button"
                className="rc-group-head"
                onClick={() => setOpenGroup(expanded && !search.trim() ? null : groupName)}
              >
                <span className="rc-group-name">{groupName}</span>
                {chosen > 0 && <span className="badge badge-accent rc-group-count">{chosen}</span>}
                <span className="rc-group-arrow">{expanded ? "−" : "+"}</span>
              </button>

              {expanded && (
                <div className="rc-field-list">
                  {items.map((f) => {
                    const selected = Boolean(selections[f.field_name]);
                    const locked = Boolean(f.pending_value);
                    return (
                      <button
                        type="button"
                        key={f.field_name}
                        disabled={locked}
                        className={`rc-field-chip ${selected ? "selected" : ""} ${locked ? "locked" : ""}`}
                        onClick={() => toggleField(f)}
                        title={locked ? `Awaiting review: ${f.pending_value}` : f.help || ""}
                      >
                        <span className="rc-check">{locked ? "⏳" : selected ? "✓" : "○"}</span>
                        <span className="rc-chip-text">
                          <span className="rc-chip-label">{f.field_label}</span>
                          <span className="rc-chip-current">
                            {locked ? `Pending → ${f.pending_value}` : (f.current_value || "not set")}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedList.length > 0 && (
        <div className="card rc-card">
          <h3 className="rc-section-title">Step 2 — Enter the correct values</h3>
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
                    <span className="rc-val-value">
                      {s.current_value || <em className="muted">not set</em>}
                    </span>
                  </div>
                  {renderInput(s)}
                </div>
                <button
                  type="button"
                  className="rc-remove-btn"
                  onClick={() => toggleField(s)}
                  aria-label={`Remove ${s.field_label}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="rc-submit-row">
            <button className="btn btn-ghost" onClick={() => setSelections({})} disabled={submitting}>
              Clear all
            </button>
            <button className="btn btn-primary" disabled={submitting} onClick={submit}>
              {submitting
                ? "Submitting…"
                : `Submit ${selectedList.length} correction${selectedList.length > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}

      <div className="card rc-card">
        <h3 className="rc-section-title">My requests</h3>
        {history.length === 0 ? (
          <p className="subtle">You haven't reported any changes yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Field</th>
                <th>From → To</th>
                <th>Status</th>
                <th>Admin note</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.field_label}</strong></td>
                  <td className="rc-hist-values">
                    <span className="rc-hist-old">{r.current_value || "—"}</span>
                    <span className="rc-hist-arrow"> → </span>
                    <span className="rc-hist-new">{r.requested_value}</span>
                  </td>
                  <td><span className={`badge ${STATUS_CLASS[r.status] || ""}`}>{r.status}</span></td>
                  <td>{r.admin_note || <span className="subtle">—</span>}</td>
                  <td>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td>
                    {r.status === "PENDING" && (
                      <button className="rc-withdraw" onClick={() => withdraw(r.id)}>Withdraw</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}