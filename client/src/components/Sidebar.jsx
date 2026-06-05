export default function Sidebar({
    activePage,
    setActivePage,
    authUser,
    handleLogout,
    isExpanded,
    setIsExpanded,
}) {
    const isAdmin = authUser.role === "admin" && authUser.department === "admin";
    const hasPermission = (permission) => isAdmin || (authUser.permissions?.[permission] ?? true);

    const navItems = [];

    if (hasPermission("canScrape")) {
        navItems.push({
            key: "leadGenerator",
            label: "Lead Generator",
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.35-4.35" />
                </svg>
            ),
        });
    }

    if (hasPermission("canViewLeads")) {
        navItems.push({
            key: "leads",
            label: "Leads",
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                    <rect x="9" y="3" width="6" height="4" rx="1" />
                    <line x1="9" y1="12" x2="15" y2="12" />
                    <line x1="9" y1="16" x2="13" y2="16" />
                </svg>
            ),
        });
    }

    if (isAdmin) {
        navItems.push({
            key: "admin",
            label: "Users",
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
            ),
        });
    }

    const initials = authUser.name
        ? authUser.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
        : "U";

    return (
        <>
            <aside style={S.sidebar} className={`app-sidebar ${isExpanded ? "is-expanded" : ""}`}>

                {/* Brand */}
                <div style={S.brand} className="sidebar-brand">
                    <div style={S.logoMark}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ff6b35" />
                            <circle cx="12" cy="9" r="2.5" fill="white" />
                        </svg>
                    </div>

                    <span style={S.logoText}>LeadScraper</span>
                </div>

                <button
                    type="button"
                    style={S.collapseBtn}
                    className="sidebar-collapse-btn"
                    onClick={() => setIsExpanded((current) => !current)}
                    aria-label={isExpanded ? "Close sidebar" : "Open sidebar"}
                    title={isExpanded ? "Close sidebar" : "Open sidebar"}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="4" y1="6" x2="20" y2="6" />
                        <line x1="4" y1="12" x2="20" y2="12" />
                        <line x1="4" y1="18" x2="20" y2="18" />
                    </svg>
                </button>

                {/* Divider */}
                <div style={S.divider} className="sidebar-divider" />

                {/* Nav label */}
                <div style={S.navLabel} className="sidebar-nav-label">Menu</div>

                {/* Nav */}
                <nav style={S.nav} className="sidebar-nav">
                    {navItems.map((item) => {
                        const active = activePage === item.key;
                        return (
                            <button
                                key={item.key}
                                style={{
                                    ...S.navBtn,
                                    ...(active ? S.navBtnActive : {}),
                                }}
                                className="sidebar-nav-btn"
                                onClick={() => {
                                    setActivePage(item.key);
                                    setIsExpanded(false);
                                }}
                            >
                                <span style={{ ...S.navIcon, color: active ? "#ffffff" : "#64748b" }}>
                                    {item.icon}
                                </span>
                                <span
                                    className="sidebar-nav-label-text"
                                    style={{ fontSize: "13.5px", letterSpacing: "-0.1px" }}
                                >
                                    {item.label}
                                </span>
                                {active && <span style={S.activeDot} className="sidebar-active-dot" />}
                            </button>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div style={S.footer} className="sidebar-footer">
                    <div style={S.divider} className="sidebar-divider" />

                    <div style={S.userRow} className="sidebar-user-row">
                        <div style={S.avatar}>{initials}</div>
                        <div style={S.userInfo}>
                            <div style={S.userName}>{authUser.name}</div>
                            <div style={S.userRole}>{authUser.department}</div>
                        </div>
                    </div>

                    <button
                        style={S.logoutBtn}
                        className="sidebar-logout-btn"
                        onClick={() => {
                            setIsExpanded(false);
                            handleLogout();
                        }}
                        title="Logout"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        <span style={{ marginLeft: "8px", fontSize: "13px" }}>Logout</span>
                    </button>
                </div>
            </aside>

            <style>{`
                aside * {
                    font-family: var(--sans);
                    box-sizing: border-box;
                }

                aside button:focus-visible {
                    outline: 2px solid rgba(255,107,53,0.4);
                    outline-offset: 2px;
                }

                .nav-btn-hover:hover {
                    background: #f8fafc !important;
                    color: #0f172a !important;
                }

                .sidebar-collapse-btn {
                    display: none !important;
                }

                @media (max-width: 1024px) {
                    .app-sidebar {
                        width: min(270px, calc(100vw - 32px)) !important;
                        height: 100vh !important;
                        left: 0 !important;
                        right: auto !important;
                        top: 0 !important;
                        bottom: auto !important;
                        padding: 14px 10px !important;
                        background: #ffffff !important;
                        border-right: none !important;
                        border-top: none !important;
                        box-shadow: none !important;
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 10px !important;
                        overflow-x: hidden !important;
                        overflow-y: auto !important;
                        transform: translateX(-110%) !important;
                        visibility: hidden !important;
                        transition: transform 0.22s ease, visibility 0.22s ease, box-shadow 0.22s ease !important;
                    }

                    .app-sidebar.is-expanded {
                        transform: translateX(0) !important;
                        visibility: visible !important;
                        border-right: 1px solid #e2e8f0 !important;
                        box-shadow: 16px 0 38px rgba(15,23,42,0.16) !important;
                    }

                    .sidebar-brand {
                        display: flex !important;
                        justify-content: flex-start !important;
                        padding-right: 52px !important;
                        min-height: 44px !important;
                        margin-bottom: 4px !important;
                    }

                    .sidebar-nav-label {
                        display: block !important;
                    }

                    .sidebar-user-row,
                    .sidebar-divider {
                        display: flex !important;
                    }

                    .sidebar-collapse-btn {
                        width: 44px !important;
                        height: 44px !important;
                        border: 1px solid #e2e8f0 !important;
                        border-radius: 12px !important;
                        background: #ffffff !important;
                        color: #475569 !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        cursor: pointer !important;
                        flex: 0 0 44px !important;
                        position: absolute !important;
                        top: 14px !important;
                        right: 10px !important;
                        z-index: 2 !important;
                        box-shadow: none !important;
                    }

                    .sidebar-nav {
                        flex: 1 1 0 !important;
                        min-width: 0 !important;
                        flex-direction: column !important;
                        align-items: stretch !important;
                        justify-content: flex-start !important;
                        gap: 8px !important;
                    }

                    .sidebar-nav-btn {
                        width: 100% !important;
                        min-width: 0 !important;
                        flex: 0 0 auto !important;
                        max-width: none !important;
                        justify-content: flex-start !important;
                        padding: 11px 14px !important;
                        gap: 10px !important;
                        border-radius: 12px !important;
                    }

                    .sidebar-nav-label-text {
                        display: inline !important;
                        white-space: nowrap !important;
                        font-size: 13px !important;
                    }

                    .sidebar-active-dot {
                        display: block !important;
                    }

                    .sidebar-footer {
                        flex: 0 0 auto !important;
                        margin-top: auto !important;
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 10px !important;
                        min-height: 0 !important;
                        padding-bottom: max(4px, env(safe-area-inset-bottom)) !important;
                    }

                    .sidebar-user-row {
                        padding: 10px 4px 0 !important;
                        min-width: 0 !important;
                        align-items: center !important;
                    }

                    .sidebar-user-row > div:last-child {
                        min-width: 0 !important;
                        flex: 1 1 auto !important;
                    }

                    .sidebar-logout-btn {
                        width: 100% !important;
                        min-height: 42px !important;
                        padding: 9px 14px !important;
                        margin-top: 0 !important;
                        justify-content: flex-start !important;
                        flex: 0 0 auto !important;
                    }

                    .sidebar-logout-btn span {
                        display: inline !important;
                    }
                }

                @media (max-width: 480px) {
                    .app-sidebar {
                        width: min(240px, calc(100vw - 24px)) !important;
                        padding: 12px 8px !important;
                    }
                }
            `}</style>
        </>
    );
}

const S = {
    sidebar: {
        width: "240px",
        height: "100vh",
        boxSizing: "border-box",
        background: "#ffffff",
        borderRight: "1px solid #eef0f4",
        padding: "20px 14px",
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "2px 0 12px rgba(15,23,42,0.04)",
    },

    brand: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "20px",
        minHeight: "36px",
    },

    logoMark: {
        width: "32px",
        height: "32px",
        borderRadius: "10px",
        background: "rgba(255,107,53,0.08)",
        border: "1px solid rgba(255,107,53,0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    logoText: {
        fontSize: "15px",
        fontWeight: "800",
        color: "#0f172a",
        whiteSpace: "nowrap",
        letterSpacing: "-0.3px",
    },

    divider: {
        height: "1px",
        background: "linear-gradient(90deg, transparent, #e2e8f0 30%, #e2e8f0 70%, transparent)",
        margin: "0 -2px 16px",
    },

    navLabel: {
        fontSize: "10px",
        fontWeight: "700",
        color: "#94a3b8",
        textTransform: "uppercase",
        letterSpacing: "1.2px",
        marginBottom: "8px",
        paddingLeft: "4px",
    },

    nav: {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        flex: 1,
    },

    navBtn: {
        width: "100%",
        border: "none",
        borderRadius: "10px",
        background: "transparent",
        color: "#475569",
        cursor: "pointer",
        fontWeight: "600",
        fontSize: "13.5px",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: "10px",
        padding: "11px 14px",
        transition: "all 0.18s ease",
        position: "relative",
    },

    navBtnActive: {
        background: "linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)",
        color: "#ffffff",
        boxShadow: "0 4px 12px rgba(255,107,53,0.3)",
    },

    navIcon: {
        width: "20px",
        height: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    activeDot: {
        marginLeft: "auto",
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: "rgba(255,255,255,0.6)",
    },

    footer: {
        marginTop: "auto",
        paddingTop: "4px",
    },

    collapseBtn: {
        border: "none",
        background: "transparent",
    },

    userRow: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 4px 0",
    },

    avatar: {
        width: "32px",
        height: "32px",
        borderRadius: "10px",
        background: "linear-gradient(135deg, rgba(255,107,53,0.15), rgba(255,69,0,0.1))",
        border: "1px solid rgba(255,107,53,0.2)",
        color: "#ff4500",
        fontSize: "12px",
        fontWeight: "800",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        letterSpacing: "0.5px",
    },

    userInfo: {
        overflow: "hidden",
    },

    userName: {
        fontSize: "13px",
        fontWeight: "700",
        color: "#0f172a",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        lineHeight: "1.3",
    },

    userRole: {
        fontSize: "11px",
        color: "#94a3b8",
        textTransform: "capitalize",
        fontWeight: "500",
        lineHeight: "1.3",
    },

    logoutBtn: {
        width: "100%",
        border: "1px solid rgba(239,68,68,0.15)",
        background: "rgba(239,68,68,0.04)",
        color: "#ef4444",
        borderRadius: "10px",
        fontWeight: "600",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        marginTop: "10px",
        padding: "9px 14px",
        transition: "all 0.18s ease",
    },
};
