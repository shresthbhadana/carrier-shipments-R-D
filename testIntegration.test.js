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

jest.mock("./config/razorpay", () => {
    return {
        plans: {
            create: jest.fn().mockResolvedValue({
                id: "plan_mock123",
                entity: "plan",
                interval: 1,
                period: "monthly",
                item: {
                    name: "Test Plan",
                    amount: 10000,
                    currency: "INR"
                }
            })
        },
        subscriptions: {
            create: jest.fn().mockResolvedValue({
                id: "sub_mock123",
                entity: "subscription",
                plan_id: "plan_mock123",
                status: "created",
                total_count: 12,
                customer_notify: 1
            }),
            fetch: jest.fn().mockResolvedValue({
                id: "sub_mock123",
                entity: "subscription",
                plan_id: "plan_mock123",
                status: "active",
                total_count: 12
            }),
            cancel: jest.fn().mockResolvedValue({
                id: "sub_mock123",
                entity: "subscription",
                plan_id: "plan_mock123",
                status: "cancelled",
                total_count: 12
            })
        }
    };
});

jest.mock("./repository/subscriptionRepository", () => {
    return {
        create: jest.fn().mockImplementation((payload) => Promise.resolve({ ...payload, _id: "sub_db_123" })),
        findBySubscriptionId: jest.fn().mockResolvedValue({
            _id: "sub_db_123",
            userId: "60c72b2f9b1d8e2568cf9570",
            razorpayPlanId: "plan_mock123",
            razorpaySubscriptionId: "sub_mock123",
            status: "active",
            totalCount: 12
        }),
        findAllSubscription: jest.fn().mockResolvedValue([
            {
                _id: "sub_db_123",
                userId: "60c72b2f9b1d8e2568cf9570",
                razorpayPlanId: "plan_mock123",
                razorpaySubscriptionId: "sub_mock123",
                status: "active",
                totalCount: 12
            }
        ]),
        updateStatus: jest.fn().mockImplementation((subscriptionId, status) => Promise.resolve({
            _id: "sub_db_123",
            userId: "60c72b2f9b1d8e2568cf9570",
            razorpayPlanId: "plan_mock123",
            razorpaySubscriptionId: subscriptionId,
            status: status,
            totalCount: 12
        }))
    };
});


const canadaPostService = require("./services/canadaPostService");
const productOrderService = require("./services/productOrderService");
const shipmentService = require("./services/shipmentService");
const porulatorService = require("./services/porulatorService");
const subscriptionService = require("./services/subscriptionService");

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
        expect(resultOrder.subtotal).toBe(1500); 
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

    test("7. porulatorService.fetchRates should return an array of rates", async () => {
        const rates = await porulatorService.fetchRates({
            pickupPincode: "K1A0B1",
            deliveryPincode: "K1A0B2",
            weight: 1.0
        });
        expect(Array.isArray(rates)).toBe(true);
        expect(rates.length).toBeGreaterThan(0);
        expect(rates[0]).toHaveProperty("courierName");
        expect(rates[0].courierName).toContain("Purolator");
    });

    test("8. porulatorService.trackShipment should return status details", async () => {
        const tracking = await porulatorService.trackShipment("PUR12345678");
        expect(tracking.success).toBe(true);
        expect(tracking.data.awb_number).toBe("PUR12345678");
        expect(tracking.data.courier).toBe("Purolator");
        expect(tracking.data.current_status).toBeDefined();
    });

    test("9. shipmentService.schedulePickup should call schedule pickup on the resolved carrier service", async () => {
    
        const mockPurolatorShipment = {
            _id: mockShipmentId,
            orderId: mockOrderId,
            courierName: "Purolator Express Box 9AM",
            trackingId: "PUR12345678",
            awbNumber: "PUR12345678",
            shippingPrice: 15,
            status: "created"
        };
        const shipmentRepository = require("./repository/shipmentRepository");
        jest.spyOn(shipmentRepository, "findById").mockResolvedValueOnce(mockPurolatorShipment);

        const pickupData = {
            date: "2026-06-20",
            pickupPincode: "L5R3T8",
            customerName: "John Doe",
            customerPhone: "14031234567"
        };

        const result = await shipmentService.schedulePickup(mockShipmentId, pickupData);
        expect(result.success).toBe(true);
        expect(result.pickupConfirmationNumber).toBeDefined();
    });

    test("10. shipmentService.getLocations should lookup locations from carrier service", async () => {
        const result = await shipmentService.getLocations({
            carrier: "purolator",
            postalCode: "L5R3T8"
        });
        expect(result).toBeDefined();
        expect(result.locations).toBeDefined();
        expect(result.locations.length).toBeGreaterThan(0);
    });

    test("11. subscriptionService.createPlan should create plan successfully", async () => {
        const plan = await subscriptionService.createPlan({
            period: "monthly",
            interval: 1,
            amount: 100,
            planName: "Test Plan"
        });

        expect(plan).toBeDefined();
        expect(plan.id).toBe("plan_mock123");
        expect(plan.amount).toBe("100 + 18% GST");
        expect(plan.totalAmount).toBe(118);
    });

    test("12. subscriptionService.createSubscription should create subscription successfully", async () => {
        const result = await subscriptionService.createSubscription({
            userId: mockUserId,
            planId: "plan_mock123",
            totalCount: 12,
            customerNotify: 1
        });

        expect(result).toBeDefined();
        expect(result.subscription.id).toBe("sub_mock123");
        expect(result.savedSubscription.userId).toBe(mockUserId);
        expect(result.savedSubscription.razorpaySubscriptionId).toBe("sub_mock123");
    });

    test("13. subscriptionService.fetchSubscription should fetch subscription successfully", async () => {
        const subscription = await subscriptionService.fetchSubscription("sub_mock123");
        expect(subscription).toBeDefined();
        expect(subscription.id).toBe("sub_mock123");
        expect(subscription.status).toBe("active");
    });

    test("14. subscriptionService.cancelSubscription should cancel subscription successfully", async () => {
        const result = await subscriptionService.cancelSubscription("sub_mock123");
        expect(result).toBeDefined();
        expect(result.subscription.id).toBe("sub_mock123");
        expect(result.subscription.status).toBe("cancelled");
        expect(result.updatedSubscription.status).toBe("cancelled");
    });

    test("15. subscriptionService.getUserSubscriptions should return all user subscriptions", async () => {
        const list = await subscriptionService.getUserSubscriptions({ userId: mockUserId });
        expect(Array.isArray(list)).toBe(true);
        expect(list.length).toBe(1);
        expect(list[0].userId).toBe(mockUserId);
    });

    test("16. subscriptionService.updateSubscriptionStatus should update status in database", async () => {
        const updated = await subscriptionService.updateSubscriptionStatus("sub_mock123", "active");
        expect(updated).toBeDefined();
        expect(updated.razorpaySubscriptionId).toBe("sub_mock123");
        expect(updated.status).toBe("active");
    });

    test("17. subscriptionService.getSubscriptionByRazorpayId should fetch subscription from database", async () => {
        const subscription = await subscriptionService.getSubscriptionByRazorpayId("sub_mock123");
        expect(subscription).toBeDefined();
        expect(subscription.razorpaySubscriptionId).toBe("sub_mock123");
        expect(subscription.status).toBe("active");
    });
});
