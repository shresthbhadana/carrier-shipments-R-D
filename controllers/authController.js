const userService = require("../services/userService");
const userRepository = require("../repository/userRepository");
const { logSecurityEvent } = require("../utils/auditLogger");
const jwt = require("jsonwebtoken");
const { getRedisKey, setRedisKey } = require("../config/redis");
const { sendVerificationEmail } = require("../utils/emailService");

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
            message: ["User registered successfully"],
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

const loginStep1 = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: ["Please provide email and password"]
            });
        }
        const user = await userRepository.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: ["Invalid credentials"]
            });
        }
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: ["Invalid credentials"]
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await setRedisKey(`otp:login:${email}`, otp, 300);

        await sendVerificationEmail(email, otp);

        res.status(200).json({
            success: true,
            message: ["Verification OTP sent to your registered email address"],
            data: { email }
        });
    } catch (error) {
        next(error);
    }
};

const loginStep2Verify = async (req, res, next) => {
    try {
        const { email, otp, password } = req.body;
        if (!email || !otp || !password) {
            return res.status(400).json({
                success: false,
                message: ["Email, password, and OTP are required"]
            });
        }
        const savedOtp = await getRedisKey(`otp:login:${email}`);
        if (!savedOtp || savedOtp !== otp) {
            return res.status(401).json({
                success: false,
                message: ["Invalid or expired OTP verification code"]
            });
        }

        const result = await userService.loginUser({ email, password });

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
            message: ["2FA validation successful, logged in"],
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

const logout = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (refreshToken) {
            await setRedisKey(`blacklist:token:${refreshToken}`, "true", 604800);
        }
        res.status(200).json({
            success: true,
            message: ["Logout successful"]
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    signup,
    loginStep1,
    loginStep2Verify,
    refresh,
    logout
};
