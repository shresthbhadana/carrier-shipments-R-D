const { logSecurityEvent } = require("../utils/auditLogger");

const errorHandler = (err, req, res, next) => {
    console.error("Error Caught:", {
        message: err.message,
        stack: err.stack
    });

    const statusCode = err.statusCode || 500;

    logSecurityEvent({
        userId: req.user ? req.user.id : null,
        action: "api_error",
        status: "failure",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] || "unknown",
        details: {
            url: req.originalUrl,
            method: req.method,
            statusCode: statusCode,
            message: err.message
        }
    }).catch(e => console.error("Failed to write error audit log:", e));

    res.status(statusCode).json({
        success: false,
        message: [err.message || "Internal Server Error"],
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
};

module.exports = errorHandler;
