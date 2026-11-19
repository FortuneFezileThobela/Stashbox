import React, { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { AuthApi } from "../api/auth.api";
import { useAuth } from "../context/AuthContext";
import { AuthSplitLayout } from "../components/AuthSplitLayout";

export const LoginPage: React.FC = () => {
  const { user, login } = useAuth();
  const location = useLocation();
  const from = (
    location.state as { from?: { pathname: string; search?: string } } | null
  )?.from;
  const destination = from ? `${from.pathname}${from.search ?? ""}` : "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={destination} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const authenticatedUser = await AuthApi.login({ email, password });
      login(authenticatedUser);
    } catch {
   
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout>
      <div className="auth-form">
        <div className="page-head" style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26 }}>Sign in</h1>
          <p>Welcome back. Pick up where your team left off.</p>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block btn-lg"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={{ marginTop: 20, color: "var(--text-secondary)" }}>
          New to Stashbox?{" "}
          <Link
            to="/register"
            style={{ color: "var(--accent-10)", fontWeight: 600 }}
          >
            Create an account
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
};
