const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
dotenv.config();

if (!process.env.JWT_SECRET) {
    console.error("CRITICAL ERROR: JWT_SECRET environment variable is missing.");
    process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
    console.error("CRITICAL ERROR: JWT_SECRET is too short. It must be at least 32 characters.");
    process.exit(1);
}

const PORT = process.env.PORT || 3000; 

const connectDB = require("./config/db");
require("./models/userModel");
require("./models/productInfoModel");
require("./models/productOrderModel");
require("./models/shipmentModel");
const productOrderRoutes = require("./routes/productOrderRoute");
const shipmentRoutes = require("./routes/shipmentRoute");
const authRoutes = require("./routes/authRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");


const errorHandler = require("./middlewares/errorMiddleware");




const app = express();

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

app.use(helmet());
app.use(cors());
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    }
}));

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

const { authenticateJWT } = require("./middlewares/authMiddleware");
const labelController = require("./controllers/labelController");

app.get("/labels/:filename", authenticateJWT, labelController.serveLabel);
app.use("/api/auth", authRoutes); 

app.use(
    "/api/orders",
    productOrderRoutes
);
app.use("/api/shipments", shipmentRoutes);
app.use("/api/shipment", shipmentRoutes);
app.use("/api/v1", subscriptionRoutes
);
app.use(errorHandler);
const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (error) {
        console.error("Database connection failed:", error);
        process.exit(1);
    }
};

if (require.main === module) {
    startServer();
}

module.exports = app;