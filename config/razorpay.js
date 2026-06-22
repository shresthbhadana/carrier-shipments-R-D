const Razorpay = require("razorpay");
const path = require("path");

// Load from src/.env first
require("dotenv").config({ path: path.join(__dirname, "../.env") });
// Fallback to root .env if keys not found
if (!process.env.RAZORPAY_TEST_KEY) {
    require("dotenv").config({ path: path.join(__dirname, "../../.env") });
}

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_TEST_KEY,
    key_secret: process.env.RAZORPAY_TEST_SECRET
});

module.exports = razorpay;
