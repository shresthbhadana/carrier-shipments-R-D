const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db")
const productOrderRoutes = require("./routes/productOrderRoute");
const shipmentRoutes = require("./routes/shipmentRoute");


dotenv.config();

const app = express();

app.use(express.json());
connectDB();
app.use(
    "/api/orders",
    productOrderRoutes
);
app.use("/api/shipments", shipmentRoutes);

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});