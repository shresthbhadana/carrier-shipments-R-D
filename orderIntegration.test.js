const mongoose = require("mongoose");
const fs = require("fs");

process.env.MOCK_CARRIERS = "true";


jest.mock("fs", () => ({
    existsSync: jest.fn().mockReturnValue(false),
    promises: {
        writeFile: jest.fn().mockResolvedValue(true),
        mkdir: jest.fn().mockResolvedValue(true)
    }
}));


const mockSession = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn()
};

mongoose.connect = jest.fn().mockResolvedValue(true);
mongoose.disconnect = jest.fn().mockResolvedValue(true);
mongoose.startSession = jest.fn().mockResolvedValue(mockSession);

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


jest.mock("./repository/productOrderRepository", () => {
    return {
        findById: jest.fn().mockResolvedValue(mockOrder),
        updateOrder: jest.fn().mockResolvedValue({ ...mockOrder, orderStatus: "cancelled" })
    };
});

jest.mock("./repository/shipmentRepository", () => {
    return {
        createShipment: jest.fn().mockImplementation((payload) => Promise.resolve({ ...payload, _id: mockShipmentId }))
    };
});

const productOrderService = require("./services/productOrderService");

describe("YellowDodle Order Integration Tests", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test("1. productOrderService.createProductOrder should process order checkout & calculate subtotal/totalAmount server-side", async () => {
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
});
