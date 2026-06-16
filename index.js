const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
require("./models/userModel");
const productOrderRoutes = require("./routes/productOrderRoute");
const shipmentRoutes = require("./routes/shipmentRoute");


dotenv.config();

const app = express();

app.use(express.json());
app.use("/labels", express.static(path.join(__dirname, "labels")));
connectDB();
app.use(
    "/api/orders",
    productOrderRoutes
);
app.use("/api/shipments", shipmentRoutes);

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});