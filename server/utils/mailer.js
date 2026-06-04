const nodemailer = require("nodemailer");

const requiredEmailConfig = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];

function assertEmailConfig() {
    const missing = requiredEmailConfig.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Email service is not configured. Missing: ${missing.join(", ")}`);
    }
}

function createTransporter() {
    assertEmailConfig();

    const port = Number(process.env.SMTP_PORT || 587);

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE === "true" || port === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

async function sendPasswordResetEmail({ to, name, resetLink }) {
    const transporter = createTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    await transporter.sendMail({
        from,
        to,
        subject: "Reset your LeadScraper password",
        text: [
            `Hi ${name || "there"},`,
            "",
            "We received a request to reset your LeadScraper password.",
            `Open this link to choose a new password: ${resetLink}`,
            "",
            "This link expires in 15 minutes. If you did not request this, you can ignore this email.",
        ].join("\n"),
        html: `
            <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
                <h2 style="margin: 0 0 12px;">Reset your LeadScraper password</h2>
                <p>Hi ${name || "there"},</p>
                <p>We received a request to reset your LeadScraper password.</p>
                <p>
                    <a href="${resetLink}" style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">
                        Reset Password
                    </a>
                </p>
                <p style="color:#64748b;font-size:13px;">This link expires in 15 minutes. If you did not request this, you can ignore this email.</p>
            </div>
        `,
    });
}

module.exports = {
    sendPasswordResetEmail,
};
