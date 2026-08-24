import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import AppShell from "../../components/AppShell/AppShell.jsx";
import "./StudentSearch.css";

/**
 * StudentSearch (admin / super_admin)
 * Type-ahead search -> select a student -> navigate to their full profile.
 */
export default function StudentSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef(null);

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

  function onPick(s) {
    navigate(`/admin/student/${encodeURIComponent(s.register_number)}`);
  }

  return (
    <AppShell title="Student Search">
      <div ref={boxRef} className="ss-search-box">
        <input
          className="input ss-input"
          placeholder="Search by name, register no, email, phone, CGPA, or company…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
        />
        {open && (
          <div className="ss-dropdown">
            {searching && <div className="ss-drop-muted">Searching…</div>}
            {!searching && results.length === 0 && <div className="ss-drop-muted">No matches</div>}
            {!searching && results.map((s) => (
              <div key={s.id} className="ss-drop-item" onClick={() => onPick(s)}
                   onMouseDown={(e) => e.preventDefault()}>
                <div className="ss-drop-name">{s.full_name || "—"}</div>
                <div className="ss-drop-meta">
                  {s.register_number}{s.branch ? ` · ${s.branch}` : ""}{s.cgpa != null ? ` · CGPA ${s.cgpa}` : ""}
                  {s.email ? ` · ${s.email}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="muted" style={{ marginTop: 16 }}>Start typing to find a student, then click a result to open their full profile.</p>
    </AppShell>
  );
}