import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { AuthApi } from "../api/auth.api";
import { useAuth } from "../context/AuthContext";
import { AuthSplitLayout } from "../components/AuthSplitLayout";
import { toast } from "../lib/toast";

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

const ROLE_OPTIONS = [
  "Backend Engineer",
  "Full-Stack Engineer",
  "Frontend Engineer",
  "QA / Test Engineer",
  "DevOps / SRE",
  "Engineering Lead",
];

export const RegisterPage: React.FC = () => {
  const { user, login } = useAuth();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("Backend Engineer");
  const [primaryLanguages, setPrimaryLanguages] = useState<string[]>([
    "typescript",
    "sql",
  ]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const toggleLanguage = (lang: string) =>
    setPrimaryLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.info("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      toast.info("The two passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const createdUser = await AuthApi.register({
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
        jobTitle,
        primaryLanguages,
      });
      login(createdUser);
      toast.success("Welcome to Stashbox.");
    } catch {
      
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout>
      <div className="auth-form" style={{ maxWidth: 480 }}>
        <div className="page-head" style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26 }}>Create your account</h1>
          <p>
            You can add your organization, GitHub handle and bio later in
            Settings.
          </p>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <div className="grid-2">
            <div>
              <label className="label" htmlFor="fullName">
                Full name
              </label>
              <input
                id="fullName"
                autoComplete="name"
                value={fullName}
                placeholder="Alex Rivera"
                required
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (!username) {
                    setUsername(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, "")
                        .slice(0, 20),
                    );
                  }
                }}
              />
            </div>
            <div>
              <label className="label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                className="mono"
                value={username}
                placeholder="arivera"
                required
                onChange={(e) =>
                  setUsername(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
                  )
                }
              />
            </div>
          </div>

          <div className="grid-2">
            <div>
              <label className="label" htmlFor="email">
                Work email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                placeholder="alex@company.com"
                required
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="role">
                Role
              </label>
              <select
                id="role"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="label">Languages you work in</span>
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
            <p className="hint">These become quick filters in your sidebar.</p>
          </div>

          <div className="grid-2">
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="hint">At least 8 characters.</p>
            </div>
            <div>
              <label className="label" htmlFor="confirm">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block btn-lg"
            disabled={loading}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p style={{ marginTop: 20, color: "var(--text-secondary)" }}>
          Already have an account?{" "}
          <Link
            to="/login"
            style={{ color: "var(--accent-10)", fontWeight: 600 }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
};
