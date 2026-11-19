/// <reference path="./types/storage.d.ts" />
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./styles/theme.css";
import "./styles/styles.css";
import "./styles/flows.css";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ToastHost } from "./components/ToastHost";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { LibraryPage } from "./pages/LibraryPage";
import { EntryEditorPage } from "./pages/EntryEditorPage";
import { ProposalsPage } from "./pages/ProposalsPage";
import { ExplorePage } from "./pages/ExplorePage";
import { WorkspaceSettingsPage } from "./pages/WorkspaceSettingsPage";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/welcome" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Signed in */}
            <Route element={<ProtectedRoute />}>
              <Route
                element={
                  <WorkspaceProvider>
                    <DashboardLayout />
                  </WorkspaceProvider>
                }
              >
                <Route path="/" element={<LibraryPage />} />
                <Route
                  path="/entries/new"
                  element={<EntryEditorPage mode="create" />}
                />
                <Route
                  path="/entries/:entryId/edit"
                  element={<EntryEditorPage mode="edit" />}
                />
                <Route
                  path="/entries/:entryId/propose"
                  element={<EntryEditorPage mode="propose" />}
                />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/proposals" element={<ProposalsPage />} />
                <Route
                  path="/proposals/:proposalId/edit"
                  element={<EntryEditorPage mode="edit-proposal" />}
                />
                <Route
                  path="/workspace-settings"
                  element={<WorkspaceSettingsPage />}
                />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* The one global toast */}
          <ToastHost />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
