const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
    {
        query: {
            type: String,
            required: true,
            trim: true,
        },

        name: {
            type: String,
            required: true,
            trim: true,
        },

        rating: {
            type: String,
            default: "",
        },

        reviews: {
            type: String,
            default: "",
        },

        category: {
            type: String,
            default: "",
        },

        address: {
            type: String,
            default: "",
        },

        phone: {
            type: String,
            default: "",
        },

        email: {
            type: String,
            default: "",
            lowercase: true,
        },

        website: {
            type: String,
            default: "",
        },
        dedupeKey: {
            type: String,
            unique: true,
            sparse: true,
            index: true,
        },

        lastScrapedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    },
);

module.exports = mongoose.model("Lead", leadSchema);
