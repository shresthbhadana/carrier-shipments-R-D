const AuditLog = require("../models/auditLog");
const { securityLogger } = require("../config/logger");

const logSecurityEvent = async (payload) => {
    const { userId, action, status, ipAddress, userAgent, details } = payload;
    try {
        await AuditLog.create({
            userId,
            action,
            status,
            ipAddress,
            userAgent,
            details
        });

        securityLogger.info(`${action.toUpperCase()} - ${status.toUpperCase()}`, {
            userId,
            ipAddress,
            userAgent,
            details
        });
    } catch (error) {
        console.error("Failed to write audit log:", error);
    }
};

module.exports = { logSecurityEvent };
