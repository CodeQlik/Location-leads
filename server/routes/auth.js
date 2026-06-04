const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Joi = require("joi");

const User = require("../models/User");
const { getUserPermissions } = require("../middleware/auth");
const { sendPasswordResetEmail } = require("../utils/mailer");

const router = express.Router();

const createPasswordResetToken = () => {
    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    return { token, hashedToken };
};

router.post("/login", async (req, res) => {
    try {

        const schema = Joi.object({
            department: Joi.string()
                .trim()
                .lowercase()
                .valid("admin", "sales", "marketing")
                .required(),

            email: Joi.string()
                .email()
                .lowercase()
                .trim()
                .required(),

            password: Joi.string().required(),
        });

        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            return res.status(400).json({
                message: error.details.map((d) => d.message).join(", "),
            });
        }

        const user = await User.findOne({ email: value.email });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                message: "Account disabled",
            });
        }

        if (user.department !== value.department) {
            return res.status(403).json({
                message: "Selected department does not match this user account",
            });
        }

        if (value.department === "admin" && user.role !== "admin") {
            return res.status(403).json({
                message: "Only admin account can login as Admin",
            });
        }

        if (
            (value.department === "sales" || value.department === "marketing") &&
            user.role !== "user"
        ) {
            return res.status(403).json({
                message: "Only team users can login to Sales or Marketing",
            });
        }

        const isMatch = await bcrypt.compare(value.password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
                role: user.role,
                department: user.department,
                permissions: getUserPermissions(user),
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                permissions: getUserPermissions(user),
            },
        });
    } catch (err) {
        console.error("Login error:", err);

        res.status(500).json({
            message: "Login failed",
        });
    }
});

router.post("/forgot-password", async (req, res) => {
    try {
        const schema = Joi.object({
            email: Joi.string().email().lowercase().trim().required(),
        });

        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            return res.status(400).json({
                message: error.details.map((d) => d.message).join(", "),
            });
        }

        const user = await User.findOne({ email: value.email });

        if (!user) {
            return res.json({
                message: "If that email exists, a password reset link has been generated.",
            });
        }

        const { token, hashedToken } = createPasswordResetToken();
        user.passwordResetToken = hashedToken;
        user.passwordResetExpires = new Date(Date.now() + 1000 * 60 * 15);
        await user.save();

        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        const resetLink = `${clientUrl}/?resetToken=${token}`;

        try {
            await sendPasswordResetEmail({
                to: user.email,
                name: user.name,
                resetLink,
            });
        } catch (emailErr) {
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save();

            console.error("Password reset email error:", emailErr);

            return res.status(500).json({
                message: emailErr.message || "Failed to send password reset email",
            });
        }

        res.json({
            message: "If that email exists, a password reset link has been sent.",
        });
    } catch (err) {
        console.error("Forgot password error:", err);

        res.status(500).json({
            message: "Failed to generate password reset link",
        });
    }
});

router.post("/reset-password", async (req, res) => {
    try {
        const schema = Joi.object({
            token: Joi.string().required(),
            password: Joi.string().min(6).required(),
        });

        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            return res.status(400).json({
                message: error.details.map((d) => d.message).join(", "),
            });
        }

        const hashedToken = crypto
            .createHash("sha256")
            .update(value.token)
            .digest("hex");

        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: new Date() },
        });

        if (!user) {
            return res.status(400).json({
                message: "Reset link is invalid or expired",
            });
        }

        user.password = await bcrypt.hash(value.password, 10);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        res.json({
            message: "Password reset successfully. You can now login.",
        });
    } catch (err) {
        console.error("Reset password error:", err);

        res.status(500).json({
            message: "Failed to reset password",
        });
    }
});

module.exports = router;
