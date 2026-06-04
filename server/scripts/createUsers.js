require("dotenv").config();

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const User = require("../models/User");

async function seedAdmin() {
    try {
        if (process.env.SEED_ADMIN_ENABLED !== "true") {
            throw new Error("Admin seed is disabled. Set SEED_ADMIN_ENABLED=true only for initial setup.");
        }

        const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

        if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
            throw new Error("ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD are required in .env");
        }

        await connectDB();

        const existingAdmin = await User.findOne({
            role: "admin",
            department: "admin",
        });

        if (existingAdmin) {
            console.log("Admin account already exists. No users were created.");
            return;
        }

        const existingEmail = await User.findOne({
            email: ADMIN_EMAIL.toLowerCase().trim(),
        });

        if (existingEmail) {
            throw new Error("A user with ADMIN_EMAIL already exists.");
        }

        const password = await bcrypt.hash(ADMIN_PASSWORD, 10);

        await User.create({
            name: ADMIN_NAME,
            email: ADMIN_EMAIL,
            password,
            role: "admin",
            department: "admin",
            permissions: {
                canScrape: true,
                canViewLeads: true,
                canExportCsv: true,
            },
            isActive: true,
        });

        console.log("Initial admin account created. Set SEED_ADMIN_ENABLED=false or remove this script after setup.");
    } catch (err) {
        console.error(err.message || err);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

seedAdmin();
