export default function Sidebar({
    activePage,
    setActivePage,
    authUser,
    handleLogout,
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
            <aside style={S.sidebar}>

                {/* Brand */}
                <div style={S.brand}>
                    <div style={S.logoMark}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ff6b35" />
                            <circle cx="12" cy="9" r="2.5" fill="white" />
                        </svg>
                    </div>

                    <span style={S.logoText}>LeadScraper</span>
                </div>

                {/* Divider */}
                <div style={S.divider} />

                {/* Nav label */}
                <div style={S.navLabel}>Menu</div>

                {/* Nav */}
                <nav style={S.nav}>
                    {navItems.map((item) => {
                        const active = activePage === item.key;
                        return (
                            <button
                                key={item.key}
                                style={{
                                    ...S.navBtn,
                                    ...(active ? S.navBtnActive : {}),
                                }}
                                onClick={() => setActivePage(item.key)}
                            >
                                <span style={{ ...S.navIcon, color: active ? "#ffffff" : "#64748b" }}>
                                    {item.icon}
                                </span>
                                <span style={{ fontSize: "13.5px", letterSpacing: "-0.1px" }}>
                                    {item.label}
                                </span>
                                {active && <span style={S.activeDot} />}
                            </button>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div style={S.footer}>
                    <div style={S.divider} />

                    <div style={S.userRow}>
                        <div style={S.avatar}>{initials}</div>
                        <div style={S.userInfo}>
                            <div style={S.userName}>{authUser.name}</div>
                            <div style={S.userRole}>{authUser.department}</div>
                        </div>
                    </div>

                    <button
                        style={S.logoutBtn}
                        onClick={handleLogout}
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
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

                aside * {
                    font-family: 'Plus Jakarta Sans', sans-serif;
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
