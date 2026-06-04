const express = require("express");
const bcrypt = require("bcryptjs");
const Joi = require("joi");

const User = require("../models/User");
const { auth } = require("../middleware/auth");

const defaultPermissions = {
    canScrape: true,
    canViewLeads: true,
    canExportCsv: true,
};

const router = express.Router();

function requireAdmin(req, res, next) {
    if (req.user.role !== "admin" || req.user.department !== "admin") {
        return res.status(403).json({
            message: "Admin access required",
        });
    }

    next();
}

// GET all users
router.get("/", auth, requireAdmin, async (req, res) => {
    try {
        const users = await User.find()
            .select("-password -passwordResetToken -passwordResetExpires")
            .sort({ createdAt: -1 });

        res.json({ users });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Failed to fetch users",
        });
    }
});

// CREATE sales/marketing user
router.post("/", auth, requireAdmin, async (req, res) => {
    try {
        const schema = Joi.object({
            name: Joi.string().trim().required(),
            email: Joi.string().email().lowercase().trim().required(),
            password: Joi.string().min(6).required(),
            department: Joi.string().valid("sales", "marketing").required(),
            permissions: Joi.object({
                canScrape: Joi.boolean().required(),
                canViewLeads: Joi.boolean().required(),
                canExportCsv: Joi.boolean().required(),
            }).default(defaultPermissions),
        });

        const { error, value } = schema.validate(req.body);

        if (error) {
            return res.status(400).json({
                message: error.details[0].message,
            });
        }

        const existingUser = await User.findOne({ email: value.email });

        if (existingUser) {
            return res.status(409).json({
                message: "User with this email already exists",
            });
        }

        const hashedPassword = await bcrypt.hash(value.password, 10);

        const user = await User.create({
            name: value.name,
            email: value.email,
            password: hashedPassword,
            role: "user",
            department: value.department,
            permissions: value.permissions,
            isActive: true,
        });

        res.status(201).json({
            message: "User created successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                permissions: user.permissions,
                isActive: user.isActive,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Failed to create user",
        });
    }
});

router.patch("/:id/permissions", auth, requireAdmin, async (req, res) => {
    try {
        const schema = Joi.object({
            permissions: Joi.object({
                canScrape: Joi.boolean().required(),
                canViewLeads: Joi.boolean().required(),
                canExportCsv: Joi.boolean().required(),
            }).required(),
        });

        const { error, value } = schema.validate(req.body);

        if (error) {
            return res.status(400).json({
                message: error.details[0].message,
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        if (user.role === "admin") {
            return res.status(400).json({
                message: "Admin permissions cannot be changed",
            });
        }

        user.permissions = value.permissions;
        await user.save();

        res.json({
            message: "Permissions updated successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                permissions: user.permissions,
                isActive: user.isActive,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Failed to update permissions",
        });
    }
});

// ENABLE / DISABLE user
router.patch("/:id/status", auth, requireAdmin, async (req, res) => {
    try {
        const schema = Joi.object({
            isActive: Joi.boolean().required(),
        });

        const { error, value } = schema.validate(req.body);

        if (error) {
            return res.status(400).json({
                message: error.details[0].message,
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        if (user.role === "admin") {
            return res.status(400).json({
                message: "Admin account cannot be disabled",
            });
        }

        user.isActive = value.isActive;
        await user.save();

        res.json({
            message: value.isActive
                ? "User enabled successfully"
                : "User disabled successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                permissions: user.permissions,
                isActive: user.isActive,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Failed to update user status",
        });
    }
});

module.exports = router;
