import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";
import { WorkspacesApi } from "../api/workspaces.api";
import { EmptyArt } from "../components/Emptyart";
import type { PaginationMeta, Workspace } from "../types/stashbox";

const PAGE_SIZE = 12;

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export const ExplorePage: React.FC = () => {
  const navigate = useNavigate();
  const { workspaces, openPublicWorkspace, setActiveWorkspaceId } =
    useWorkspace();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<Workspace[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const term = useDebounced(search.trim());

  // A new search starts from the first page
  useEffect(() => {
    setPage(1);
  }, [term]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    WorkspacesApi.listPublic(term || undefined, page, PAGE_SIZE)
      .then((res) => {
        if (cancelled) return;
        setResults(res.workspaces);
        setPagination(res.pagination ?? null);
      })
      .catch(() => {
      
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [term, page]);

  const mineIds = new Set(workspaces.map((w) => w.workspaceId));

  const open = (ws: Workspace) => {
    if (mineIds.has(ws.workspaceId)) setActiveWorkspaceId(ws.workspaceId);
    else openPublicWorkspace(ws);
    navigate("/");
  };

  return (
    <div className="page page-wide">
      <div className="page-head">
        <h1>Browse public libraries</h1>
        <p>
          Read what other teams have published. You can fork entries into your
          own workspaces or suggest edits.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="explore-search">
          Search by name or handle
        </label>
        <input
          id="explore-search"
          type="search"
          autoFocus
          placeholder="For example: backend, devops, core-utils"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && results.length === 0 ? (
        <div className="explore-grid" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 110 }} />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="empty" style={{ padding: "24px 0" }}>
          <EmptyArt />
          <span>
            {term
              ? `No public libraries match "${term}".`
              : "There are no public libraries yet."}
          </span>
          {term && (
            <button className="btn" onClick={() => setSearch("")}>
              Clear search
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="explore-grid">
            {results.map((ws) => {
              const mine = mineIds.has(ws.workspaceId);
              return (
                <article
                  key={ws.workspaceId}
                  className="panel explore-card"
                  style={{ whiteSpace: "normal" }}
                >
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 600 }}>{ws.name}</h2>
                    <div
                      className="mono"
                      style={{ fontSize: 12, color: "var(--text-secondary)" }}
                    >
                      @{ws.handle}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span className="badge">
                      {ws.type === "team" ? "Team" : "Personal"}
                    </span>
                    {mine && <span className="badge">You're a member</span>}
                    {ws.updatedAt && (
                      <span className="hint" style={{ marginTop: 0 }}>
                        Updated {new Date(ws.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <button
                    className={mine ? "btn" : "btn btn-primary"}
                    onClick={() => open(ws)}
                  >
                    {mine ? "Open" : "Browse (read-only)"}
                  </button>
                </article>
              );
            })}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div
              className="actions"
              style={{ justifyContent: "space-between" }}
            >
              <button
                className="btn"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span className="hint" style={{ marginTop: 0 }}>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                className="btn"
                disabled={page >= pagination.totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
