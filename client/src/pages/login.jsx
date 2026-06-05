import { useState } from "react";
import axios from "axios";

const API_BASE = "https://map.codeqlik.com/api";

export default function Login({ onLoginSuccess }) {
    const initialResetToken = new URLSearchParams(window.location.search).get("resetToken") || "";

    const [loginForm, setLoginForm] = useState({
        department: "sales",
        email: "",
        password: "",
    });

    const [view, setView] = useState(initialResetToken ? "reset" : "login");
    const [forgotEmail, setForgotEmail] = useState("");
    const [resetToken, setResetToken] = useState(initialResetToken);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [message, setMessage] = useState("");
    const [loginLoading, setLoginLoading] = useState(false);

    const clearFeedback = () => {
        setLoginError("");
        setMessage("");
    };

    const handleLogin = async () => {
        try {
            setLoginLoading(true);
            clearFeedback();

            const res = await axios.post(`${API_BASE}/auth/login`, loginForm);

            onLoginSuccess({
                token: res.data.token,
                user: res.data.user,
            });
        } catch (err) {
            setLoginError(err.response?.data?.message || "Login failed");
        } finally {
            setLoginLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        try {
            setLoginLoading(true);
            clearFeedback();

            const res = await axios.post(`${API_BASE}/auth/forgot-password`, {
                email: forgotEmail,
            });

            setMessage(res.data.message);
        } catch (err) {
            setLoginError(err.response?.data?.message || "Failed to request password reset");
        } finally {
            setLoginLoading(false);
        }
    };

    const handleResetPassword = async () => {
        try {
            setLoginLoading(true);
            clearFeedback();

            if (newPassword !== confirmPassword) {
                setLoginError("Passwords do not match");
                return;
            }

            const res = await axios.post(`${API_BASE}/auth/reset-password`, {
                token: resetToken,
                password: newPassword,
            });

            setMessage(res.data.message);
            setView("login");
            setResetToken("");
            setNewPassword("");
            setConfirmPassword("");
            window.history.replaceState({}, "", window.location.pathname);
        } catch (err) {
            setLoginError(err.response?.data?.message || "Failed to reset password");
        } finally {
            setLoginLoading(false);
        }
    };

    return (
        <div style={S.page} className="login-page">
            <style>{`
                @media (max-width: 480px) {
                    .login-page {
                        min-height: 100svh !important;
                        padding: 18px 12px !important;
                        align-items: flex-start !important;
                    }

                    .login-card {
                        max-width: 100% !important;
                        padding: 24px 18px !important;
                        border-radius: 18px !important;
                        margin-top: 20px !important;
                    }

                    .login-card h2 {
                        font-size: 24px !important;
                    }

                    .login-card input,
                    .login-card select {
                        font-size: 16px !important;
                        touch-action: manipulation;
                    }
                }
            `}</style>
            <div style={S.loginCard} className="login-card">
                <div style={S.brand}>
                    <div style={S.brandIcon}>📍</div>
                    <span style={S.brandName}>LeadScraper</span>
                </div>

                {view === "login" && (
                    <>
                        <h2 style={S.loginTitle}>Team Login</h2>
                        <p style={S.loginSub}>Login as Admin, Sales, or Marketing team</p>

                        <select
                            style={{ ...S.selectInput, paddingLeft: "16px", marginTop: "18px" }}
                            value={loginForm.department}
                            onChange={(e) =>
                                setLoginForm({ ...loginForm, department: e.target.value })
                            }
                        >
                            <option value="admin">Admin</option>
                            <option value="sales">Sales</option>
                            <option value="marketing">Marketing</option>
                        </select>

                        <input
                            style={{ ...S.input, paddingLeft: "16px", marginTop: "18px" }}
                            type="email"
                            name="email"
                            inputMode="email"
                            autoComplete="email"
                            enterKeyHint="next"
                            placeholder="Email"
                            value={loginForm.email}
                            onChange={(e) =>
                                setLoginForm({ ...loginForm, email: e.target.value })
                            }
                        />

                        <input
                            style={{ ...S.input, paddingLeft: "16px", marginTop: "12px" }}
                            type="password"
                            placeholder="Password"
                            value={loginForm.password}
                            onChange={(e) =>
                                setLoginForm({ ...loginForm, password: e.target.value })
                            }
                            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                        />

                        <button
                            type="button"
                            style={S.linkBtn}
                            onClick={() => {
                                clearFeedback();
                                setForgotEmail(loginForm.email);
                                setView("forgot");
                            }}
                        >
                            Forgot password?
                        </button>
                    </>
                )}

                {view === "forgot" && (
                    <>
                        <h2 style={S.loginTitle}>Forgot Password</h2>
                        <p style={S.loginSub}>Enter your email to generate a reset link.</p>

                        <input
                            style={{ ...S.input, paddingLeft: "16px", marginTop: "18px" }}
                            type="email"
                            name="forgot-email"
                            inputMode="email"
                            autoComplete="email"
                            enterKeyHint="send"
                            placeholder="Email"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleForgotPassword()}
                        />
                    </>
                )}

                {view === "reset" && (
                    <>
                        <h2 style={S.loginTitle}>Reset Password</h2>
                        <p style={S.loginSub}>Choose a new password for your account.</p>

                        <input
                            style={{ ...S.input, paddingLeft: "16px", marginTop: "18px" }}
                            type="password"
                            placeholder="New password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                        />

                        <input
                            style={{ ...S.input, paddingLeft: "16px", marginTop: "12px" }}
                            type="password"
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                        />
                    </>
                )}

                {loginError && <div style={S.errorBox}>⚠ {loginError}</div>}
                {message && <div style={S.successBox}>{message}</div>}

                {view === "login" && (
                    <button
                        style={{
                            ...S.searchBtn,
                            width: "100%",
                            justifyContent: "center",
                            marginTop: "18px",
                            opacity: loginLoading ? 0.7 : 1,
                            cursor: loginLoading ? "not-allowed" : "pointer",
                        }}
                        onClick={handleLogin}
                        disabled={loginLoading}
                    >
                        {loginLoading ? "Logging in..." : "Login"}
                    </button>
                )}

                {view === "forgot" && (
                    <>
                        <button
                            style={{
                                ...S.searchBtn,
                                width: "100%",
                                justifyContent: "center",
                                marginTop: "18px",
                                opacity: loginLoading ? 0.7 : 1,
                                cursor: loginLoading ? "not-allowed" : "pointer",
                            }}
                            onClick={handleForgotPassword}
                            disabled={loginLoading}
                        >
                            {loginLoading ? "Sending..." : "Send Reset Link"}
                        </button>
                        <button
                            type="button"
                            style={S.secondaryBtn}
                            onClick={() => {
                                clearFeedback();
                                setView("login");
                            }}
                        >
                            Back to login
                        </button>
                    </>
                )}

                {view === "reset" && (
                    <button
                        style={{
                            ...S.searchBtn,
                            width: "100%",
                            justifyContent: "center",
                            marginTop: "18px",
                            opacity: loginLoading ? 0.7 : 1,
                            cursor: loginLoading ? "not-allowed" : "pointer",
                        }}
                        onClick={handleResetPassword}
                        disabled={loginLoading}
                    >
                        {loginLoading ? "Resetting..." : "Reset Password"}
                    </button>
                )}
            </div>
        </div>
    );
}

