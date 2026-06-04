import { useEffect, useMemo, useState } from "react";
import { createUser, getUsers, updateUserPermissions, updateUserStatus } from "../api/usersApi";

export default function AdminDashboard({ token, goToLeads, handleLogout }) {
    const [users, setUsers] = useState([]);
    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "password123",
        department: "sales",
        permissions: {
            canScrape: true,
            canViewLeads: true,
            canExportCsv: true,
        },
    });

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [openPermissionsUserId, setOpenPermissionsUserId] = useState(null);

    const loadUsers = async () => {
        try {
            setLoading(true);
            setError("");

            const res = await getUsers(token);
            setUsers(res.data.users || []);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchUsers = async () => {
            await loadUsers();
        };

        fetchUsers();
    }, []);

    const stats = useMemo(() => {
        return {
            total: users.length,
            sales: users.filter((u) => u.department === "sales").length,
            marketing: users.filter((u) => u.department === "marketing").length,
            active: users.filter((u) => u.isActive).length,
        };
    }, [users]);

    const handleCreateUser = async () => {
        try {
            setMessage("");
            setError("");

            if (!form.name || !form.email || !form.password) {
                setError("Name, email and password are required");
                return;
            }

            await createUser(token, form);

            setMessage("User created successfully");
            setForm({
                name: "",
                email: "",
                password: "password123",
                department: "sales",
                permissions: {
                    canScrape: true,
                    canViewLeads: true,
                    canExportCsv: true,
                },
            });

            await loadUsers();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to create user");
        }
    };

    const handleToggleStatus = async (user) => {
        try {
            setMessage("");
            setError("");

            await updateUserStatus(token, user._id, !user.isActive);
            setMessage(user.isActive ? "User disabled" : "User enabled");

            await loadUsers();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update user");
        }
    };

    const handlePermissionChange = async (user, key, checked) => {
        try {
            setMessage("");
            setError("");

            const permissions = {
                canScrape: user.permissions?.canScrape ?? true,
                canViewLeads: user.permissions?.canViewLeads ?? true,
                canExportCsv: user.permissions?.canExportCsv ?? true,
                [key]: checked,
            };

            await updateUserPermissions(token, user._id, permissions);
            setMessage("Permissions updated");
            await loadUsers();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update permissions");
        }
    };

    const getPermissionCount = (permissions = {}) => {
        return [
            permissions.canScrape ?? true,
            permissions.canViewLeads ?? true,
            permissions.canExportCsv ?? true,
        ].filter(Boolean).length;
    };

    const handleFormPermissionChange = (key, checked) => {
        setForm({
            ...form,
            permissions: {
                ...form.permissions,
                [key]: checked,
            },
        });
    };

    return (
        <div style={S.page}>
            <h1 style={S.title}>Admin Dashboard</h1>
            <p style={S.sub}>Manage Sales and Marketing users</p>
            <div style={S.statsGrid}>
                <Stat title="Total Users" value={stats.total} />
                <Stat title="Sales Users" value={stats.sales} />
                <Stat title="Marketing Users" value={stats.marketing} />
                <Stat title="Active Users" value={stats.active} />
            </div>

            <div style={S.grid}>
                <div style={S.card}>
                    <h2 style={S.cardTitle}>Create User</h2>

                    <input
                        style={S.input}
                        placeholder="Name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />

                    <input
                        style={S.input}
                        placeholder="Email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />

                    <input
                        style={S.input}
                        placeholder="Password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />

                    <select
                        style={S.input}
                        value={form.department}
                        onChange={(e) => setForm({ ...form, department: e.target.value })}
                    >
                        <option value="sales">Sales</option>
                        <option value="marketing">Marketing</option>
                    </select>

                    <div style={S.permissionsBox}>
                        <div style={S.permissionsTitle}>Permissions</div>
                        <PermissionCheckbox
                            label="Scrape data"
                            checked={form.permissions.canScrape}
                            onChange={(checked) => handleFormPermissionChange("canScrape", checked)}
                        />
                        <PermissionCheckbox
                            label="View leads"
                            checked={form.permissions.canViewLeads}
                            onChange={(checked) => handleFormPermissionChange("canViewLeads", checked)}
                        />
                        <PermissionCheckbox
                            label="Export CSV"
                            checked={form.permissions.canExportCsv}
                            onChange={(checked) => handleFormPermissionChange("canExportCsv", checked)}
                        />
                    </div>

                    {error && <div style={S.error}>{error}</div>}
                    {message && <div style={S.success}>{message}</div>}

                    <button style={S.primaryBtn} onClick={handleCreateUser}>
                        Create User
                    </button>
                </div>

                <div style={S.card}>
                    <h2 style={S.cardTitle}>Users</h2>

                    {loading ? (
                        <p style={S.muted}>Loading users...</p>
                    ) : (
                        <div style={S.tableWrap}>
                            <table style={S.table}>
                                <thead>
                                    <tr>
                                        <th style={S.th}>Name</th>
                                        <th style={S.th}>Email</th>
                                        <th style={S.th}>Role</th>
                                        <th style={S.th}>Department</th>
                                        <th style={S.th}>Permissions</th>
                                        <th style={S.th}>Status</th>
                                        <th style={S.th}>Action</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user._id}>
                                            <td style={S.td}>{user.name}</td>
                                            <td style={S.td}>{user.email}</td>
                                            <td style={S.td}>{user.role}</td>
                                            <td style={S.td}>{user.department}</td>
                                            <td style={{ ...S.td, position: "relative" }}>
                                                {user.role === "admin" ? (
                                                    <span style={S.muted}>All access</span>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            style={S.permissionMenuBtn}
                                                            onClick={() =>
                                                                setOpenPermissionsUserId(
                                                                    openPermissionsUserId === user._id ? null : user._id
                                                                )
                                                            }
                                                        >
                                                            {getPermissionCount(user.permissions)} enabled
                                                            <span style={S.chevron}>⌄</span>
                                                        </button>

                                                        {openPermissionsUserId === user._id && (
                                                            <div style={S.permissionMenu}>
                                                                <PermissionCheckbox
                                                                    label="Scrape data"
                                                                    checked={user.permissions?.canScrape ?? true}
                                                                    onChange={(checked) => handlePermissionChange(user, "canScrape", checked)}
                                                                />
                                                                <PermissionCheckbox
                                                                    label="View leads"
                                                                    checked={user.permissions?.canViewLeads ?? true}
                                                                    onChange={(checked) => handlePermissionChange(user, "canViewLeads", checked)}
                                                                />
                                                                <PermissionCheckbox
                                                                    label="Export CSV"
                                                                    checked={user.permissions?.canExportCsv ?? true}
                                                                    onChange={(checked) => handlePermissionChange(user, "canExportCsv", checked)}
                                                                />
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </td>
                                            <td style={S.td}>
                                                <span
                                                    style={{
                                                        ...S.badge,
                                                        background: user.isActive ? "#dcfce7" : "#fee2e2",
                                                        color: user.isActive ? "#166534" : "#991b1b",
                                                    }}
                                                >
                                                    {user.isActive ? "Active" : "Disabled"}
                                                </span>
                                            </td>
                                            <td style={S.td}>
                                                {user.role === "admin" ? (
                                                    <span style={S.muted}>Protected</span>
                                                ) : (
                                                    <button
                                                        style={S.smallBtn}
                                                        onClick={() => handleToggleStatus(user)}
                                                    >
                                                        {user.isActive ? "Disable" : "Enable"}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function PermissionCheckbox({ label, checked, onChange }) {
    return (
        <label style={S.permissionCheck}>
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                style={S.checkbox}
            />
            <span>{label}</span>
        </label>
    );
}

function Stat({ title, value }) {
    return (
        <div style={S.statCard}>
            <div style={S.statValue}>{value}</div>
            <div style={S.statTitle}>{title}</div>
        </div>
    );
}

const S = {
    page: {
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "28px 14px 28px 18px",
        boxSizing: "border-box",
        fontFamily: "'Inter', sans-serif",
        color: "#0f172a",
    },

    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "24px",
    },

    title: {
        fontSize: "32px",
        fontWeight: "800",
        margin: 0,
    },

    sub: {
        color: "#64748b",
        marginTop: "6px",
    },

    actions: {
        display: "flex",
        gap: "12px",
    },

    statsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "16px",
        marginBottom: "24px",
    },

    statCard: {
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        padding: "20px",
    },

    statValue: {
        fontSize: "28px",
        fontWeight: "800",
        color: "#ff6b35",
    },

    statTitle: {
        fontSize: "13px",
        color: "#64748b",
        marginTop: "6px",
    },

    grid: {
        display: "grid",
        gridTemplateColumns: "280px minmax(0, 1fr)",
        gap: "14px",
        alignItems: "start",
    },

    card: {
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "18px",
        padding: "18px",
        boxSizing: "border-box",
        minWidth: 0,
    },

    cardTitle: {
        fontSize: "20px",
        fontWeight: "800",
        marginBottom: "16px",
    },

    input: {
        width: "100%",
        boxSizing: "border-box",
        padding: "13px 14px",
        border: "1px solid #cbd5e1",
        borderRadius: "12px",
        marginBottom: "12px",
        outline: "none",
        fontSize: "14px",
    },

    primaryBtn: {
        width: "100%",
        boxSizing: "border-box",
        padding: "13px",
        border: "none",
        borderRadius: "12px",
        background: "linear-gradient(135deg, #ff6b35, #ff4500)",
        color: "#ffffff",
        fontWeight: "800",
        cursor: "pointer",
    },

    secondaryBtn: {
        padding: "10px 14px",
        border: "1px solid #cbd5e1",
        borderRadius: "10px",
        background: "#ffffff",
        color: "#0f172a",
        fontWeight: "700",
        cursor: "pointer",
    },

    logoutBtn: {
        padding: "10px 14px",
        background: "rgba(239, 68, 68, 0.06)",
        border: "1px solid rgba(239, 68, 68, 0.18)",
        borderRadius: "10px",
        color: "#ef4444",
        fontWeight: "700",
        cursor: "pointer",
    },

    tableWrap: {
        overflowX: "visible",
        maxWidth: "100%",
    },

    permissionsBox: {
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "12px",
        marginBottom: "12px",
        background: "#f8fafc",
    },

    permissionsTitle: {
        fontSize: "11px",
        fontWeight: "800",
        color: "#64748b",
        textTransform: "uppercase",
        letterSpacing: "0.7px",
        marginBottom: "8px",
    },

    permissionCheck: {
        display: "flex",
        alignItems: "center",
        gap: "7px",
        color: "#475569",
        fontSize: "12px",
        fontWeight: "700",
        marginBottom: "7px",
        cursor: "pointer",
        textTransform: "none",
    },

    checkbox: {
        width: "14px",
        height: "14px",
        accentColor: "#ff6b35",
        cursor: "pointer",
        flexShrink: 0,
    },

    permissionMenuBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        minWidth: "104px",
        padding: "8px 10px",
        border: "1px solid #e2e8f0",
        borderRadius: "9px",
        background: "#ffffff",
        color: "#475569",
        fontSize: "12px",
        fontWeight: "800",
        cursor: "pointer",
    },

    chevron: {
        color: "#94a3b8",
        fontSize: "13px",
        lineHeight: 1,
    },

    permissionMenu: {
        position: "absolute",
        top: "calc(100% - 4px)",
        left: "8px",
        width: "160px",
        padding: "10px 10px 4px",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        background: "#ffffff",
        boxShadow: "0 12px 28px rgba(15,23,42,0.12)",
        zIndex: 20,
    },

    table: {
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "12px",
    },

    th: {
        textAlign: "left",
        padding: "10px 8px",
        background: "#f8fafc",
        color: "#64748b",
        borderBottom: "1px solid #e2e8f0",
        textTransform: "uppercase",
        fontSize: "11px",
    },

    td: {
        padding: "10px 8px",
        borderBottom: "1px solid #f1f5f9",
        color: "#334155",
        textTransform: "capitalize",
        wordBreak: "break-word",
    },

    badge: {
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: "700",
    },

    smallBtn: {
        padding: "7px 12px",
        border: "1px solid #cbd5e1",
        borderRadius: "8px",
        background: "#ffffff",
        cursor: "pointer",
        fontWeight: "700",
    },

    error: {
        padding: "10px",
        marginBottom: "12px",
        borderRadius: "10px",
        background: "#fee2e2",
        color: "#991b1b",
        fontSize: "13px",
    },

    success: {
        padding: "10px",
        marginBottom: "12px",
        borderRadius: "10px",
        background: "#dcfce7",
        color: "#166534",
        fontSize: "13px",
    },

    muted: {
        color: "#94a3b8",
        fontSize: "13px",
    },
};
