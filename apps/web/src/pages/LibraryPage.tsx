import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { EntriesApi } from "../api/entries.api";
import { EmptyArt } from "../components/Emptyart";
import {
  DiscussionsPanel,
  type LineRange,
} from "../components/DiscussionsPanel";
import { toast } from "../lib/toast";
import type { Entry, ApprovalStatus } from "../types/stashbox";

const STATUS: Record<ApprovalStatus, { label: string; cls: string }> = {
  qa_approved: { label: "Verified", cls: "badge-ok" },
  pending_qa: { label: "In review", cls: "badge-warn" },
  draft: { label: "🔒 Private draft", cls: "badge-private" },
  deprecated: { label: "Archived", cls: "badge-muted" },
};

const FILTERS: { id: "" | ApprovalStatus; label: string }[] = [
  { id: "", label: "All" },
  { id: "qa_approved", label: "Verified" },
  { id: "pending_qa", label: "In review" },
  { id: "draft", label: "My drafts" },
];

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// Errors are already shown by the global toast; this just stops them bubbling up.
const attempt = async (fn: () => Promise<void>) => {
  try {
    await fn();
  } catch {
    /* shown globally */
  }
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section>
    <h2 className="section-title">{title}</h2>
    {children}
  </section>
);

export const LibraryPage: React.FC = () => {
  const { user } = useAuth();
  const {
    activeWorkspace,
    workspaces,
    isReadOnlyPublicView,
    stackFilter,
    setStackFilter,
  } = useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const wantedId = params.get("entry");

  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [tags, setTags] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ApprovalStatus>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [highlight, setHighlight] = useState<LineRange | null>(null);

  const debouncedSearch = useDebounced(search);
  const debouncedTags = useDebounced(tags);

  const workspaceId = activeWorkspace?.workspaceId;

  useEffect(() => {
    // Review and draft filters make no sense in a read-only public library
    if (isReadOnlyPublicView) setStatusFilter("");
  }, [isReadOnlyPublicView, workspaceId]);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const { items } = await EntriesApi.list({
        workspaceId,
        search: debouncedSearch.trim() || undefined,
        language: stackFilter.trim() || undefined,
        status: statusFilter || undefined,
        tags: debouncedTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setEntries(items);
      setSelected(
        (prev) =>
          items.find((i) => i.entryId === prev?.entryId) || items[0] || null,
      );
    } catch {
      /* shown globally */
    } finally {
      setLoading(false);
    }
  }, [workspaceId, debouncedSearch, debouncedTags, stackFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setHighlight(null);
  }, [selected?.entryId]);

  // Deep link from the search palette: /?entry=<id>
  useEffect(() => {
    if (!wantedId) return;
    const hit = entries.find((e) => e.entryId === wantedId);
    if (hit) setSelected(hit);
  }, [wantedId, entries]);

  if (!activeWorkspace) {
    return (
      <div className="empty">
        <EmptyArt />
        <strong>You don't have a workspace yet.</strong>
        <span>
          Create one to start saving entries, or browse a public library from
          the sidebar.
        </span>
        <button
          className="btn btn-primary"
          onClick={() => navigate("/workspace-settings")}
        >
          Create a workspace
        </button>
      </div>
    );
  }

  const role = activeWorkspace.role;
  const isViewer = role === "viewer";
  const isReviewer = role === "owner" || role === "qa";
  const isPersonal = activeWorkspace.type === "personal";
  const me = user?.userId;

  const isMine = Boolean(selected && selected.createdBy === me);
  const isOwnDraft = Boolean(selected && selected.status === "draft" && isMine);
  const canEditDirectly = !isViewer && (isOwnDraft || isPersonal || isReviewer);
  const canDelete = !isViewer && (isMine || role === "owner");
  const canApprove =
    !isViewer && isReviewer && selected?.status === "pending_qa";
  const filtering = Boolean(
    debouncedSearch || debouncedTags || stackFilter || statusFilter,
  );

  const rules = selected?.dosAndDonts ?? [];
  const dos = rules.filter((r) => r.type === "do");
  const donts = rules.filter((r) => r.type === "dont");

  const submitEntry = (entry: Entry) =>
    attempt(async () => {
      await EntriesApi.submit(entry.entryId);
      toast.success(
        isPersonal ? "Published. Your entry is live." : "Sent for review.",
      );
      await load();
    });

  const approve = (entry: Entry) =>
    attempt(async () => {
      let forceOverride = false;
      if (entry.createdBy === me) {
        if (role !== "owner") {
          toast.info("You can't approve your own entry. Ask another reviewer.");
          return;
        }
        if (
          !window.confirm(
            "You wrote this entry. Approve it anyway as the owner?",
          )
        )
          return;
        forceOverride = true;
      }
      await EntriesApi.approve(entry.entryId, forceOverride);
      toast.success("Approved. The entry is now verified.");
      await load();
    });

  const remove = (entry: Entry) =>
    attempt(async () => {
      setMenuOpen(false);
      if (!window.confirm(`Delete "${entry.title}"? This can't be undone.`))
        return;
      await EntriesApi.remove(entry.entryId);
      toast.success("Entry deleted.");
      await load();
    });

  const forkTo = (entry: Entry, destinationId: string) =>
    attempt(async () => {
      setMenuOpen(false);
      const destination = workspaces.find(
        (w) => w.workspaceId === destinationId,
      );
      await EntriesApi.fork(entry.entryId, destinationId);
      toast.success(
        destination?.type === "team"
          ? `Copied to ${destination.name} as a private draft.`
          : `Copied to ${destination?.name ?? "your workspace"}.`,
      );
      if (destinationId === workspaceId) await load();
    });

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(
        "We couldn't copy that. Select the code and copy it by hand.",
      );
    }
  };

  const forkSelect = (entry: Entry) =>
    workspaces.length === 0 ? (
      <button className="btn" onClick={() => navigate("/workspace-settings")}>
        Create a workspace to fork
      </button>
    ) : (
      <select
        aria-label="Fork to my workspace"
        style={{ width: "auto" }}
        value=""
        onChange={(e) => e.target.value && forkTo(entry, e.target.value)}
      >
        <option value="" disabled>
          Fork to my workspace…
        </option>
        {workspaces.map((w) => (
          <option key={w.workspaceId} value={w.workspaceId}>
            {w.name}
          </option>
        ))}
      </select>
    );

  return (
    <>
      {isViewer && (
        <div className="banner" role="note">
          <span aria-hidden="true">🌐</span>
          <span>
            <strong>Public library, read-only.</strong> You can fork entries
            into your own workspaces or suggest edits.
          </span>
        </div>
      )}

      <div className="library">
        <aside className="entry-list" aria-label="Entries">
          <div className="entry-list-head">
            <input
              type="search"
              placeholder="Search by title"
              aria-label="Search entries"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
              }}
            >
              <input
                placeholder="Language"
                aria-label="Filter by language"
                value={stackFilter}
                onChange={(e) => setStackFilter(e.target.value)}
              />
              <input
                placeholder="Tags, comma separated"
                aria-label="Filter by tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
            {!isViewer && (
              <div
                className="segmented compact"
                role="group"
                aria-label="Filter by status"
              >
                {FILTERS.map((f) => (
                  <button
                    key={f.id || "all"}
                    type="button"
                    aria-pressed={statusFilter === f.id}
                    onClick={() => setStatusFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading && entries.length === 0 ? (
            <div aria-busy="true" aria-label="Loading entries">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="entry-row"
                  style={{ "--i": i, cursor: "default" } as React.CSSProperties}
                >
                  <div
                    className="skeleton"
                    style={{ height: 14, width: `${70 - i * 6}%` }}
                  />
                  <div
                    className="skeleton"
                    style={{ height: 10, width: "32%", marginTop: 10 }}
                  />
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="empty">
              <EmptyArt />
              {filtering ? (
                <>
                  <span>No entries match these filters.</span>
                  <button
                    className="btn"
                    onClick={() => {
                      setSearch("");
                      setTags("");
                      setStackFilter("");
                      setStatusFilter("");
                    }}
                  >
                    Clear filters
                  </button>
                </>
              ) : isViewer ? (
                <span>This public library has no published entries yet.</span>
              ) : (
                <>
                  <span>
                    This workspace is empty. Save the first snippet your team
                    keeps re-asking about.
                  </span>
                  <button
                    className="btn btn-primary"
                    onClick={() => navigate("/entries/new")}
                  >
                    New entry
                  </button>
                </>
              )}
            </div>
          ) : (
            entries.map((item, idx) => {
              const s = STATUS[item.status];
              return (
                <button
                  key={item.entryId}
                  className={`entry-row${selected?.entryId === item.entryId ? " is-active" : ""}`}
                  style={{ "--i": idx } as React.CSSProperties}
                  onClick={() => {
                    setSelected(item);
                    setParams({ entry: item.entryId }, { replace: true });
                    setMenuOpen(false);
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{item.title}</div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginTop: 4,
                    }}
                  >
                    <span className={`badge ${s.cls}`}>{s.label}</span>
                    <span
                      className="mono"
                      style={{ fontSize: 12, color: "var(--text-secondary)" }}
                    >
                      {item.language || "note"}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </aside>

        <section className="reader">
          <div className="reader-inner" key={selected?.entryId ?? "none"}>
            {!selected ? (
              <div style={{ color: "var(--text-secondary)" }}>
                Select an entry to read it.
              </div>
            ) : (
              <>
                <header
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <span className={`badge ${STATUS[selected.status].cls}`}>
                        {STATUS[selected.status].label}
                      </span>
                      <span
                        className="mono"
                        style={{ fontSize: 12, color: "var(--text-secondary)" }}
                      >
                        Version {selected.version}
                      </span>
                    </div>
                    <h1 className="reader-title">{selected.title}</h1>
                    {selected.description && (
                      <p
                        style={{
                          color: "var(--text-secondary)",
                          marginTop: 6,
                          maxWidth: "65ch",
                        }}
                      >
                        {selected.description}
                      </p>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexShrink: 0,
                      alignItems: "center",
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    {isOwnDraft && (
                      <button
                        className="btn btn-primary"
                        onClick={() => submitEntry(selected)}
                      >
                        {isPersonal ? "Publish" : "Submit for review"}
                      </button>
                    )}
                    {canApprove && (
                      <button
                        className="btn btn-primary"
                        onClick={() => approve(selected)}
                      >
                        Approve
                      </button>
                    )}
                    {isViewer ? (
                      <>
                        <button
                          className="btn"
                          onClick={() =>
                            navigate(`/entries/${selected.entryId}/propose`)
                          }
                        >
                          Suggest an edit
                        </button>
                        {forkSelect(selected)}
                      </>
                    ) : canEditDirectly ? (
                      <button
                        className="btn"
                        onClick={() =>
                          navigate(`/entries/${selected.entryId}/edit`)
                        }
                      >
                        {isOwnDraft ? "Edit draft" : "Edit"}
                      </button>
                    ) : (
                      <button
                        className="btn"
                        onClick={() =>
                          navigate(`/entries/${selected.entryId}/propose`)
                        }
                      >
                        Suggest an edit
                      </button>
                    )}
                    <div className="menu">
                      <button
                        className="btn"
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((o) => !o)}
                      >
                        More
                      </button>
                      {menuOpen && (
                        <div className="menu-pop" role="menu">
                          <button
                            className="btn"
                            onClick={() =>
                              navigate(`/proposals?entry=${selected.entryId}`)
                            }
                          >
                            View suggested edits
                          </button>
                          {!isViewer && workspaces.length > 0 && (
                            <select
                              aria-label="Copy to workspace"
                              value=""
                              onChange={(e) =>
                                e.target.value &&
                                forkTo(selected, e.target.value)
                              }
                            >
                              <option value="" disabled>
                                Copy to workspace…
                              </option>
                              {workspaces.map((w) => (
                                <option
                                  key={w.workspaceId}
                                  value={w.workspaceId}
                                >
                                  {w.name}
                                </option>
                              ))}
                            </select>
                          )}
                          {canDelete && (
                            <button
                              className="btn btn-danger"
                              onClick={() => remove(selected)}
                            >
                              Delete entry
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </header>

                {isOwnDraft && (
                  <div className="callout">
                    🔒 This is a private draft. Only you can see it until you{" "}
                    {isPersonal ? "publish" : "submit"} it.
                  </div>
                )}

                {selected.code && (
                  <div className="code-block">
                    <div className="code-block-head">
                      <span className="mono">{selected.language}</span>
                      <button
                        className="btn btn-quiet"
                        onClick={() => copyCode(selected.code || "")}
                      >
                        {copied ? "Copied" : "Copy code"}
                      </button>
                    </div>
                    <pre className="numbered">
                      {selected.code.split("\n").map((line, i) => (
                        <span
                          key={i}
                          className={`code-line${highlight && i + 1 >= highlight.start && i + 1 <= highlight.end ? " is-highlighted" : ""}`}
                        >
                          {line}
                        </span>
                      ))}
                    </pre>
                  </div>
                )}

                {(dos.length > 0 || donts.length > 0) && (
                  <Section title="Usage rules">
                    <div className="rules">
                      {[
                        { label: "Do", cls: "rule-do", list: dos },
                        { label: "Don't", cls: "rule-dont", list: donts },
                      ].map((col) => (
                        <div key={col.label} className="rule-list">
                          {col.list.map((r, i) => (
                            <div key={i} className={`rule ${col.cls}`}>
                              <strong>
                                {col.label}: {r.rule}
                              </strong>
                              {r.explanation && <p>{r.explanation}</p>}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {selected.gotchas && (
                  <Section title="Gotchas">
                    <div className="callout" style={{ whiteSpace: "pre-wrap" }}>
                      {selected.gotchas}
                    </div>
                  </Section>
                )}

                {selected.notes && (
                  <Section title="Implementation notes">
                    <div className="panel">{selected.notes}</div>
                  </Section>
                )}

                {((selected.targetRuntimes?.length ?? 0) > 0 ||
                  (selected.tags?.length ?? 0) > 0) && (
                  <Section title="Runs on">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {selected.targetRuntimes?.map((r) => (
                        <span key={r} className="chip mono">
                          {r}
                        </span>
                      ))}
                      {selected.tags?.map((t) => (
                        <span key={t} className="chip">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </Section>
                )}

                {selected.status !== "draft" && (
                  <DiscussionsPanel
                    key={selected.entryId}
                    entry={selected}
                    role={role}
                    onHighlight={setHighlight}
                  />
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
};
