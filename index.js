const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
dotenv.config();
const compression = require("compression");
const morgan = require("morgan");
const { logger, httpLogger } = require("./config/logger");
const xss = require("xss");
const { startBookingScheduler } = require("./utils/bookigScheduler");



if (!process.env.JWT_SECRET) {
    console.error("CRITICAL ERROR: JWT_SECRET environment variable is missing.");
    process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
    console.error("CRITICAL ERROR: JWT_SECRET is too short. It must be at least 32 characters.");
    process.exit(1);
}

const PORT = process.env.PORT || 3000; 

const morganStream = {
    write:(message)=>{
        logger.info(message.trim());
    }
};

// Express 5 compatible in-place MongoDB Injection Protection
const sanitizeNoSql = (req, res, next) => {
    const sanitize = (obj) => {
        if (obj instanceof Object) {
            for (const key in obj) {
                if (key.startsWith("$") || key.includes(".")) {
                    delete obj[key];
                } else {
                    sanitize(obj[key]);
                }
            }
        }
        return obj;
    };
    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);
    next();
};

// Express 5 compatible HTTP Parameter Pollution protection
const preventHpp = (req, res, next) => {
    if (req.query) {
        for (const key in req.query) {
            if (Array.isArray(req.query[key])) {
                req.query[key] = req.query[key][req.query[key].length - 1];
            }
        }
    }
    next();
};

const sanitizeXss = (req, res, next) => {
    const sanitize = (obj) => {
        if (obj instanceof Object) {
            for (const key in obj) {
                if (typeof obj[key] === "string") {
                    obj[key] = xss(obj[key]);
                } else {
                    sanitize(obj[key]);
                }
            }
        }
    };
    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);
    next();
};

const httpLoggingMiddleware = (req, res, next) => {
    const startTime = Date.now();
    const reqBody = req.body ? { ...req.body } : {};

    const originalSend = res.send;
    let resBody;
    res.send = function (chunk) {
        resBody = chunk;
        return originalSend.apply(res, arguments);
    };

    const sanitizeSensitiveData = (obj) => {
        if (obj instanceof Object) {
            for (const key in obj) {
                const lowerKey = key.toLowerCase();
                if (
                    lowerKey.includes("password") || 
                    lowerKey.includes("token") || 
                    lowerKey.includes("jwt") || 
                    lowerKey.includes("secret") ||
                    lowerKey.includes("key")
                ) {
                    obj[key] = "******";
                } else {
                    sanitizeSensitiveData(obj[key]);
                }
            }
        }
        return obj;
    };

    res.on("finish", () => {
        const duration = Date.now() - startTime;
        let parsedResBody = resBody;
        try {
            if (typeof resBody === "string") {
                parsedResBody = JSON.parse(resBody);
            }
        } catch (e) {
            // Keep as is
        }

        const reqLog = reqBody ? JSON.parse(JSON.stringify(reqBody)) : {};
        let resLog = parsedResBody ? JSON.parse(JSON.stringify(parsedResBody)) : {};

        sanitizeSensitiveData(reqLog);
        sanitizeSensitiveData(resLog);

        const logPayload = {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            requestBody: reqLog,
            responseBody: resLog
        };

        httpLogger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`, logPayload);
    });

    next();
};

const connectDB = require("./config/db");
require("./models/userModel");
require("./models/productInfoModel");
require("./models/productOrderModel");
require("./models/shipmentModel");
const productOrderRoutes = require("./routes/productOrderRoute");
const shipmentRoutes = require("./routes/shipmentRoute");
const authRoutes = require("./routes/authRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const uploadRoute = require("./routes/uploadRoute");
const settingRoutes = require("./routes/settingRoutes");
const { initRedis } = require("./config/redis");



const errorHandler = require("./middlewares/errorMiddleware");




const app = express();

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
    app.use((req, res, next) => {
        if (req.secure || req.headers["x-forwarded-proto"] === "https") {
            return next();
        }
        res.redirect(301, "https://" + req.headers.host + req.originalUrl);
    });
}

app.get("/health", (req, res) => {
    const mongoose = require("mongoose");
    const dbConnected = mongoose.connection.readyState === 1;
    res.status(dbConnected ? 200 : 503).json({
        status: dbConnected ? "UP" : "DOWN",
        database: dbConnected ? "CONNECTED" : "DISCONNECTED",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});
app.use(compression());
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
            connectSrc: ["'self'", "https://api.razorpay.com"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: []
        }
    }
}));
app.use(cors());
app.use(express.json({
    limit: "1mb",
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    }
}));
app.use(sanitizeXss);
app.use(sanitizeNoSql);
app.use(preventHpp);
app.use(httpLoggingMiddleware);

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: ["Too many requests from this IP, please try again after 15 minutes."]
    }
});
app.use("/api", limiter);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", { stream: morganStream }));

const { authenticateJWT } = require("./middlewares/authMiddleware");
const labelController = require("./controllers/labelController");

app.get("/labels/:filename", authenticateJWT, labelController.serveLabel);
app.use("/api/auth", authRoutes); 

app.use(
    "/api/orders",
    productOrderRoutes
);
app.use("/api/shipments", shipmentRoutes);
app.use("/api/v1", subscriptionRoutes
);
app.use("/api/upload", uploadRoute);
app.use("/api/admin/settings", settingRoutes);

app.use(errorHandler);
const startServer = async () => {
    try {
        await connectDB();
        startBookingScheduler();
        await initRedis();

        const server = app.listen(PORT, () => {
            logger.info(`server is running at ${PORT}`);
        });

       
        server.requestTimeout = 30000; 
        server.headersTimeout = 31000;
        server.keepAliveTimeout = 5000;

    } catch (error) {
        logger.error("Database connection failed:", error);
        process.exit(1);
    }
};


if (require.main === module) {
    startServer();
}

module.exports = app;


