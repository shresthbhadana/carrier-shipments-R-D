const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const app = require("./index");

const ProductOrder = require("./models/productOrderModel");
const Shipment = require("./models/shipmentModel");
const userRepository = require("./repository/userRepository");

// Mock mongoose connect/disconnect
mongoose.connect = jest.fn().mockResolvedValue(true);
mongoose.disconnect = jest.fn().mockResolvedValue(true);

describe("Security and Authorization Integration Tests", () => {
    const JWT_SECRET = process.env.JWT_SECRET || "my_super_secret_that_is_at_least_32_characters_long";
    const myUserId = "60c72b2f9b1d8e2568cf9570";
    const otherUserId = "60c72b2f9b1d8e2568cf9579";
    const mockOrderId = "60c72b2f9b1d8e2568cf9571";
    const mockShipmentId = "60c72b2f9b1d8e2568cf9573";
    let myToken;

    beforeAll(() => {
        process.env.JWT_SECRET = JWT_SECRET;
        myToken = jwt.sign({ id: myUserId }, JWT_SECRET, { expiresIn: "1h" });
        // Mock mongoose connection readyState to be connected (1) for health check
        Object.defineProperty(mongoose.connection, "readyState", {
            get: () => 1,
            configurable: true
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("1. Health Endpoint (No Authentication)", () => {
        test("GET /health should return 200 OK", async () => {
            const response = await request(app).get("/health");
            expect(response.status).toBe(200);
            expect(response.body.status).toBe("UP");
        });
    });

    describe("2. Authentication Middleware", () => {
        test("GET /labels/test.pdf without Authorization header should return 401 Unauthorized", async () => {
            const response = await request(app).get("/labels/test.pdf");
            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message[0]).toContain("Unauthorized: Token not provided");
        });

        test("GET /labels/test.pdf with invalid Bearer token format should return 403 Forbidden", async () => {
            const response = await request(app)
                .get("/labels/test.pdf")
                .set("Authorization", "Bearer invalid-token-string");
            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
            expect(response.body.message[0]).toContain("Forbidden: Invalid or expired token");
        });
    });

    describe("3. Static Labels Directory Security & Ownership Check", () => {
        test("GET /labels/test.pdf should return 403 Forbidden if the user does not own the shipment's order", async () => {
            // Mock authentication lookup
            jest.spyOn(userRepository, "findById").mockResolvedValue({
                _id: myUserId,
                name: "Test User",
                email: "test@example.com",
                role: "user"
            });

            // Mock shipment check with order owned by other user
            jest.spyOn(Shipment, "findOne").mockReturnValue({
                populate: jest.fn().mockResolvedValue({
                    _id: mockShipmentId,
                    awbNumber: "test",
                    orderId: {
                        _id: mockOrderId,
                        userId: otherUserId
                    }
                })
            });

            const response = await request(app)
                .get("/labels/test.pdf")
                .set("Authorization", `Bearer ${myToken}`);

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
            expect(response.body.message[0]).toContain("Forbidden: You do not own this shipment");
        });

        test("GET /labels/test.pdf should return 404 if user owns the shipment but label file is not on disk", async () => {
            // Mock authentication lookup
            jest.spyOn(userRepository, "findById").mockResolvedValue({
                _id: myUserId,
                name: "Test User",
                email: "test@example.com",
                role: "user"
            });

            // Mock shipment check with order owned by my user
            jest.spyOn(Shipment, "findOne").mockReturnValue({
                populate: jest.fn().mockResolvedValue({
                    _id: mockShipmentId,
                    awbNumber: "test",
                    orderId: {
                        _id: mockOrderId,
                        userId: myUserId
                    }
                })
            });

            const response = await request(app)
                .get("/labels/test.pdf")
                .set("Authorization", `Bearer ${myToken}`);

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.message[0]).toContain("Label file not found on disk");
        });
    });

    describe("4. Order Ownership Middleware Check (verifyOrderOwnership)", () => {
        test("PUT /api/orders/:id should return 403 if the user does not own the order", async () => {
            jest.spyOn(userRepository, "findById").mockResolvedValue({
                _id: myUserId,
                name: "Test User",
                email: "test@example.com",
                role: "user"
            });

            jest.spyOn(ProductOrder, "findById").mockResolvedValue({
                _id: mockOrderId,
                userId: otherUserId
            });

            const response = await request(app)
                .put(`/api/orders/${mockOrderId}`)
                .set("Authorization", `Bearer ${myToken}`)
                .send({ totalAmount: 2000 });

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
            expect(response.body.message[0]).toContain("Unauthorized: You do not own this order");
        });
    });

    describe("5. Shipment Ownership Middleware Check (verifyShipmentOwnership)", () => {
        test("GET /api/shipments/:id/track should return 403 if the user does not own the shipment's order", async () => {
            jest.spyOn(userRepository, "findById").mockResolvedValue({
                _id: myUserId,
                name: "Test User",
                email: "test@example.com",
                role: "user"
            });

            jest.spyOn(Shipment, "findById").mockReturnValue({
                populate: jest.fn().mockResolvedValue({
                    _id: mockShipmentId,
                    orderId: {
                        _id: mockOrderId,
                        userId: otherUserId
                    }
                })
            });

            const response = await request(app)
                .get(`/api/shipments/${mockShipmentId}/track`)
                .set("Authorization", `Bearer ${myToken}`);

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
            expect(response.body.message[0]).toContain("Unauthorized: You do not own this shipment");
        });
    });

    describe("6. Subscription IDOR Scoping Check (getUserSubscription)", () => {
        test("GET /api/v1/user/:userId should return 403 if req.params.userId is not req.user.id", async () => {
            jest.spyOn(userRepository, "findById").mockResolvedValue({
                _id: myUserId,
                name: "Test User",
                email: "test@example.com",
                role: "user"
            });

            const response = await request(app)
                .get(`/api/v1/user/${otherUserId}`)
                .set("Authorization", `Bearer ${myToken}`);

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
            expect(response.body.message[0]).toContain("Forbidden: You do not have access to this user's subscriptions");
        });
    });
});
