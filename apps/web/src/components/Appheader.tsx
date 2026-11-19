import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, matchPath } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { personInitials, personName } from "../lib/people";
import { EntriesApi } from "../api/entries.api";
import type { Entry } from "../types/stashbox";

const TITLES: [string, string][] = [
  ["/entries/new", "New entry"],
  ["/entries/:entryId/edit", "Edit entry"],
  ["/entries/:entryId/propose", "Suggest an edit"],
  ["/proposals/:proposalId/edit", "Edit draft suggestion"],
  ["/proposals", "Suggested edits"],
  ["/explore", "Browse public libraries"],
  ["/workspace-settings", "Members and workspaces"],
  ["/settings", "Account and appearance"],
  ["/", "Library"],
];
const titleFor = (pathname: string) =>
  TITLES.find(([path]) => matchPath({ path, end: true }, pathname))?.[1] ??
  "Stashbox";

const svg = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
const SearchIcon = () => (
  <svg {...svg}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
const SunIcon = () => (
  <svg {...svg}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const MoonIcon = () => (
  <svg {...svg}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

type Item = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  run: () => void;
};

const CommandPalette: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Entry[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !activeWorkspace || query.trim().length < 2) {
      setFound([]);
      return;
    }
    const t = setTimeout(() => {
      EntriesApi.list({
        workspaceId: activeWorkspace.workspaceId,
        search: query.trim(),
        limit: 6,
      })
        .then(({ items }) => setFound(items))
        .catch(() => setFound([]));
    }, 200);
    return () => clearTimeout(t);
  }, [query, open, activeWorkspace]);

  if (!open) return null;

  const go = (path: string) => () => navigate(path);
  const actions: Item[] = [
    {
      id: "new",
      group: "Actions",
      label: "New entry",
      run: go("/entries/new"),
    },
    {
      id: "theme",
      group: "Actions",
      label:
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
      run: () => setTheme(theme === "dark" ? "light" : "dark"),
    },
    { id: "lib", group: "Go to", label: "Library", run: go("/") },
    {
      id: "prop",
      group: "Go to",
      label: "Suggested edits",
      run: go("/proposals"),
    },
    {
      id: "explore",
      group: "Go to",
      label: "Browse public libraries",
      run: go("/explore"),
    },
    {
      id: "ws",
      group: "Go to",
      label: "Members and workspaces",
      run: go("/workspace-settings"),
    },
    {
      id: "acct",
      group: "Go to",
      label: "Account and appearance",
      run: go("/settings"),
    },
  ];
  const q = query.trim().toLowerCase();
  const items: Item[] = [
    ...found.map((e) => ({
      id: e.entryId,
      group: "Entries",
      label: e.title,
      hint: e.language || "note",
      run: go(`/?entry=${e.entryId}`),
    })),
    ...actions.filter((a) => !q || a.label.toLowerCase().includes(q)),
  ];
  const active = Math.min(index, Math.max(items.length - 1, 0));

  const choose = (item?: Item) => {
    if (!item) return;
    item.run();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search and jump"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <input
          autoFocus
          aria-label="Search entries or pages"
          placeholder="Search entries or jump to a page"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
        />
        <div className="palette-list" role="listbox">
          {items.length === 0 && (
            <div style={{ padding: 20, color: "var(--text-secondary)" }}>
              Nothing matches "{query}".
            </div>
          )}
          {items.map((item, i) => (
            <React.Fragment key={item.id}>
              {(i === 0 || items[i - 1].group !== item.group) && (
                <div className="palette-group">{item.group}</div>
              )}
              <button
                role="option"
                aria-selected={i === active}
                className="palette-item"
                onMouseEnter={() => setIndex(i)}
                onClick={() => choose(item)}
              >
                <span>{item.label}</span>
                {item.hint && (
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: "var(--text-muted)" }}
                  >
                    {item.hint}
                  </span>
                )}
              </button>
            </React.Fragment>
          ))}
        </div>
        <div className="palette-foot">
          <span>
            <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> to move
          </span>
          <span>
            <kbd className="kbd">Enter</kbd> to open
          </span>
          <span>
            <kbd className="kbd">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
};

type ShortcutEvent = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  preventDefault(): void;
};
type ShortcutTarget = {
  addEventListener(type: "keydown", listener: (e: ShortcutEvent) => void): void;
  removeEventListener(
    type: "keydown",
    listener: (e: ShortcutEvent) => void,
  ): void;
};
const globalTarget = () => window as unknown as ShortcutTarget;

export const AppHeader: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { activeWorkspace } = useWorkspace();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const platform =
    (navigator as unknown as { platform?: string }).platform ?? "";
  const isMac = /Mac|iPhone|iPad/.test(platform);
  const displayName = user ? personName(user) : "Account";
  const initials = user ? personInitials(user) : "";

  useEffect(() => {
    const onKey = (e: ShortcutEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    const target = globalTarget();
    target.addEventListener("keydown", onKey);
    return () => target.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <>
      {menuOpen && (
        <div className="menu-backdrop" onMouseDown={() => setMenuOpen(false)} />
      )}
      <header className="topbar">
        <div className="crumbs">
          {activeWorkspace && (
            <>
              <span className="crumb-ws">{activeWorkspace.name}</span>
              <span className="crumb-sep" aria-hidden="true">
                /
              </span>
            </>
          )}
          <span className="crumb-page">{titleFor(pathname)}</span>
        </div>

        <div className="topbar-actions">
          <button
            className="palette-trigger"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search or jump to"
          >
            <SearchIcon />
            <span>Search or jump to</span>
            <kbd className="kbd">{isMac ? "⌘" : "Ctrl"} K</kbd>
          </button>

          <button
            className="icon-btn"
            aria-label={
              theme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>

          <div
            className="menu"
            onKeyDown={(e) => e.key === "Escape" && setMenuOpen(false)}
          >
            <button
              className="avatar-btn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {user?.profileUrl ? (
                <img className="avatar sm" src={user.profileUrl} alt="" />
              ) : (
                <div className="avatar sm">{initials}</div>
              )}
            </button>
            {menuOpen && (
              <div className="menu-pop" role="menu">
                <div style={{ padding: "8px 10px" }}>
                  <strong>{displayName}</strong>
                  <div
                    className="mono"
                    style={{ fontSize: 12, color: "var(--text-secondary)" }}
                  >
                    {user?.username ? `@${user.username}` : ""}
                  </div>
                </div>
                <div
                  style={{
                    height: 1,
                    background: "var(--border-30)",
                    margin: "4px 0",
                  }}
                />
                <button className="btn" onClick={() => navigate("/settings")}>
                  Account and appearance
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    logout();
                    navigate("/welcome");
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </>
  );
};
