const jwt = require("jsonwebtoken");
const User = require("../models/User");

const defaultPermissions = {
    canScrape: true,
    canViewLeads: true,
    canExportCsv: true,
};

const getUserPermissions = (user) => {
    if (user?.role === "admin" && user?.department === "admin") {
        return defaultPermissions;
    }

    return {
        canScrape: user?.permissions?.canScrape ?? true,
        canViewLeads: user?.permissions?.canViewLeads ?? true,
        canExportCsv: user?.permissions?.canExportCsv ?? true,
    };
};

const auth = (req, res, next) => {
    try {
        const header = req.headers.authorization;

        if (!header || !header.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }

        const token = header.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded;

        next();
    } catch (err) {
        return res.status(401).json({
            message: "Invalid token",
        });
    }
};

const authorize = (...allowed) => {
    return (req, res, next) => {
        const userRole = req.user?.role?.toLowerCase()?.trim();
        const userDepartment = req.user?.department?.toLowerCase()?.trim();

        if (!allowed.includes(userRole) && !allowed.includes(userDepartment)) {
            return res.status(403).json({
                message: "Access denied",
            });
        }

        next();
    };
};

const requirePermission = (permission) => {
    return async (req, res, next) => {
        try {
            if (req.user?.role === "admin" && req.user?.department === "admin") {
                req.user.permissions = defaultPermissions;
                return next();
            }

            const user = await User.findById(req.user?.id).select("role department isActive permissions");

            if (!user || !user.isActive) {
                return res.status(403).json({
                    message: "Account disabled or not found",
                });
            }

            const permissions = getUserPermissions(user);

            if (!permissions[permission]) {
                return res.status(403).json({
                    message: "You do not have permission to perform this action",
                });
            }

            req.user.permissions = permissions;
            next();
        } catch (err) {
            return res.status(500).json({
                message: "Permission check failed",
            });
        }
    };
};

module.exports = {
    auth,
    authorize,
    requirePermission,
    getUserPermissions,
};  
