import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { api, type User } from "./lib/api";
import { WorkspaceProvider } from "./lib/store";
import Layout from "./components/Layout";
import "./styles.css";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ResourcePage = lazy(() => import("./pages/ResourcePage"));
const POS = lazy(() => import("./pages/POS"));
const Settings = lazy(() => import("./pages/Settings"));
const Reports = lazy(() => import("./pages/Reports"));
const Utility = lazy(() => import("./pages/Utility"));
const Login = lazy(() => import("./pages/Login"));
const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <div className="loading-screen">
        <h1>Something needs a fresh start</h1>
        <p>{this.state.error.message}</p>
        <button
          className="btn primary"
          onClick={() => window.location.reload()}
        >
          Reload workspace
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    api<User>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null));
    const expired = () => {
      setUser(null);
      client.clear();
    };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  const logout = () => {
    setUser(null);
    client.clear();
  };
  if (user === undefined)
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading PharmaFlow…</p>
      </div>
    );
  return (
    <Suspense
      fallback={
        <div className="page-loading">
          <div className="spinner" />
        </div>
      }
    >
      {!user ? (
        <Login onLogin={setUser} />
      ) : (
        <WorkspaceProvider>
          <Routes>
            <Route element={<Layout onLogout={logout} />}>
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="sales/pos" element={<POS />} />
              <Route path="settings/*" element={<Settings />} />
              <Route path="profile" element={<Settings />} />
              <Route path="reports/*" element={<Reports />} />
              <Route
                path="notifications"
                element={<Utility mode="notifications" />}
              />
              <Route path="help" element={<Utility mode="help" />} />
              <Route path="inventory/*" element={<ResourcePage />} />
              <Route path="sales/*" element={<ResourcePage />} />
              <Route path="purchases/*" element={<ResourcePage />} />
              <Route path="customers/*" element={<ResourcePage />} />
              <Route path="prescriptions/*" element={<ResourcePage />} />
              <Route path="finance/*" element={<ResourcePage />} />
              <Route path="staff/*" element={<ResourcePage />} />
              <Route path="*" element={<Utility mode="not-found" />} />
            </Route>
          </Routes>
        </WorkspaceProvider>
      )}
    </Suspense>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        <Toaster richColors closeButton position="bottom-right" />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
