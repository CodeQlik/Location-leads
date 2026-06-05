import { useState } from "react";
import Sidebar from "./Sidebar";

export default function Layout({
    children,
    activePage,
    setActivePage,
    authUser,
    handleLogout,
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const pageMeta = {
        leadGenerator: {
            title: "Lead Generator",
            subtitle: "Search Google Maps by keyword + location",
            icon: (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.35-4.35" />
                </svg>
            ),
        },
        leads: {
            title: "Leads",
            subtitle: "List of business leads",
            icon: (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                    <rect x="9" y="3" width="6" height="4" rx="1" />
                    <line x1="9" y1="12" x2="15" y2="12" />
                    <line x1="9" y1="16" x2="13" y2="16" />
                </svg>
            ),
        },
        admin: {
            title: "Admin Dashboard",
            subtitle: "Manage Sales and Marketing users",
            icon: (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
            ),
        },
    }[activePage] || {
        title: "LeadScraper",
        subtitle: "Business lead workspace",
        icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ff6b35" />
                <circle cx="12" cy="9" r="2.5" fill="white" />
            </svg>
        ),
    };

    return (
        <div style={S.page} className="app-shell">
            <header className="mobile-navbar">
                <button
                    type="button"
                    className="mobile-nav-toggle"
                    onClick={() => setSidebarOpen(true)}
                    aria-label="Open sidebar"
                    title="Open sidebar"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="4" y1="6" x2="20" y2="6" />
                        <line x1="4" y1="12" x2="20" y2="12" />
                        <line x1="4" y1="18" x2="20" y2="18" />
                    </svg>
                </button>
                <div className="mobile-navbar-icon">{pageMeta.icon}</div>
                <div className="mobile-navbar-copy">
                    <div className="mobile-navbar-title">{pageMeta.title}</div>
                    <div className="mobile-navbar-subtitle">{pageMeta.subtitle}</div>
                </div>
            </header>

            <Sidebar
                activePage={activePage}
                setActivePage={setActivePage}
                authUser={authUser}
                handleLogout={handleLogout}
                isExpanded={sidebarOpen}
                setIsExpanded={setSidebarOpen}
            />

            <main style={S.main} className="app-main">
                {children}
            </main>

            <style>{`
                .app-shell {
                    --sidebar-width: 240px;
                    --sidebar-gap: 25px;
                }

                .app-main {
                    margin-left: calc(var(--sidebar-width) + var(--sidebar-gap));
                    width: calc(100% - var(--sidebar-width) - var(--sidebar-gap));
                }

                .mobile-navbar {
                    display: none;
                }

                @media (max-width: 1024px) {
                    .mobile-navbar {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        z-index: 900;
                        height: 64px;
                        padding: calc(8px + env(safe-area-inset-top)) 14px 8px;
                        background: rgba(248, 250, 252, 0.92);
                        border-bottom: 1px solid #e2e8f0;
                        backdrop-filter: blur(14px);
                        -webkit-backdrop-filter: blur(14px);
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        box-sizing: content-box;
                    }

                    .mobile-nav-toggle {
                        width: 44px;
                        height: 44px;
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        background: #ffffff;
                        color: #475569;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        box-shadow: 0 8px 22px rgba(15,23,42,0.10);
                        flex: 0 0 44px;
                    }

                    .mobile-navbar-icon {
                        width: 34px;
                        height: 34px;
                        border-radius: 10px;
                        background: rgba(255,107,53,0.08);
                        border: 1px solid rgba(255,107,53,0.15);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex: 0 0 34px;
                    }

                    .mobile-navbar-copy {
                        min-width: 0;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        gap: 1px;
                    }

                    .mobile-navbar-title {
                        min-width: 0;
                        color: #0f172a;
                        font-size: 17px;
                        font-weight: 800;
                        letter-spacing: -0.2px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .mobile-navbar-subtitle {
                        min-width: 0;
                        color: #64748b;
                        font-size: 12.5px;
                        font-weight: 600;
                        line-height: 1.25;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .app-main {
                        margin-left: 0;
                        width: 100%;
                        padding: calc(84px + env(safe-area-inset-top)) 16px 20px !important;
                    }
                }

                @media (max-width: 640px) {
                    .mobile-navbar {
                        height: 62px;
                        padding-left: 12px;
                        padding-right: 12px;
                    }

                    .mobile-nav-toggle {
                        width: 42px;
                        height: 42px;
                        flex-basis: 42px;
                    }

                    .app-main {
                        margin-left: 0;
                        width: 100%;
                        padding: calc(82px + env(safe-area-inset-top)) 10px 14px !important;
                    }
                }
            `}</style>
        </div>
    );
}

const S = {
    page: {
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "'Inter', sans-serif",
        overflow: "hidden",
    },

    main: {
        minHeight: "100vh",
        padding: "28px 20px",
        transition: "all 0.25s ease",
        overflowX: "hidden",
        boxSizing: "border-box",
        maxWidth: "100%",
    },
};
