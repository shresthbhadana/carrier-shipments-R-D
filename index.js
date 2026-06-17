const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const PORT = process.env.PORT || 3000; 

const connectDB = require("./config/db");
require("./models/userModel");
require("./models/productInfoModel");
const productOrderRoutes = require("./routes/productOrderRoute");
const shipmentRoutes = require("./routes/shipmentRoute");
const authRoutes = require("./routes/authRoutes");
const errorHandler = require("./middlewares/errorMiddleware");

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

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

app.use("/labels", express.static(path.join(__dirname, "labels")));
app.use("/api/auth", authRoutes); 

app.use(
    "/api/orders",
    productOrderRoutes
);
app.use("/api/shipments", shipmentRoutes);
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

startServer();