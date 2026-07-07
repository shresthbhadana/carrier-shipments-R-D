const winston = require("winston");
const path = require("path");

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

const logger = winston.createLogger({
    level: "info",
    format: logFormat,
    defaultMeta: { service: "shipping-service" },
    transports: [
        new winston.transports.File({ 
            filename: path.join(__dirname, "../logs/error.log"), 
            level: "error",
            handleExceptions: true 
        }),
        new winston.transports.File({ 
            filename: path.join(__dirname, "../logs/combined.log"),
            handleExceptions: true 
        })
    ]
});


const httpLogger = winston.createLogger({
    level: "info",
    format: logFormat,
    defaultMeta: { service: "http-access" },
    transports: [
        new winston.transports.File({ 
            filename: path.join(__dirname, "../logs/access.log")
        })
    ]
});

if (process.env.NODE_ENV !== "production") {
    const consoleFormat = winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, stack }) => {
            return `[${timestamp}] ${level}: ${stack || message}`;
        })
    );
    logger.add(new winston.transports.Console({ format: consoleFormat }));
    httpLogger.add(new winston.transports.Console({ format: consoleFormat }));
}
const securityLogger = winston.createLogger({
    level: "info",
    format: logFormat,
    defaultMeta: { service: "security-audit" },
    transports: [
        new winston.transports.File({ 
            filename: path.join(__dirname, "../logs/security.log")
        })
    ]
});
module.exports = {
    logger,
    httpLogger,
    securityLogger
};