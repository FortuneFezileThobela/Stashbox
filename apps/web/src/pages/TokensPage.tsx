import React, { useState } from "react";
import { useTheme, type ThemeMode } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { AuthApi, type CreatePatResponse } from "../api/auth.api";

const STACK_OPTIONS = ["typescript", "javascript", "python", "go", "rust", "sql", "bash", "docker"];

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { user, updateUser } = useAuth();

  // Nullable & Editable Profile Fields
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || "");
  const [organization, setOrganization] = useState(user?.organization || "");
  const [githubId, setGithubId] = useState(user?.githubId || "");
  const [profileUrl, setProfileUrl] = useState(user?.profileUrl || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [primaryLanguages, setPrimaryLanguages] = useState<string[]>(
    user?.primaryLanguages || ["typescript"]
  );
  const [savingProfile, setSavingProfile] = useState(false);

  // IDE PAT Tokens
  const [tokenName, setTokenName] = useState("VS Code Extension");
  const [days, setDays] = useState(30);
  const [newToken, setNewToken] = useState<CreatePatResponse | null>(null);
  const [revokeId, setRevokeId] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const toggleLanguage = (lang: string) => {
    setPrimaryLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
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
      setStatus("Developer profile updated.");
    } catch (err: any) {
      setStatus(err.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleGenerateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await AuthApi.createToken(tokenName, days);
    setNewToken(res);
    setStatus("Personal Access Token generated.");
  };

  const handleRevokeToken = async (e: React.FormEvent) => {
    e.preventDefault();
    await AuthApi.revokeToken(revokeId.trim());
    setRevokeId("");
    setStatus("Token revoked.");
  };

  return (
    <div
      style={{
        maxWidth: "760px",
        width: "100%",
        margin: "0 auto",
        padding: "36px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <div>
        <h1 style={{ fontSize: "20px", fontWeight: 700 }}>Account, Profile & Appearance</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "4px" }}>
          Complete your optional profile fields, configure your theme, and manage IDE tokens.
        </p>
      </div>

      {status && (
        <div
          style={{
            padding: "10px 12px",
            border: "1px solid var(--accent-10)",
            backgroundColor: "var(--accent-10-subtle)",
            borderRadius: "5px",
          }}
        >
          {status}
        </div>
      )}

      {/* Complete Nullable Developer Profile Fields */}
      <section
        style={{
          padding: "22px",
          backgroundColor: "var(--surface-30)",
          border: "1px solid var(--border-30)",
          borderRadius: "6px",
        }}
      >
        <h2 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "4px" }}>
          Developer Profile
        </h2>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "16px" }}>
          Fill in your optional organization, GitHub handle, and bio to complete your profile.
        </p>

        <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>Full Name</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>Engineering Role</label>
              <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Backend Engineer" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>
                Organization / Team <span style={{ color: "var(--text-secondary)" }}>(nullable)</span>
              </label>
              <input
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Core Platform Engineering"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>
                GitHub Handle <span style={{ color: "var(--text-secondary)" }}>(nullable)</span>
              </label>
              <input
                className="mono"
                value={githubId}
                onChange={(e) => setGithubId(e.target.value)}
                placeholder="octocat"
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>
              Avatar URL <span style={{ color: "var(--text-secondary)" }}>(nullable)</span>
            </label>
            <input
              type="url"
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              placeholder="https://github.com/octocat.png"
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>
              Bio & Areas of Ownership <span style={{ color: "var(--text-secondary)" }}>(nullable)</span>
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Maintains PostgreSQL connection pools, retry middleware, and internal CLI tooling."
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>
              Sidebar Stack Filters
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {STACK_OPTIONS.map((lang) => {
                const selected = primaryLanguages.includes(lang);
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggleLanguage(lang)}
                    className="mono"
                    style={{
                      padding: "5px 10px",
                      fontSize: "11px",
                      borderRadius: "4px",
                      border: selected ? "1px solid var(--accent-10)" : "1px solid var(--border-30)",
                      backgroundColor: selected ? "var(--accent-10-subtle)" : "var(--bg-60)",
                    }}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            style={{
              alignSelf: "flex-start",
              padding: "8px 16px",
              backgroundColor: "var(--accent-10)",
              color: "var(--accent-text)",
              fontWeight: 600,
            }}
          >
            {savingProfile ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </section>

     
      <section
        style={{
          padding: "22px",
          backgroundColor: "var(--surface-30)",
          border: "1px solid var(--border-30)",
          borderRadius: "6px",
        }}
      >
        <h2 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "4px" }}>Appearance</h2>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "14px" }}>
          Select your preferred 60-30-10 workspace color theme.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {(
            [
              { id: "dark", title: "Warm Deep Slate (Dark)", desc: "#14171f canvas • #1c212b surface • #3b82f6 accent" },
              { id: "light", title: "Soft Alabaster (Light)", desc: "#f8fafc canvas • #f1f5f9 surface • #2563eb accent" },
            ] as { id: ThemeMode; title: string; desc: string }[]
          ).map((option) => {
            const active = theme === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTheme(option.id)}
                style={{
                  textAlign: "left",
                  padding: "14px",
                  backgroundColor: "var(--bg-60)",
                  border: active ? "2px solid var(--accent-10)" : "1px solid var(--border-30)",
                  borderRadius: "6px",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "13px" }}>{option.title}</div>
                <div className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
                  {option.desc}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/*  IDE & CLI Personal Access Tokens */}
      <section
        style={{
          padding: "22px",
          backgroundColor: "var(--surface-30)",
          border: "1px solid var(--border-30)",
          borderRadius: "6px",
        }}
      >
        <h2 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "4px" }}>
          IDE & CLI Access Tokens
        </h2>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "14px" }}>
          Generate Personal Access Tokens for the Stashbox VS Code extension or CLI.
        </p>

        <form
          onSubmit={handleGenerateToken}
          style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: "8px" }}
        >
          <input
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            placeholder="Token Label (e.g. VS Code)"
            required
          />
          <input
            type="number"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            min={1}
            max={365}
          />
          <button
            type="submit"
            style={{
              padding: "8px 14px",
              backgroundColor: "var(--accent-10)",
              color: "var(--accent-text)",
              fontWeight: 600,
            }}
          >
            Generate Token
          </button>
        </form>

        {newToken && (
          <div
            style={{
              marginTop: "14px",
              padding: "12px",
              backgroundColor: "var(--bg-60)",
              border: "1px solid var(--accent-10)",
              borderRadius: "5px",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              Copy this token now—it is hashed in PostgreSQL and will not be shown again:
            </div>
            <div className="mono" style={{ fontWeight: 600, marginTop: "4px", wordBreak: "break-all" }}>
              {newToken.token}
            </div>
            <div className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Token ID: {newToken.id}
            </div>
          </div>
        )}

        <form
          onSubmit={handleRevokeToken}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "8px",
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid var(--border-30)",
          }}
        >
          <input
            value={revokeId}
            onChange={(e) => setRevokeId(e.target.value)}
            placeholder="Paste Token UUID to revoke..."
            className="mono"
            required
          />
          <button
            type="submit"
            style={{
              padding: "8px 14px",
              border: "1px solid var(--border-30)",
              backgroundColor: "var(--bg-60)",
            }}
          >
            Revoke
          </button>
        </form>
      </section>
    </div>
  );
};