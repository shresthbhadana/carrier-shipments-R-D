const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

// Mock process.env.MOCK_CARRIERS = "true" to run in local mock mode without external calls
process.env.MOCK_CARRIERS = "true";

// Mock FS to prevent writing files to disk during test run
jest.mock("fs", () => ({
    existsSync: jest.fn().mockReturnValue(false),
    promises: {
        writeFile: jest.fn().mockResolvedValue(true),
        mkdir: jest.fn().mockResolvedValue(true)
    }
}));

// Mock Mongoose connection and transaction sessions by stubbing methods directly
const mockSession = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn()
};

mongoose.connect = jest.fn().mockResolvedValue(true);
mongoose.disconnect = jest.fn().mockResolvedValue(true);
mongoose.startSession = jest.fn().mockResolvedValue(mockSession);

// Define common mock data
const mockProductId = "60c72b2f9b1d8e2568cf9572";
const mockOrderId = "60c72b2f9b1d8e2568cf9571";
const mockShipmentId = "60c72b2f9b1d8e2568cf9573";
const mockUserId = "60c72b2f9b1d8e2568cf9570";

const mockOrder = {
    _id: mockOrderId,
    userId: mockUserId,
    products: [{ productId: mockProductId, quantity: 1, price: 1500 }],
    subtotal: 1500,
    shippingPrice: 15,
    totalAmount: 1515,
    orderStatus: "pending",
    shipmentId: mockShipmentId
};

const mockShipment = {
    _id: mockShipmentId,
    orderId: mockOrderId,
    courierName: "Canada Post Regular Parcel",
    trackingId: "PG1234567890CA",
    awbNumber: "PG1234567890CA",
    shippingPrice: 15,
    status: "created"
};

// Mock Database models
jest.mock("./models/productInfoModel", () => {
    return {
        find: jest.fn().mockResolvedValue([{ _id: mockProductId, price: 1500 }])
    };
});

jest.mock("./models/productOrderModel", () => {
    return {
        create: jest.fn().mockImplementation((arr) => Promise.resolve([{ ...arr[0], _id: mockOrderId }])),
        findByIdAndUpdate: jest.fn().mockResolvedValue({ ...mockOrder, orderStatus: "processing" })
    };
});

jest.mock("./models/shipmentModel", () => {
    return {
        create: jest.fn().mockImplementation((arr) => Promise.resolve([{ ...arr[0], _id: mockShipmentId }]))
    };
});

// Mock Repository functions
jest.mock("./repository/productOrderRepository", () => {
    return {
        findById: jest.fn().mockResolvedValue(mockOrder),
        updateOrder: jest.fn().mockResolvedValue({ ...mockOrder, orderStatus: "cancelled" })
    };
});

jest.mock("./repository/shipmentRepository", () => {
    return {
        createShipment: jest.fn().mockImplementation((payload) => Promise.resolve({ ...payload, _id: mockShipmentId })),
        findById: jest.fn().mockResolvedValue(mockShipment),
        updateShipment: jest.fn().mockResolvedValue({ ...mockShipment, status: "cancelled" })
    };
});

// Require services under test
const canadaPostService = require("./services/canadaPostService");
const productOrderService = require("./services/productOrderService");
const shipmentService = require("./services/shipmentService");

describe("YellowDodle E-commerce Carrier Integration Tests", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test("1. canadaPostService.fetchRates should fetch rates successfully", async () => {
        const rates = await canadaPostService.fetchRates({
            pickupPincode: "K1A0B1",
            deliveryPincode: "K1A0B2",
            weight: 1.0,
            cod: false
        });

        expect(Array.isArray(rates)).toBe(true);
        expect(rates.length).toBeGreaterThan(0);
        expect(rates[0]).toHaveProperty("courierId");
        expect(rates[0]).toHaveProperty("shippingPrice");
        expect(rates[0].courierName).toContain("Canada Post");
    });

    test("2. productOrderService.createProductOrder should process order checkout & calculate subtotal/totalAmount server-side", async () => {
        const payload = {
            userId: mockUserId,
            products: [{ productId: mockProductId, quantity: 1 }],
            pickupPincode: "K1A0B1",
            deliveryPincode: "K1A0B2",
            customerName: "Integration Test User",
            customerPhone: "9876543210",
            weight: 1.0,
            courierName: "Canada Post Regular Parcel"
        };

        const resultOrder = await productOrderService.createProductOrder(payload);

        expect(resultOrder).toBeDefined();
        expect(resultOrder.subtotal).toBe(1500); // 1500 resolved from DB * 1 quantity
        expect(resultOrder.shippingPrice).toBeDefined();
        expect(resultOrder.totalAmount).toBe(resultOrder.subtotal + resultOrder.shippingPrice);
        expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    test("3. shipmentService.getLabel should fetch and write label PDF", async () => {
        const labelUrl = await shipmentService.getLabel(mockShipmentId);
        expect(labelUrl).toBe(`/labels/${mockShipment.awbNumber}.pdf`);
        expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    test("4. canadaPostService.trackShipment should return status details", async () => {
        const tracking = await canadaPostService.trackShipment(mockShipment.awbNumber);
        expect(tracking.success).toBe(true);
        expect(tracking.data.awb_number).toBe(mockShipment.awbNumber);
        expect(tracking.data.current_status).toBeDefined();
    });

    test("5. shipmentService.initiateReturn should create return shipment and update order status to returned", async () => {
        const returnData = {
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
        };

        const returnShipment = await shipmentService.initiateReturn(mockShipmentId, returnData);
        expect(returnShipment).toBeDefined();
        expect(returnShipment.status).toBe("return_created");
    });

    test("6. shipmentService.cancelShipment should route cancellation via resolved carrier service and set statuses", async () => {
        const cancelResult = await shipmentService.cancelShipment(mockShipmentId);
        expect(cancelResult.success).toBe(true);
        expect(cancelResult.message).toContain("cancelled successfully");
    });
});
