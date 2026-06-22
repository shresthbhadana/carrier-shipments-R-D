const mongoose = require("mongoose");
const crypto = require("crypto");

// Mock Mongoose connection
mongoose.connect = jest.fn().mockResolvedValue(true);
mongoose.disconnect = jest.fn().mockResolvedValue(true);

const mockUserId = "60c72b2f9b1d8e2568cf9570";

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

const subscriptionService = require("./services/subscriptionService");

describe("YellowDodle Subscription Integration Tests", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test("1. subscriptionService.createPlan should create plan successfully", async () => {
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

    test("2. subscriptionService.createSubscription should create subscription successfully", async () => {
        const startAtFuture = Math.floor(Date.now() / 1000) + 86400; 
        const result = await subscriptionService.createSubscription({
            userId: mockUserId,
            planId: "plan_mock123",
            totalCount: 12,
            customerNotify: 1,
            startAt: startAtFuture,
            addons: [
                {
                    item: {
                        name: "Setup Fee",
                        amount: 100,
                        currency: "INR"
                    }
                }
            ]
        });

        expect(result).toBeDefined();
        expect(result.subscription.id).toBe("sub_mock123");
        expect(result.savedSubscription.userId).toBe(mockUserId);
        expect(result.savedSubscription.razorpaySubscriptionId).toBe("sub_mock123");
    });

    test("3. subscriptionService.fetchSubscription should fetch subscription successfully", async () => {
        const subscription = await subscriptionService.fetchSubscription("sub_mock123");
        expect(subscription).toBeDefined();
        expect(subscription.id).toBe("sub_mock123");
        expect(subscription.status).toBe("active");
    });

    test("4. subscriptionService.cancelSubscription should cancel subscription successfully", async () => {
        const result = await subscriptionService.cancelSubscription("sub_mock123");
        expect(result).toBeDefined();
        expect(result.subscription.id).toBe("sub_mock123");
        expect(result.subscription.status).toBe("cancelled");
        expect(result.updatedSubscription.status).toBe("cancelled");
    });

    test("5. subscriptionService.getUserSubscriptions should return all user subscriptions", async () => {
        const list = await subscriptionService.getUserSubscriptions({ userId: mockUserId });
        expect(Array.isArray(list)).toBe(true);
        expect(list.length).toBe(1);
        expect(list[0].userId).toBe(mockUserId);
    });

    test("6. subscriptionService.updateSubscriptionStatus should update status in database", async () => {
        const updated = await subscriptionService.updateSubscriptionStatus("sub_mock123", "active");
        expect(updated).toBeDefined();
        expect(updated.razorpaySubscriptionId).toBe("sub_mock123");
        expect(updated.status).toBe("active");
    });

    test("7. subscriptionService.getSubscriptionByRazorpayId should fetch subscription from database", async () => {
        const subscription = await subscriptionService.getSubscriptionByRazorpayId("sub_mock123");
        expect(subscription).toBeDefined();
        expect(subscription.razorpaySubscriptionId).toBe("sub_mock123");
        expect(subscription.status).toBe("active");
    });

    test("8. subscriptionService.verifySubscriptionSignature should verify valid signature and update status", async () => {
        const secret = "my_super_secret";
        process.env.RAZORPAY_TEST_SECRET = secret;
        const razorpay_payment_id = "pay_test123";
        const razorpay_subscription_id = "sub_mock123";
        const razorpay_signature = crypto
            .createHmac("sha256", secret)
            .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
            .digest("hex");

        const result = await subscriptionService.verifySubscriptionSignature({
            razorpay_payment_id,
            razorpay_subscription_id,
            razorpay_signature
        });

        expect(result).toBeDefined();
        expect(result.razorpaySubscriptionId).toBe("sub_mock123");
        expect(result.status).toBe("active");
    });

    test("9. subscriptionService.verifySubscriptionSignature should throw error on invalid signature", async () => {
        await expect(subscriptionService.verifySubscriptionSignature({
            razorpay_payment_id: "pay_test123",
            razorpay_subscription_id: "sub_mock123",
            razorpay_signature: "invalid_signature"
        })).rejects.toThrow("Signature verification failed");
    });

    test("10. subscriptionService.processWebhook should process webhook event and update status", async () => {
        const webhookEvent = {
            event: "subscription.charged",
            payload: {
                subscription: {
                    entity: {
                        id: "sub_mock123",
                        status: "active"
                    }
                }
            }
        };

        const result = await subscriptionService.processWebhook(webhookEvent);
        expect(result).toBeDefined();
        expect(result.event).toBe("subscription.charged");
        expect(result.subscriptionId).toBe("sub_mock123");
        expect(result.status).toBe("active");
    });
});
