const Razorpay = require("razorpay");
require("dotenv").config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_TEST_KEY,
    key_secret: process.env.RAZORPAY_TEST_SECRET
});

module.exports = razorpay;
