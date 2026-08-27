import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config/api";
import { createUser, getUsers, updateUserPermissions, updateUserStatus, deleteUser, updateUserPassword } from "../api/usersApi";

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
    const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);
    const [selectedUserDetailsUser, setSelectedUserDetailsUser] = useState(null);
    const [newPasswordInput, setNewPasswordInput] = useState("");
    const [userLeads, setUserLeads] = useState([]);
    const [loadingUserLeads, setLoadingUserLeads] = useState(false);

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
        const fetchUserLeads = async () => {
            if (!selectedUserDetailsUser) {
                setUserLeads([]);
                return;
            }

            try {
                setLoadingUserLeads(true);
                const res = await axios.get(`${API_BASE}/leads?userId=${selectedUserDetailsUser._id}&limit=200`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setUserLeads(res.data.leads || []);
            } catch (err) {
                console.error("Failed to load user leads:", err);
            } finally {
                setLoadingUserLeads(false);
            }
        };

        fetchUserLeads();
    }, [selectedUserDetailsUser, token]);

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
            setUsers((current) =>
                current.map((item) =>
                    item._id === user._id ? { ...item, isActive: !user.isActive } : item
                )
            );
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update user");
        }
    };

    const handleDeleteUser = (user) => {
        setDeleteConfirmUser(user);
    };

    const confirmDeleteUser = async (user) => {
        try {
            setMessage("");
            setError("");
            setDeleteConfirmUser(null);

            await deleteUser(token, user._id);
            setMessage("User deleted successfully");
            setUsers((current) => current.filter((item) => item._id !== user._id));
        } catch (err) {
            setError(err.response?.data?.message || "Failed to delete user");
        }
    };

    const handleResetUserPassword = async () => {
        if (!newPasswordInput || newPasswordInput.length < 6) {
            alert("Password must be at least 6 characters long");
            return;
        }

        try {
            setMessage("");
            setError("");

            const res = await updateUserPassword(token, selectedUserDetailsUser._id, newPasswordInput);
            
            // Update local users list
            setUsers((current) =>
                current.map((item) =>
                    item._id === selectedUserDetailsUser._id
                        ? { ...item, plaintextPassword: res.data.plaintextPassword }
                        : item
                )
            );

            // Update modal state
            setSelectedUserDetailsUser((current) => ({
                ...current,
                plaintextPassword: res.data.plaintextPassword,
            }));

            setNewPasswordInput("");
            alert("Password updated successfully!");
        } catch (err) {
            alert(err.response?.data?.message || "Failed to update password");
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
            setUsers((current) =>
                current.map((item) =>
                    item._id === user._id ? { ...item, permissions } : item
                )
            );
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
        <div style={S.page} className="admin-page">
            <style>{`
                .admin-page * {
                    box-sizing: border-box;
                }

                @media (max-width: 1180px) {
                    .admin-stats-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                    }

                    .admin-grid {
                        grid-template-columns: 1fr !important;
                    }

                    .admin-table-wrap {
                        overflow-x: auto !important;
                    }

                    .admin-table {
                        min-width: 760px;
                    }
                }

                @media (max-width: 1024px) {
                    .admin-page {
                        padding: 16px 0 18px !important;
                    }

                    .admin-page-heading {
                        display: none !important;
                    }

                    .admin-stats-grid {
                        grid-template-columns: 1fr 1fr !important;
                        gap: 10px !important;
                    }

                    .admin-stat-card {
                        padding: 14px !important;
                        border-radius: 14px !important;
                    }

                    .admin-grid {
                        gap: 12px !important;
                    }

                    .admin-card {
                        padding: 12px 10px !important;
                        border-radius: 14px !important;
                        overflow: visible !important;
                    }

                    .admin-table-wrap {
                        width: 100% !important;
                        max-width: 100% !important;
                        overflow: visible !important;
                    }

                    .admin-table,
                    .admin-table thead,
                    .admin-table tbody,
                    .admin-table tr,
                    .admin-table th,
                    .admin-table td {
                        display: block !important;
                        width: 100% !important;
                        min-width: 0 !important;
                        max-width: 100% !important;
                    }

                    .admin-table {
                        table-layout: auto !important;
                    }

                    .admin-table thead {
                        display: none !important;
                    }

                    .admin-user-row {
                        margin: 12px 0 0 !important;
                        border: 1px solid #e2e8f0 !important;
                        border-radius: 14px !important;
                        overflow: visible !important;
                        background: #ffffff !important;
                        width: 100% !important;
                        max-width: 100% !important;
                    }

                    .admin-table td {
                        display: grid !important;
                        grid-template-columns: 108px minmax(0, 1fr) !important;
                        gap: 8px !important;
                        padding: 10px 12px !important;
                        border-bottom: 1px solid #f1f5f9 !important;
                        overflow-wrap: anywhere !important;
                        align-items: center !important;
                        min-width: 0 !important;
                        max-width: 100% !important;
                    }

                    .admin-table td::before {
                        content: attr(data-label);
                        color: #94a3b8;
                        font-size: 10px;
                        font-weight: 800;
                        letter-spacing: 0.7px;
                        text-transform: uppercase;
                        overflow-wrap: normal;
                    }

                    .admin-permission-menu {
                        position: static !important;
                        width: 100% !important;
                        grid-column: 2 !important;
                        margin-top: 8px !important;
                        box-shadow: none !important;
                    }

                    .admin-permission-button,
                    .admin-action-button,
                    .admin-status-badge {
                        width: 100% !important;
                        max-width: 100% !important;
                        min-width: 0 !important;
                        box-sizing: border-box !important;
                    }

                    .admin-status-badge {
                        justify-content: flex-start !important;
                    }

                    .admin-action-button {
                        display: inline-flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        overflow: hidden !important;
                        text-overflow: ellipsis !important;
                        white-space: nowrap !important;
                    }
                }

                @media (max-width: 520px) {
                    .admin-stats-grid {
                        grid-template-columns: 1fr !important;
                    }

                    .admin-table td {
                        grid-template-columns: 1fr !important;
                        gap: 6px !important;
                        padding: 11px 12px !important;
                        align-items: start !important;
                    }

                    .admin-table td::before {
                        white-space: nowrap !important;
                    }

                    .admin-permission-menu {
                        grid-column: 1 !important;
                    }
                }
            `}</style>
            <div className="admin-page-heading">
                <h1 style={S.title} className="admin-title">Admin Dashboard</h1>
                <p style={S.sub}>Manage Sales and Marketing users</p>
            </div>
            <div style={S.statsGrid} className="admin-stats-grid">
                <Stat title="Total Users" value={stats.total} />
                <Stat title="Sales Users" value={stats.sales} />
                <Stat title="Marketing Users" value={stats.marketing} />
                <Stat title="Active Users" value={stats.active} />
            </div>

            <div style={S.grid} className="admin-grid">
                <div style={S.card} className="admin-card">
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
                        onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })}
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

                <div style={S.card} className="admin-card">
                    <h2 style={S.cardTitle}>Users</h2>

                    {loading ? (
                        <p style={S.muted}>Loading users...</p>
                    ) : (
                        <div style={S.tableWrap} className="admin-table-wrap">
                            <table style={S.table} className="admin-table">
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
                                        <tr key={user._id} className="admin-user-row">
                                            <td data-label="Name" style={{ ...S.td, cursor: "pointer", fontWeight: "700", color: "#ff6b35" }} onClick={() => setSelectedUserDetailsUser(user)}>{user.name}</td>
                                            <td data-label="Email" style={{ ...S.td, cursor: "pointer" }} onClick={() => setSelectedUserDetailsUser(user)}>{(user.email || "").toLowerCase()}</td>
                                            <td data-label="Role" style={{ ...S.td, textTransform: "capitalize" }}>{user.role}</td>
                                            <td data-label="Department" style={{ ...S.td, textTransform: "capitalize" }}>{user.department}</td>
                                            <td data-label="Permissions" style={{ ...S.td, position: "relative" }}>
                                                {user.role === "admin" ? (
                                                    <span style={S.muted}>All access</span>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            style={S.permissionMenuBtn}
                                                            className="admin-permission-button"
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
                                                            <>
                                                                <div
                                                                    style={{
                                                                        position: "fixed",
                                                                        top: 0,
                                                                        left: 0,
                                                                        right: 0,
                                                                        bottom: 0,
                                                                        zIndex: 10,
                                                                        background: "transparent",
                                                                    }}
                                                                    onClick={() => setOpenPermissionsUserId(null)}
                                                                />
                                                                <div style={S.permissionMenu} className="admin-permission-menu">
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
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                            </td>
                                            <td data-label="Status" style={S.td}>
                                                <span
                                                    style={{
                                                        ...S.badge,
                                                        background: user.isActive ? "#dcfce7" : "#fee2e2",
                                                        color: user.isActive ? "#166534" : "#991b1b",
                                                    }}
                                                    className="admin-status-badge"
                                                >
                                                    {user.isActive ? "Active" : "Disabled"}
                                                </span>
                                            </td>
                                            <td data-label="Action" style={S.td}>
                                                {user.role === "admin" ? (
                                                    <span style={S.muted}>Protected</span>
                                                ) : (
                                                    <div style={{ display: "flex", gap: "6px" }}>
                                                        <button
                                                            style={S.smallBtn}
                                                            className="admin-action-button"
                                                            onClick={() => handleToggleStatus(user)}
                                                        >
                                                            {user.isActive ? "Disable" : "Enable"}
                                                        </button>
                                                        <button
                                                            style={{
                                                                ...S.smallBtn,
                                                                background: "#fee2e2",
                                                                color: "#b91c1c",
                                                                borderColor: "#fca5a5"
                                                            }}
                                                            className="admin-action-button"
                                                            onClick={() => handleDeleteUser(user)}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
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
            {deleteConfirmUser && (
                <div style={S.modalOverlay}>
                    <div style={S.modalContent}>
                        <div style={S.modalIcon}>⚠️</div>
                        <h3 style={S.modalTitle}>Delete User</h3>
                        <p style={S.modalText}>
                            Are you sure you want to permanently delete user <strong>{deleteConfirmUser.name}</strong>?
                            This action cannot be undone and they will lose access.
                        </p>
                        <div style={S.modalActions}>
                            <button style={S.modalCancelBtn} onClick={() => setDeleteConfirmUser(null)}>
                                Cancel
                            </button>
                            <button
                                style={S.modalConfirmBtn}
                                onClick={() => {
                                    confirmDeleteUser(deleteConfirmUser);
                                }}
                            >
                                Delete User
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {selectedUserDetailsUser && (
                <div style={S.modalOverlay}>
                    <div style={{ ...S.modalContent, maxWidth: "960px", width: "95%", textAlign: "left" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                            <h3 style={{ ...S.modalTitle, margin: 0 }}>User Metrics & Scraped Leads</h3>
                            <button
                                style={{
                                    border: "none",
                                    background: "transparent",
                                    fontSize: "20px",
                                    cursor: "pointer",
                                    color: "#94a3b8"
                                }}
                                onClick={() => {
                                    setSelectedUserDetailsUser(null);
                                    setNewPasswordInput("");
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                            {/* Left Column: User Profile & Password */}
                            <div style={{ flex: "1 1 300px", minWidth: "300px" }}>
                                <h4 style={{ fontSize: "14px", fontWeight: "800", marginBottom: "12px", color: "#64748b", textTransform: "uppercase" }}>Account Profile</h4>
                                
                                <div style={S.detailRow}>
                                    <span style={S.detailLabel}>Name:</span>
                                    <span style={S.detailVal}>{selectedUserDetailsUser.name}</span>
                                </div>
                                <div style={S.detailRow}>
                                    <span style={S.detailLabel}>Email:</span>
                                    <span style={S.detailVal}>{selectedUserDetailsUser.email}</span>
                                </div>
                                <div style={S.detailRow}>
                                    <span style={S.detailLabel}>Department:</span>
                                    <span style={{ ...S.detailVal, textTransform: "capitalize" }}>{selectedUserDetailsUser.department}</span>
                                </div>
                                <div style={S.detailRow}>
                                    <span style={S.detailLabel}>Role:</span>
                                    <span style={{ ...S.detailVal, textTransform: "capitalize" }}>{selectedUserDetailsUser.role}</span>
                                </div>
                                <div style={S.detailRow}>
                                    <span style={S.detailLabel}>Status:</span>
                                    <span style={{
                                        ...S.badge,
                                        background: selectedUserDetailsUser.isActive ? "#dcfce7" : "#fee2e2",
                                        color: selectedUserDetailsUser.isActive ? "#166534" : "#991b1b",
                                        display: "inline-block",
                                        padding: "3px 8px",
                                        fontSize: "11px"
                                    }}>
                                        {selectedUserDetailsUser.isActive ? "Active" : "Disabled"}
                                    </span>
                                </div>
                                <div style={{ ...S.detailRow, borderBottom: "2px solid #f1f5f9", paddingBottom: "14px", marginBottom: "14px" }}>
                                    <span style={S.detailLabel}>Total Leads:</span>
                                    <span style={{ ...S.detailVal, color: "#ff6b35", fontWeight: "800", fontSize: "16px" }}>
                                        {selectedUserDetailsUser.leadCount ?? 0} leads
                                    </span>
                                </div>

                                <div style={{ marginTop: "16px" }}>
                                    <h4 style={{ fontSize: "14px", fontWeight: "800", marginBottom: "10px", color: "#64748b", textTransform: "uppercase" }}>Password Settings</h4>
                                    <div style={S.detailRow}>
                                        <span style={S.detailLabel}>Current Password:</span>
                                        <span style={{ ...S.detailVal, fontFamily: "monospace", fontSize: "13px", background: "#f8fafc", padding: "4px 8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                                            {selectedUserDetailsUser.plaintextPassword || "Not Set / Encrypted"}
                                        </span>
                                    </div>

                                    <div style={{ marginTop: "14px", display: "flex", gap: "8px", flexDirection: "column" }}>
                                        <label style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>Change Password</label>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <input
                                                type="text"
                                                placeholder="New password (min 6 chars)"
                                                value={newPasswordInput}
                                                onChange={(e) => setNewPasswordInput(e.target.value)}
                                                style={{ ...S.input, margin: 0, padding: "8px 12px", height: "38px" }}
                                            />
                                            <button
                                                style={{ ...S.primaryBtn, width: "auto", padding: "0 16px", height: "38px" }}
                                                onClick={handleResetUserPassword}
                                            >
                                                Update
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Scraped Leads list */}
                            <div style={{ flex: "2 2 450px", minWidth: "300px", display: "flex", flexDirection: "column" }}>
                                <h4 style={{ fontSize: "14px", fontWeight: "800", marginBottom: "12px", color: "#64748b", textTransform: "uppercase" }}>
                                    Scraped Leads List ({userLeads.length})
                                </h4>
                                
                                <div style={{
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "12px",
                                    maxHeight: "360px",
                                    overflowY: "auto",
                                    background: "#f8fafc"
                                }}>
                                    {loadingUserLeads ? (
                                        <p style={{ padding: "20px", color: "#64748b", fontSize: "13px" }}>Loading user leads...</p>
                                    ) : userLeads.length === 0 ? (
                                        <p style={{ padding: "20px", color: "#64748b", fontSize: "13px" }}>No leads scraped by this user yet.</p>
                                    ) : (
                                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                                            <thead>
                                                <tr style={{ background: "#f1f5f9", position: "sticky", top: 0, zIndex: 1 }}>
                                                    <th style={{ ...S.th, padding: "8px 12px" }}>Business</th>
                                                    <th style={{ ...S.th, padding: "8px 12px" }}>Phone</th>
                                                    <th style={{ ...S.th, padding: "8px 12px" }}>Email</th>
                                                    <th style={{ ...S.th, padding: "8px 12px" }}>Website</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {userLeads.map((lead, idx) => (
                                                    <tr key={lead._id || idx} style={{ borderBottom: "1px solid #e2e8f0", background: "#ffffff" }}>
                                                        <td style={{ padding: "8px 12px", fontWeight: "600", color: "#0f172a" }}>{lead.name}</td>
                                                        <td style={{ padding: "8px 12px", color: "#475569" }}>{lead.phone || "—"}</td>
                                                        <td style={{ padding: "8px 12px", color: "#059669", fontWeight: "600" }}>{lead.email || "—"}</td>
                                                        <td style={{ padding: "8px 12px" }}>
                                                            {lead.website ? (
                                                                <a
                                                                    href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    style={{ color: "#ff6b35", textDecoration: "none", fontWeight: "600" }}
                                                                >
                                                                    Website ↗
                                                                </a>
                                                            ) : "—"}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
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
        <div style={S.statCard} className="admin-stat-card">
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
        color: "#0f172a",
    },

    sub: {
        color: "#475569",
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
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)",
    },

    statValue: {
        fontSize: "28px",
        fontWeight: "800",
        color: "#ff6b35",
    },

    statTitle: {
        fontSize: "13px",
        color: "#475569",
        marginTop: "6px",
        fontWeight: "600",
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
        padding: "20px",
        boxSizing: "border-box",
        minWidth: 0,
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)",
    },

    cardTitle: {
        fontSize: "20px",
        fontWeight: "800",
        marginBottom: "16px",
        color: "#0f172a",
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
        background: "#ffffff",
        color: "#0f172a",
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
        transition: "opacity 0.2s",
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
        overflowX: "auto",
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
        gap: "8px",
        color: "#334155",
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
        border: "1px solid #cbd5e1",
        borderRadius: "9px",
        background: "#ffffff",
        color: "#334155",
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
        fontWeight: "700",
        whiteSpace: "nowrap",
    },

    td: {
        padding: "10px 8px",
        borderBottom: "1px solid #f1f5f9",
        color: "#334155",
        wordBreak: "keep-all",
        whiteSpace: "nowrap",
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
        color: "#0f172a",
        cursor: "pointer",
        fontWeight: "700",
        whiteSpace: "nowrap",
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

    modalOverlay: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.4)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
    },

    modalContent: {
        background: "#ffffff",
        borderRadius: "20px",
        padding: "24px",
        width: "100%",
        maxWidth: "400px",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        textAlign: "center",
        color: "#0f172a",
        border: "1px solid #e2e8f0",
    },

    modalIcon: {
        fontSize: "36px",
        marginBottom: "12px",
    },

    modalTitle: {
        fontSize: "20px",
        fontWeight: "800",
        margin: "0 0 8px 0",
        color: "#0f172a",
    },

    modalText: {
        fontSize: "14px",
        color: "#475569",
        lineHeight: "1.5",
        margin: "0 0 20px 0",
    },

    modalActions: {
        display: "flex",
        gap: "10px",
        justifyContent: "center",
    },

    modalCancelBtn: {
        padding: "10px 18px",
        border: "1px solid #cbd5e1",
        borderRadius: "10px",
        background: "#ffffff",
        color: "#0f172a",
        fontWeight: "700",
        cursor: "pointer",
        fontSize: "14px",
    },

    modalConfirmBtn: {
        padding: "10px 18px",
        border: "none",
        borderRadius: "10px",
        background: "#dc2626",
        color: "#ffffff",
        fontWeight: "700",
        cursor: "pointer",
        fontSize: "14px",
    },

    detailRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid #f1f5f9",
        fontSize: "13px",
    },

    detailLabel: {
        fontWeight: "600",
        color: "#64748b",
    },

    detailVal: {
        fontWeight: "700",
        color: "#0f172a",
    },
};
