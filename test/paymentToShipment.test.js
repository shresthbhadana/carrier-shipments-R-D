const mongoose = require("mongoose");
const shipmentService = require("../services/shipmentService");
const productOrderRepository = require("../repository/productOrderRepository");

process.env.MOCK_CARRIERS = "true";
process.env.RAZORPAY_TEST_SECRET = "dummysercet123456789012345";

mongoose.connect = jest.fn().mockResolvedValue(true);
mongoose.disconnect = jest.fn().mockResolvedValue(true);

let mockRedisStorage = {};

jest.mock("../config/redis", () => {
    return {
        initRedis: jest.fn().mockResolvedValue(true),
        getRedisKey: jest.fn().mockImplementation((key) => Promise.resolve(mockRedisStorage[key] || null)),
        setRedisKey: jest.fn().mockImplementation((key, val) => {
            mockRedisStorage[key] = val;
            return Promise.resolve(true);
        }),
        delRedisKey: jest.fn().mockImplementation((key) => {
            delete mockRedisStorage[key];
            return Promise.resolve(true);
        })
    };
});

jest.mock("../config/razorpay", () => {
    return {
        orders: {
            create: jest.fn().mockResolvedValue({
                id: "order_mock123",
                amount: 7080,
                currency: "INR"
            })
        }
    };
});

jest.mock("../models/settingModel", () => {
    return {
        findOne: jest.fn().mockResolvedValue({ key: "platform_fee", value: 10 })
    };
});

jest.mock("../models/shipmentModel", () => {
    const instance = {
        _id: "60c72b2f9b1d8e2568cf9573",
        orderId: "60c72b2f9b1d8e2568cf9571",
        courierName: "Canada Post Regular Parcel",
        shippingPrice: 70.8,
        baseShippingPrice: 50,
        platformFee: 10,
        gstAmount: 10.8,
        status: "pending",
        paymentStatus: "pending",
        razorpayOrderId: "order_mock123",
        save: jest.fn().mockResolvedValue(true)
    };
    return {
        findOne: jest.fn().mockResolvedValue(instance),
        create: jest.fn().mockResolvedValue(instance),
        findByIdAndUpdate: jest.fn().mockResolvedValue(instance)
    };
});

jest.mock("../repository/productOrderRepository", () => {
    return {
        findById: jest.fn().mockResolvedValue({
            _id: "60c72b2f9b1d8e2568cf9571",
            userId: "60c72b2f9b1d8e2568cf9570",
            orderStatus: "pending"
        }),
        updateOrder: jest.fn().mockResolvedValue(true)
    };
});

describe("Payment to Shipment Booking Integration Tests", () => {
    afterEach(() => {
        jest.clearAllMocks();
        mockRedisStorage = {};
    });

    test("Retrieve rates with platform fee and GST breakdown including GLS", async () => {
        const rates = await shipmentService.getRates({
            pickupPincode: "K1A0B1",
            deliveryPincode: "K1A0B2",
            weight: 1.0
        });

        expect(Array.isArray(rates)).toBe(true);
        expect(rates.length).toBeGreaterThan(0);
        const glsRate = rates.find(r => r.courierName.includes("GLS"));
        expect(glsRate).toBeDefined();
        expect(glsRate.baseShippingPrice).toBeDefined();
        expect(glsRate.platformFee).toBe(10);
        expect(glsRate.gstAmount).toBeDefined();
        expect(glsRate.shippingPrice).toBeDefined();
    });

    test("Initiate shipment payment calls Razorpay Order API and creates Shipment in pending", async () => {
        const result = await shipmentService.initiateShipmentPayment({
            orderId: "60c72b2f9b1d8e2568cf9571",
            courierName: "Canada Post Regular Parcel",
            customerName: "John Doe",
            customerPhone: "9876543210",
            pickupPincode: "K1A0B1",
            deliveryPincode: "K1A0B2",
            weight: 1.0
        });

        expect(result).toBeDefined();
        expect(result.razorpayOrder.id).toBe("order_mock123");
        expect(result.shipment).toBeDefined();
    });

    test("Verify payment signature successfully and trigger booking", async () => {
        const crypto = require("crypto");
        const secret = process.env.RAZORPAY_TEST_SECRET;
        const razorpay_order_id = "order_mock123";
        const razorpay_payment_id = "pay_test123";
        const hmac = crypto.createHmac("sha256", secret);
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        const razorpay_signature = hmac.digest("hex");

        const result = await shipmentService.verifyShipmentPayment({
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        });

        expect(result).toBeDefined();
        expect(result.paymentStatus).toBe("paid");
        expect(result.razorpayPaymentId).toBe(razorpay_payment_id);
    });

    test("Verify payment throws error with invalid signature", async () => {
        await expect(
            shipmentService.verifyShipmentPayment({
                razorpay_order_id: "order_mock123",
                razorpay_payment_id: "pay_test123",
                razorpay_signature: "invalid_sig"
            })
        ).rejects.toThrow("Payment signature verification failed");
    });

    test("Rate query reads from and writes to Redis cache", async () => {
        mockRedisStorage = {};
        const payload = {
            pickupPincode: "K1A0B1",
            deliveryPincode: "K1A0B2",
            weight: 1.0
        };

        const firstRunRates = await shipmentService.getRates(payload);
        expect(firstRunRates).toBeDefined();

        const cacheKeys = Object.keys(mockRedisStorage);
        expect(cacheKeys.length).toBe(1);
        const cachedRatesKey = cacheKeys[0];
        expect(cachedRatesKey).toContain("rates:cache:");

        mockRedisStorage[cachedRatesKey] = JSON.stringify([{ courierName: "Cached Courier", shippingPrice: 50 }]);
        const secondRunRates = await shipmentService.getRates(payload);
        expect(secondRunRates).toBeDefined();
        expect(secondRunRates[0].courierName).toBe("Cached Courier");
    });

    test("Refresh token check rejects if token is blacklisted in Redis", async () => {
        mockRedisStorage = {};
        const userService = require("../services/userService");
        
        const tokenStr = "test_blacklisted_token";
        mockRedisStorage[`blacklist:token:${tokenStr}`] = "true";

        await expect(userService.refreshAuthToken(tokenStr)).rejects.toThrow("Token is blacklisted");
    });
});
