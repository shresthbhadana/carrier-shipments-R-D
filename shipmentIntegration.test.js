const mongoose = require("mongoose");
const fs = require("fs");

process.env.MOCK_CARRIERS = "true";

// Mock FS to prevent writing files to disk during test run
jest.mock("fs", () => ({
    existsSync: jest.fn().mockReturnValue(false),
    promises: {
        writeFile: jest.fn().mockResolvedValue(true),
        mkdir: jest.fn().mockResolvedValue(true)
    }
}));

const mockOrderId = "60c72b2f9b1d8e2568cf9571";
const mockShipmentId = "60c72b2f9b1d8e2568cf9573";

const mockShipment = {
    _id: mockShipmentId,
    orderId: mockOrderId,
    courierName: "Canada Post Regular Parcel",
    trackingId: "PG1234567890CA",
    awbNumber: "PG1234567890CA",
    shippingPrice: 15,
    status: "created"
};

mongoose.connect = jest.fn().mockResolvedValue(true);
mongoose.disconnect = jest.fn().mockResolvedValue(true);

jest.mock("./models/shipmentModel", () => {
    return {
        create: jest.fn().mockImplementation((arr) => Promise.resolve([{ ...arr[0], _id: mockShipmentId }]))
    };
});

jest.mock("./repository/shipmentRepository", () => {
    return {
        createShipment: jest.fn().mockImplementation((payload) => Promise.resolve({ ...payload, _id: mockShipmentId })),
        findById: jest.fn().mockResolvedValue(mockShipment),
        updateShipment: jest.fn().mockResolvedValue({ ...mockShipment, status: "cancelled" })
    };
});

jest.mock("./repository/productOrderRepository", () => {
    return {
        updateOrder: jest.fn().mockResolvedValue({ orderStatus: "returned" })
    };
});

const canadaPostService = require("./services/canadaPostService");
const shipmentService = require("./services/shipmentService");
const porulatorService = require("./services/porulatorService");

describe("YellowDodle Shipment Integration Tests", () => {
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
        expect(rates[0].courierName).toContain("Canada Post");
    });

    test("2. shipmentService.getLabel should fetch and write label PDF", async () => {
        const labelUrl = await shipmentService.getLabel(mockShipmentId);
        expect(labelUrl).toBe(`/labels/${mockShipment.awbNumber}.pdf`);
        expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    test("3. canadaPostService.trackShipment should return status details", async () => {
        const tracking = await canadaPostService.trackShipment(mockShipment.awbNumber);
        expect(tracking.success).toBe(true);
        expect(tracking.data.awb_number).toBe(mockShipment.awbNumber);
    });

    test("4. shipmentService.initiateReturn should create return shipment and update order status", async () => {
        const returnData = {
            customerName: "Integration Test User",
            customerPhone: "9876543210",
            pickupAddress: "Sector 49, Gurgaon",
            pickupPincode: "122001",
            weight: 1.0,
            returnReasonId: 14,
            customerRequest: "REFUND"
        };

        const returnShipment = await shipmentService.initiateReturn(mockShipmentId, returnData);
        expect(returnShipment).toBeDefined();
        expect(returnShipment.status).toBe("return_created");
    });

    test("5. shipmentService.cancelShipment should set status to cancelled", async () => {
        const cancelResult = await shipmentService.cancelShipment(mockShipmentId);
        expect(cancelResult.success).toBe(true);
        expect(cancelResult.message).toContain("cancelled successfully");
    });

    test("6. porulatorService.fetchRates should return Purolator rates", async () => {
        const rates = await porulatorService.fetchRates({
            pickupPincode: "K1A0B1",
            deliveryPincode: "K1A0B2",
            weight: 1.0
        });
        expect(Array.isArray(rates)).toBe(true);
        expect(rates[0].courierName).toContain("Purolator");
    });

    test("7. porulatorService.trackShipment should return Purolator status details", async () => {
        const tracking = await porulatorService.trackShipment("PUR12345678");
        expect(tracking.success).toBe(true);
        expect(tracking.data.awb_number).toBe("PUR12345678");
    });

    test("8. shipmentService.schedulePickup should call carrier pickup scheduling", async () => {
        const mockPurolatorShipment = {
            _id: mockShipmentId,
            courierName: "Purolator Express",
            awbNumber: "PUR12345678"
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

    test("9. shipmentService.getLocations should lookup locations", async () => {
        const result = await shipmentService.getLocations({
            carrier: "purolator",
            postalCode: "L5R3T8"
        });
        expect(result.locations).toBeDefined();
        expect(result.locations.length).toBeGreaterThan(0);
    });
});
