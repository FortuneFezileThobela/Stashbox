import React, { useCallback, useEffect, useState } from "react";
import { useTheme, type ThemeMode } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import {
  AuthApi,
  type ApiTokenSummary,
  type CreatePatResponse,
} from "../api/auth.api";
import { toast } from "../lib/toast";
import { personInitials } from "../lib/people";

const STACK_OPTIONS = [
  "typescript",
  "javascript",
  "python",
  "go",
  "rust",
  "sql",
  "bash",
  "docker",
];

const THEMES: { id: ThemeMode; title: string; desc: string }[] = [
  { id: "dark", title: "Dark", desc: "Easier on the eyes in a dim room." },
  { id: "light", title: "Light", desc: "Better in daylight." },
];

const CopyButton: React.FC<{ text: string; label?: string }> = ({
  text,
  label = "Copy",
}) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-quiet"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
};

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { user, updateUser, logout } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || "");
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || "");
  const [organization, setOrganization] = useState(user?.organization || "");
  const [githubId, setGithubId] = useState(user?.githubId || "");
  const [profileUrl, setProfileUrl] = useState(user?.profileUrl || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [primaryLanguages, setPrimaryLanguages] = useState<string[]>(
    user?.primaryLanguages || [],
  );
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    if (!user) return;
    setFullName((v) => v || user.fullName || "");
    setJobTitle((v) => v || user.jobTitle || "");
    setOrganization((v) => v || user.organization || "");
    setGithubId((v) => v || user.githubId || "");
    setProfileUrl((v) => v || user.profileUrl || "");
    setBio((v) => v || user.bio || "");
    setPrimaryLanguages((v) => (v.length ? v : user.primaryLanguages || []));
  }, [user]);

  const [tokenName, setTokenName] = useState("VS Code");
  const [days, setDays] = useState(30);
  const [newToken, setNewToken] = useState<CreatePatResponse | null>(null);
  const [tokens, setTokens] = useState<ApiTokenSummary[]>([]);
  const [tokensLoaded, setTokensLoaded] = useState(false);

  const loadTokens = useCallback(async () => {
    try {
      setTokens(await AuthApi.listTokens());
    } catch {

    } finally {
      setTokensLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const initials = personInitials({
    fullName,
    username: user?.username,
    email: user?.email,
  });

  const toggleLanguage = (lang: string) =>
    setPrimaryLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );

 
  const run = async (fn: () => Promise<void>, okText: string) => {
    try {
      await fn();
      toast.success(okText);
    } catch {
     
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await run(async () => {
      const updated = await AuthApi.updateProfile({
        fullName,
        jobTitle: jobTitle || null,
        organization: organization || null,
        githubId: githubId || null,
        profileUrl: profileUrl || null,
        bio: bio || null,
        primaryLanguages,
        themePreference: theme,
      });
      updateUser(updated);
    }, "Profile saved.");
    setSaving(false);
  };

  const handleGenerateToken = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      setNewToken(await AuthApi.createToken(tokenName, days));
      await loadTokens();
    }, "Token created. Copy it now.");
  };

  const handleRevokeToken = (token: ApiTokenSummary) => {
    const message = token.isCurrent
      ? `"${token.name}" is the session you're using right now. Revoking it signs you out. Continue?`
      : `Revoke "${token.name}"? Anything using it will stop working.`;
    if (!window.confirm(message)) return;

    return run(async () => {
      await AuthApi.revokeToken(token.id);
      if (token.isCurrent) {
        logout();
        return;
      }
      setNewToken((current) =>
        current && current.id === token.id ? null : current,
      );
      await loadTokens();
    }, "Token revoked.");
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Account and appearance</h1>
        <p>
          Update your profile, choose a theme, and manage tokens for your
          editor.
        </p>
      </div>

      <section className="settings-row">
        <div>
          <h2>Profile</h2>
          <p className="hint">Only your name is required.</p>
        </div>
        <form className="form" onSubmit={handleSaveProfile}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {profileUrl ? (
              <img className="avatar" src={profileUrl} alt="" />
            ) : (
              <div className="avatar">{initials}</div>
            )}
            <div style={{ minWidth: 0 }}>
              <div className="label" style={{ marginBottom: 2 }}>
                Your user ID
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <code
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    wordBreak: "break-all",
                  }}
                >
                  {user?.userId}
                </code>
                <CopyButton text={user?.userId || ""} />
              </div>
              <p className="hint" style={{ marginTop: 0 }}>
                Share this with a workspace owner so they can add you.
              </p>
            </div>
          </div>

          <div className="grid-2">
            <div>
              <label className="label" htmlFor="fullName">
                Full name
              </label>
              <input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="jobTitle">
                Role
              </label>
              <input
                id="jobTitle"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Backend Engineer"
              />
            </div>
          </div>

          <div className="grid-2">
            <div>
              <label className="label" htmlFor="org">
                Organization <span className="label-optional">(optional)</span>
              </label>
              <input
                id="org"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Core Platform"
              />
            </div>
            <div>
              <label className="label" htmlFor="github">
                GitHub handle <span className="label-optional">(optional)</span>
              </label>
              <input
                id="github"
                className="mono"
                value={githubId}
                onChange={(e) => setGithubId(e.target.value)}
                placeholder="octocat"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="avatar">
              Avatar URL <span className="label-optional">(optional)</span>
            </label>
            <input
              id="avatar"
              type="url"
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              placeholder="https://github.com/octocat.png"
            />
          </div>

          <div>
            <label className="label" htmlFor="bio">
              Bio <span className="label-optional">(optional)</span>
            </label>
            <textarea
              id="bio"
              rows={3}
              maxLength={500}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="What you maintain and what teammates can ask you about."
            />
            <p className="hint">{bio.length} of 500 characters</p>
          </div>

          <div>
            <span className="label">Languages in your sidebar</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {STACK_OPTIONS.map((lang) => {
                const selected = primaryLanguages.includes(lang);
                return (
                  <button
                    key={lang}
                    type="button"
                    className={`chip${selected ? " is-active" : ""}`}
                    aria-pressed={selected}
                    onClick={() => toggleLanguage(lang)}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ alignSelf: "flex-start" }}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </form>
      </section>

      <section className="settings-row">
        <div>
          <h2>Theme</h2>
          <p className="hint">
            Applies on this device right away. Save your profile to remember it.
          </p>
        </div>
        <div className="grid-2">
          {THEMES.map((o) => (
            <button
              key={o.id}
              type="button"
              className="choice"
              aria-pressed={theme === o.id}
              onClick={() => setTheme(o.id)}
            >
              <div style={{ fontWeight: 600 }}>{o.title}</div>
              <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>
                {o.desc}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-row">
        <div>
          <h2>Editor and CLI tokens</h2>
          <p className="hint">
            Use a token to connect the Stashbox VS Code extension or
            command-line tools.
          </p>
        </div>
        <div className="form" style={{ gap: 20 }}>
          <form
            onSubmit={handleGenerateToken}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr auto",
              gap: 8,
              alignItems: "end",
            }}
          >
            <div>
              <label className="label" htmlFor="tokenName">
                Label
              </label>
              <input
                id="tokenName"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="days">
                Expires in (days)
              </label>
              <input
                id="days"
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Create token
            </button>
          </form>

          {newToken && (
            <div className="token-box">
              <strong>Copy this token now. It won't be shown again.</strong>
              <code className="mono">{newToken.token}</code>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  flexWrap: "wrap",
                }}
              >
                <CopyButton text={newToken.token} label="Copy token" />
                <span className="hint" style={{ marginTop: 0 }}>
                  Token ID: <span className="mono">{newToken.id}</span>
                </span>
              </div>
            </div>
          )}

          <div>
            <span className="label">Your tokens</span>
            {!tokensLoaded ? (
              <div
                className="skeleton"
                style={{ height: 52 }}
                aria-busy="true"
              />
            ) : tokens.length === 0 ? (
              <p className="hint" style={{ marginTop: 0 }}>
                You haven't created any tokens yet.
              </p>
            ) : (
              <ul className="token-list">
                {tokens.map((t) => (
                  <li key={t.id} className="token-row">
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <strong>{t.name}</strong>
                        {t.isCurrent && (
                          <span className="badge">This device</span>
                        )}
                        {t.expired && (
                          <span className="badge badge-muted">Expired</span>
                        )}
                      </div>
                      <div className="hint" style={{ marginTop: 2 }}>
                        Created {new Date(t.createdAt).toLocaleDateString()}
                        {t.lastUsedAt
                          ? `, last used ${new Date(t.lastUsedAt).toLocaleDateString()}`
                          : ""}
                        {t.expiresAt && !t.expired
                          ? `, expires ${new Date(t.expiresAt).toLocaleDateString()}`
                          : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => handleRevokeToken(t)}
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