const S = {
    page: {
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#334155",
        fontFamily: "'Inter', sans-serif",
        padding: "0 0 80px",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },

    loginCard: {
        width: "420px",
        maxWidth: "calc(100vw - 32px)",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "22px",
        padding: "32px",
        boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
        position: "relative",
        zIndex: 10,
    },

    brand: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
    },

    brandIcon: {
        width: "36px",
        height: "36px",
        borderRadius: "10px",
        background: "rgba(255,107,53,0.1)",
        border: "1px solid rgba(255,107,53,0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 0 15px rgba(255,107,53,0.1)",
    },

    brandName: {
        fontSize: "18px",
        fontWeight: "800",
        color: "#0f172a",
        letterSpacing: "-0.4px",
        fontFamily: "'Outfit', sans-serif",
    },

    loginTitle: {
        fontSize: "28px",
        fontWeight: "800",
        color: "#0f172a",
        marginTop: "28px",
        fontFamily: "'Outfit', sans-serif",
    },

    loginSub: {
        fontSize: "14px",
        color: "#64748b",
        marginTop: "6px",
    },

    input: {
        width: "100%",
        boxSizing: "border-box",
        padding: "14px 16px 14px 40px",
        background: "#ffffff",
        border: "1px solid #cbd5e1",
        borderRadius: "12px",
        color: "#0f172a",
        fontSize: "14px",
        outline: "none",
        fontFamily: "'Inter', sans-serif",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    },

    selectInput: {
        width: "100%",
        boxSizing: "border-box",
        padding: "14px 32px 14px 40px",
        background: "#ffffff",
        border: "1px solid #cbd5e1",
        borderRadius: "12px",
        color: "#0f172a",
        fontSize: "14px",
        outline: "none",
        fontFamily: "'Inter', sans-serif",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: "pointer",
        appearance: "none",
        WebkitAppearance: "none",
        MozAppearance: "none",
    },

    searchBtn: {
        padding: "14px 28px",
        background: "linear-gradient(135deg, #ff6b35, #ff4500)",
        border: "none",
        borderRadius: "12px",
        color: "#fff",
        fontWeight: "700",
        fontSize: "14px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        whiteSpace: "nowrap",
        fontFamily: "'Outfit', sans-serif",
        boxShadow: "0 6px 20px rgba(255,107,53,0.3)",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    },

    errorBox: {
        marginTop: "18px",
        padding: "12px 16px",
        background: "rgba(239, 68, 68, 0.05)",
        border: "1px solid rgba(239, 68, 68, 0.15)",
        borderRadius: "10px",
        color: "#ef4444",
        fontSize: "13px",
    },

    successBox: {
        marginTop: "18px",
        padding: "12px 16px",
        background: "rgba(22, 163, 74, 0.08)",
        border: "1px solid rgba(22, 163, 74, 0.18)",
        borderRadius: "10px",
        color: "#15803d",
        fontSize: "13px",
    },

    linkBtn: {
        border: "none",
        background: "transparent",
        color: "#ff6b35",
        fontWeight: "700",
        fontSize: "13px",
        padding: "12px 0 0",
        cursor: "pointer",
    },

    secondaryBtn: {
        width: "100%",
        marginTop: "10px",
        padding: "12px 16px",
        border: "1px solid #cbd5e1",
        borderRadius: "12px",
        background: "#ffffff",
        color: "#475569",
        fontWeight: "700",
        cursor: "pointer",
    },

    demoBox: {
        marginTop: "20px",
        padding: "14px",
        borderRadius: "12px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        fontSize: "12px",
        color: "#475569",
        lineHeight: "1.8",
    },
};
