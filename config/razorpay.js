const Razorpay = require("razorpay");
const path = require("path");


if (!process.env.RAZORPAY_TEST_KEY && !process.env.RAZORPAY_LIVE_KEY && !process.env.RAZORPAY_KEY_ID) {
    require("dotenv").config({ path: path.join(__dirname, "../.env") });
    if (!process.env.RAZORPAY_TEST_KEY && !process.env.RAZORPAY_LIVE_KEY && !process.env.RAZORPAY_KEY_ID) {
        require("dotenv").config({ path: path.join(__dirname, "../../.env") });
    }
}

const isProduction = process.env.NODE_ENV === "production";

const keyId = isProduction 
    ? (process.env.RAZORPAY_LIVE_KEY || process.env.RAZORPAY_KEY_ID) 
    : process.env.RAZORPAY_TEST_KEY;

const keySecret = isProduction 
    ? (process.env.RAZORPAY_LIVE_SECRET || process.env.RAZORPAY_KEY_SECRET) 
    : process.env.RAZORPAY_TEST_SECRET;

const razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret
});

module.exports = razorpay;
