const userService = require("../services/userService");
const { logSecurityEvent } = require("../utils/auditLogger");
const jwt = require("jsonwebtoken");

const signup = async (req, res, next) => {
    try {
        const result = await userService.registerUser(req.body);

        await logSecurityEvent({
            userId: result.user.id,
            action: "user_signup",
            status: "success",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] || "unknown",
            details: { email: result.user.email }
        });

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: result
        });
    } catch (error) {
        await logSecurityEvent({
            userId: null,
            action: "user_signup",
            status: "failure",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] || "unknown",
            details: { email: req.body.email, error: error.message }
        });

        if (error.message.includes("exists")) {
            return res.status(400).json({
                success: false,
                message: [error.message]
            });
        }
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const result = await userService.loginUser(req.body);

        await logSecurityEvent({
            userId: result.user.id,
            action: "user_login",
            status: "success",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] || "unknown",
            details: { email: result.user.email }
        });

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: result
        });
    } catch (error) {
        await logSecurityEvent({
            userId: null,
            action: "user_login",
            status: "failure",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] || "unknown",
            details: { email: req.body.email, error: error.message }
        });

        if (error.message.includes("Invalid")) {
            return res.status(401).json({
                success: false,
                message: [error.message]
            });
        }
        next(error);
    }
};

const refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: ["Refresh token is required"]
            });
        }
        const result = await userService.refreshAuthToken(refreshToken);

        const decoded = jwt.decode(result.accessToken);
        const userId = decoded ? decoded.id : null;

        await logSecurityEvent({
            userId: userId,
            action: "token_refresh",
            status: "success",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] || "unknown",
            details: { tokenExcerpt: refreshToken.substring(0, 10) + "..." }
        });

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        await logSecurityEvent({
            userId: null,
            action: "token_refresh",
            status: "failure",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] || "unknown",
            details: { error: error.message, tokenExcerpt: req.body.refreshToken ? req.body.refreshToken.substring(0, 10) + "..." : null }
        });

        res.status(401).json({
            success: false,
            message: [error.message]
        });
    }
};

module.exports = {
    signup,
    login,
    refresh
};
