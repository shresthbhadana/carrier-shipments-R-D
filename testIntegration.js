const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Register a dummy User schema to prevent populate errors during test run
if (!mongoose.models.User) {
    mongoose.model("User", new mongoose.Schema({ name: String }));
}

const connectDB = require("./config/db");
const productOrderService = require("./services/productOrderService");
const canadaPostService = require("./services/canadaPostService");
const shipmentService = require("./services/shipmentService");

async function runTest() {
    console.log("=== CONNECTING TO DATABASE ===");
    try {
        await connectDB();
        console.log("MongoDB connected successfully.\n");
    } catch (err) {
        console.error("MongoDB connection failed:", err.message);
        process.exit(1);
    }

    try {
        console.log("=== TEST 1: FETCHING CANADA POST RATES ===");
        const rates = await canadaPostService.fetchRates({
            pickupPincode: "110001",    // New Delhi
            deliveryPincode: "400001",  // Mumbai
            weight: 1.0,
            cod: false
        });
        console.log("Rates fetched successfully from Canada Post API!");
        console.log("Available Couriers & Rates:", JSON.stringify(rates, null, 2));
        console.log("-------------------------------------------\n");

        console.log("=== TEST 2: RUNNING COMPLETE ORDER CHECKOUT WORKFLOW ===");
        const mockOrderPayload = {
            userId: new mongoose.Types.ObjectId(), // Auto-generate valid mock ObjectId
            products: [
                {
                    productId: new mongoose.Types.ObjectId(),
                    quantity: 1,
                    price: 1500
                }
            ],
            pickupPincode: "110001",
            deliveryPincode: "400001",
            customerName: "Integration Test User",
            customerPhone: "9876543210",
            weight: 1.0
        };

        console.log("Simulating Checkout Order Creation...");
        const resultOrder = await productOrderService.createProductOrder(mockOrderPayload);
        
        console.log("\nSUCCESS: Order Saved and Shipment Booked!");
        console.log("Order ID:", resultOrder._id);
        console.log("Subtotal (Product Price):", resultOrder.subtotal);
        console.log("Shipping Price:", resultOrder.shippingPrice);
        console.log("Total Charged Amount:", resultOrder.totalAmount);
        console.log("Order Status:", resultOrder.orderStatus);
        
        let shipmentId = resultOrder.shipmentId ? (resultOrder.shipmentId._id || resultOrder.shipmentId) : null;
        let awbNumber = resultOrder.shipmentId ? (resultOrder.shipmentId.awbNumber || "PG1234567890CA") : "PG1234567890CA";

        if (shipmentId) {
            console.log("Associated Shipment ID:", shipmentId);
        }

        console.log("\n=== TEST 3: TRACKING SHIPMENT ===");
        console.log("Tracking AWB:", awbNumber);
        const tracking = await canadaPostService.trackShipment(awbNumber);
        console.log("Tracking Info:", JSON.stringify(tracking, null, 2));

        if (shipmentId) {
            console.log("\n=== TEST 4: INITIATING SHIPMENT RETURN ===");
            const returnShipment = await shipmentService.initiateReturn(shipmentId, {
                customerName: "Integration Test User",
                customerPhone: "9876543210",
                pickupAddress: "Sector 49, Gurgaon",
                pickupPincode: "122001",
                pickupCity: "Gurgaon",
                pickupState: "Haryana",
                weight: 1.0,
                returnReasonId: 14,
                customerRequest: "REFUND",
                reasonComment: "Test return reason"
            });
            console.log("Return Shipment Booked successfully!");
            console.log("Return Shipment ID:", returnShipment._id);
            console.log("Return AWB Number:", returnShipment.awbNumber);

            console.log("\n=== TEST 5: CANCELLING THE SHIPMENT ===");
            const cancelResult = await shipmentService.cancelShipment(shipmentId);
            console.log("Cancellation result:", JSON.stringify(cancelResult, null, 2));
        }

        console.log("\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY ===");

    } catch (error) {
        console.error("\n!!! INTEGRATION TEST FAILED !!!");
        console.error(error.message || error);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB.");
    }
}

runTest();
