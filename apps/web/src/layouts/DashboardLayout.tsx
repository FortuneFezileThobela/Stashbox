import React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { AppHeader } from "../components/Appheader";

const ROLE_LABELS: Record<string, string> = {
  owner: "You're an owner here",
  qa: "You're a QA reviewer here",
  member: "You're a member here",
  viewer: "Public library, read-only",
};

export const DashboardLayout: React.FC = () => {
  const { user } = useAuth();
  const {
    workspaces,
    publicWorkspaces,
    activeWorkspace,
    isReadOnlyPublicView,
    setActiveWorkspaceId,
    stackFilter,
    setStackFilter,
  } = useWorkspace();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const checks = [
    user?.fullName,
    user?.username,
    user?.email,
    user?.jobTitle,
    user?.primaryLanguages?.length,
    user?.organization,
    user?.githubId,
    user?.bio,
  ];
  const done = checks.filter(Boolean).length;
  const percent = Math.round((done / checks.length) * 100);
  const languages = user?.primaryLanguages ?? [];
  const roleLabel = activeWorkspace?.role
    ? ROLE_LABELS[activeWorkspace.role]
    : null;
  const hasAny = workspaces.length > 0 || publicWorkspaces.length > 0;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-section" style={{ gap: 14 }}>
          <div>
            <div className="brand">
              <span className="brand-mark" />
              Stashbox
            </div>
            <label className="sidebar-label" htmlFor="ws-switch">
              Workspace
            </label>
            <select
              id="ws-switch"
              value={activeWorkspace?.workspaceId || ""}
              onChange={(e) => {
                setActiveWorkspaceId(e.target.value);
                navigate("/");
              }}
            >
              {!hasAny && <option value="">No workspaces yet</option>}
              {workspaces.length > 0 && (
                <optgroup label="My Workspaces">
                  {workspaces.map((ws) => (
                    <option key={ws.workspaceId} value={ws.workspaceId}>
                      {ws.name} ({ws.visibility})
                    </option>
                  ))}
                </optgroup>
              )}
              {publicWorkspaces.length > 0 && (
                <optgroup label="Public Libraries (Recent)">
                  {publicWorkspaces.map((ws) => (
                    <option key={ws.workspaceId} value={ws.workspaceId}>
                      {ws.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {roleLabel && (
              <span className="badge" style={{ marginTop: 8 }}>
                {isReadOnlyPublicView ? "🌐 " : ""}
                {roleLabel}
              </span>
            )}
          </div>

          <button
            className="btn btn-primary btn-block"
            onClick={() => navigate("/entries/new")}
            disabled={!activeWorkspace || isReadOnlyPublicView}
            title={
              isReadOnlyPublicView
                ? "Public libraries are read-only. Switch to one of your workspaces."
                : undefined
            }
          >
            New entry
          </button>

          <nav className="sidebar-section">
            <NavLink to="/" end className="nav-link">
              Library
            </NavLink>
            <NavLink to="/explore" className="nav-link">
              Browse public libraries
            </NavLink>
            <NavLink to="/proposals" className="nav-link">
              Suggested edits
            </NavLink>
            <NavLink to="/workspace-settings" className="nav-link">
              Members and workspaces
            </NavLink>
            <NavLink to="/settings" className="nav-link">
              Account and appearance
            </NavLink>
          </nav>

          {languages.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-label">Filter by language</div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  padding: "0 6px",
                }}
              >
                {languages.map((lang) => {
                  const active = stackFilter === lang;
                  return (
                    <button
                      key={lang}
                      type="button"
                      className={`chip${active ? " is-active" : ""}`}
                      aria-pressed={active}
                      onClick={() => {
                        setStackFilter(active ? "" : lang);
                        navigate("/");
                      }}
                    >
                      {lang}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-section">
          {percent < 100 && (
            <button
              type="button"
              onClick={() => navigate("/settings")}
              className="panel"
              style={{ textAlign: "left", whiteSpace: "normal", padding: 12 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 600,
                }}
              >
                <span>Finish your profile</span>
                <span style={{ color: "var(--accent-10)" }}>{percent}%</span>
              </div>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: "var(--surface-elevated)",
                  margin: "8px 0",
                }}
              >
                <div
                  style={{
                    width: `${percent}%`,
                    height: "100%",
                    borderRadius: 2,
                    background: "var(--accent-10)",
                    transition: "width 0.7s cubic-bezier(0.2, 0.7, 0.2, 1)",
                  }}
                />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Add your organization, GitHub handle, and bio.
              </div>
            </button>
          )}
        </div>
      </aside>

      <main className="app-main">
        <AppHeader />
        <div className="app-content" key={pathname}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};
