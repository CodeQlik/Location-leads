import { useEffect, useState } from "react";
import Login from "./pages/Login";
import LeadGenerator from "./pages/LeadGenerator";
import AdminDashboard from "./pages/AdminDashboard";
import Leads from "./pages/Leads";
import Layout from "./components/Layout";

export default function App() {
  const [authUser, setAuthUser] = useState(() => {
    const saved = localStorage.getItem("authUser");
    return saved ? JSON.parse(saved) : null;
  });

  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [activePage, setActivePage] = useState("leadGenerator");

  const handleLoginSuccess = ({ token: loginToken, user }) => {
    localStorage.setItem("token", loginToken);
    localStorage.setItem("authUser", JSON.stringify(user));

    setToken(loginToken);
    setAuthUser(user);
    setActivePage("leadGenerator");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("authUser");

    setToken("");
    setAuthUser(null);
    setActivePage("leadGenerator");
  };

  const isAdmin = authUser?.role === "admin" && authUser?.department === "admin";
  const hasPermission = (permission) => {
    if (isAdmin) return true;
    return authUser?.permissions?.[permission] ?? true;
  };

  const firstAllowedPage = () => {
    if (hasPermission("canScrape")) return "leadGenerator";
    if (hasPermission("canViewLeads")) return "leads";
    if (isAdmin) return "admin";
    return "noAccess";
  };

  const canAccessPage = (page) => {
    if (page === "leadGenerator") return hasPermission("canScrape");
    if (page === "leads") return hasPermission("canViewLeads");
    if (page === "admin") return isAdmin;
    return false;
  };

  useEffect(() => {
    if (!authUser) return;

    if (!canAccessPage(activePage)) {
      setActivePage(firstAllowedPage());
    }
  }, [activePage, authUser]);

  if (!authUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const renderPage = () => {
    const page = canAccessPage(activePage) ? activePage : firstAllowedPage();

    if (page === "leadGenerator") {
      return (
        <LeadGenerator
          authUser={authUser}
          token={token}
          handleLogout={handleLogout}
        />
      );
    }

    if (page === "leads") {
      return <Leads token={token} authUser={authUser} />;
    }

    if (page === "admin" && isAdmin) {
      return (
        <AdminDashboard
          authUser={authUser}
          token={token}
          goToLeads={() => setActivePage("leadGenerator")}
          handleLogout={handleLogout}
        />
      );
    }

    if (firstAllowedPage() === "noAccess") {
      return (
        <div style={{ padding: "32px", fontFamily: "'Inter', sans-serif" }}>
          <h1 style={{ margin: 0, color: "#0f172a" }}>No Access</h1>
          <p style={{ color: "#64748b", marginTop: "8px" }}>
            Ask an admin to enable at least one permission for your account.
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <Layout
      activePage={activePage}
      setActivePage={setActivePage}
      authUser={authUser}
      handleLogout={handleLogout}
    >
      {renderPage()}
    </Layout>
  );
}
