import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const ProtectedRoute: React.FC = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg-60)" }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, color: "var(--text-secondary)" }}>
          <span className="brand-mark" style={{ width: 16, height: 16, animation: "float 1.6s ease-in-out infinite" }} />
          Checking your session…
        </div>
      </div>
    );
  }

  // Remember where they were headed so login can send them back
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};