const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            required: true,
        },

        role: {
            type: String,
            enum: ["admin", "user"],
            required: true,
        },

        department: {
            type: String,
            enum: ["admin", "sales", "marketing"],
            required: true,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        permissions: {
            canScrape: {
                type: Boolean,
                default: true,
            },
            canViewLeads: {
                type: Boolean,
                default: true,
            },
            canExportCsv: {
                type: Boolean,
                default: true,
            },
        },

        passwordResetToken: {
            type: String,
        },

        passwordResetExpires: {
            type: Date,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
