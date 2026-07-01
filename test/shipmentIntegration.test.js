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

jest.mock("axios");
jest.mock("undici", () => ({
    request: jest.fn()
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

jest.mock("../models/shipmentModel", () => {
    return {
        create: jest.fn().mockImplementation((arr) => Promise.resolve([{ ...arr[0], _id: mockShipmentId }]))
    };
});

jest.mock("../repository/shipmentRepository", () => {
    return {
        createShipment: jest.fn().mockImplementation((payload) => Promise.resolve({ ...payload, _id: mockShipmentId })),
        findById: jest.fn().mockResolvedValue(mockShipment),
        updateShipment: jest.fn().mockResolvedValue({ ...mockShipment, status: "cancelled" })
    };
});

jest.mock("../repository/productOrderRepository", () => {
    return {
        updateOrder: jest.fn().mockResolvedValue({ orderStatus: "returned" })
    };
});

const canadaPostService = require("../services/canadaPostService");
const shipmentService = require("../services/shipmentService");
const purolatorService = require("../services/purolatorService");
const fedexService = require("../services/fedexService");

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

    test("6. purolatorService.fetchRates should return Purolator rates", async () => {
        const rates = await purolatorService.fetchRates({
            pickupPincode: "K1A0B1",
            deliveryPincode: "K1A0B2",
            weight: 1.0
        });
        expect(Array.isArray(rates)).toBe(true);
        expect(rates[0].courierName).toContain("Purolator");
    });

    test("7. purolatorService.trackShipment should return Purolator status details", async () => {
        const tracking = await purolatorService.trackShipment("PUR12345678");
        expect(tracking.success).toBe(true);
        expect(tracking.data.awb_number).toBe("PUR12345678");
    });

    test("8. shipmentService.schedulePickup should call carrier pickup scheduling", async () => {
        const mockPurolatorShipment = {
            _id: mockShipmentId,
            courierName: "Purolator Express",
            awbNumber: "PUR12345678"
        };
        const shipmentRepository = require("../repository/shipmentRepository");
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

    test("10. fedexService.fetchRates should throw error on API failure when MOCK_CARRIERS is false", async () => {
        const originalMockCarriers = process.env.MOCK_CARRIERS;
        const originalClientId = process.env.FEDEX_CLIENT_ID;
        const originalClientSecret = process.env.FEDEX_CLIENT_SECRET;
        
        process.env.MOCK_CARRIERS = "false";
        process.env.FEDEX_CLIENT_ID = "dummy";
        process.env.FEDEX_CLIENT_SECRET = "dummy";

        const mockFetch = jest.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ access_token: "dummy_token" })
            })
            .mockRejectedValueOnce(new Error("API rate limit exceeded"));

        const originalGlobalFetch = global.fetch;
        global.fetch = mockFetch;

        try {
            await fedexService.fetchRates({
                pickupPincode: "122001",
                deliveryPincode: "122002",
                weight: 1.0
            });
            throw new Error("Should have thrown an error");
        } catch (error) {
            expect(error.message).toContain("Credentials missing for FedEx. Fail-fast in production");
        } finally {
            global.fetch = originalGlobalFetch;
            process.env.MOCK_CARRIERS = originalMockCarriers;
            process.env.FEDEX_CLIENT_ID = originalClientId;
            process.env.FEDEX_CLIENT_SECRET = originalClientSecret;
        }
    });

    test("11. purolatorService.fetchRates should throw error on API failure when MOCK_CARRIERS is false", async () => {
        const originalMockCarriers = process.env.MOCK_CARRIERS;
        const originalApiKey = process.env.PUROLATOR_API_KEY;
        const originalApiSecret = process.env.PUROLATOR_API_SECRET;
        
        process.env.MOCK_CARRIERS = "false";
        process.env.PUROLATOR_API_KEY = "dummy";
        process.env.PUROLATOR_API_SECRET = "dummy";

        const axios = require("axios");
        const undici = require("undici");

        axios.post.mockResolvedValueOnce({
            data: {
                access_token: "dummy_token",
                expires_in: 3600
            }
        });

        undici.request.mockRejectedValueOnce(new Error("Purolator internal server error"));

        try {
            await purolatorService.fetchRates({
                pickupPincode: "H3Z2Y7",
                deliveryPincode: "H3Z2Y8",
                weight: 1.0
            });
            throw new Error("Should have thrown an error");
        } catch (error) {
            expect(error.message).toContain("Credentials missing for Purolator. Fail-fast in production");
        } finally {
            process.env.MOCK_CARRIERS = originalMockCarriers;
            process.env.PUROLATOR_API_KEY = originalApiKey;
            process.env.PUROLATOR_API_SECRET = originalApiSecret;
        }
    });
});


const upsService= require("../services/upsService");
test("12. ups result should return UPS rates",async()=>{
    const rates = await upsService.fetchRates({
        pickupPincode:"K1A0B1",
        deliveryPincode : "K1A0B2",
        weight:1.0,

    })
    expect(Array.isArray(rates)).toBe(true);
    expect(rates[0].courierName).toContain("UPS")
})

  test("13. upsService.trackShipment should return UPS status details", async () => {
        const tracking = await upsService.trackShipment("1Z1234567890123456");
        expect(tracking.success).toBe(true);
        expect(tracking.data.awb_number).toBe("1Z1234567890123456");
    });
    test("14. upsService.fetchRates should throw error on API failure when MOCK_CARRIERS is false", async () => {
        const originalMockCarriers = process.env.MOCK_CARRIERS;
        const originalClientId = process.env.UPS_CLIENT_ID;
        const originalClientSecret = process.env.UPS_CLIENT_SECRET;
        
        process.env.MOCK_CARRIERS = "false";
        process.env.UPS_CLIENT_ID = "dummy";
        process.env.UPS_CLIENT_SECRET = "dummy";
        const mockFetch = jest.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ access_token: "dummy_token" })
            })
            .mockRejectedValueOnce(new Error("UPS API rate limit exceeded"));
        const originalGlobalFetch = global.fetch;
        global.fetch = mockFetch;
        try {
            await upsService.fetchRates({
                pickupPincode: "K1A0B1",
                deliveryPincode: "K1A0B2",
                weight: 1.0
            });
            throw new Error("Should have thrown an error");
        } catch (error) {
            expect(error.message).toContain("Credentials missing for UPS. Fail-fast in production");
        } finally {
            global.fetch = originalGlobalFetch;
            process.env.MOCK_CARRIERS = originalMockCarriers;
            process.env.UPS_CLIENT_ID = originalClientId;
            process.env.UPS_CLIENT_SECRET = originalClientSecret;
        }
    });

    test("15. shipmentService.checkPickupAvailability should return correct pickup availability and fees for valid/invalid pincodes", async () => {
        const resultVal = await shipmentService.checkPickupAvailability({
            carrier: "ups",
            pickupPincode: "K1A0B1"
        });
        expect(resultVal.available).toBe(true);
        expect(resultVal.pickupFee).toBe(8.00); 
        expect(resultVal.currency).toBe("CAD");

        const resultInval = await shipmentService.checkPickupAvailability({
            carrier: "ups",
            pickupPincode: "invalid-pc"
        });
        expect(resultInval.available).toBe(false);
        expect(resultInval.pickupFee).toBe(0);
    });

    test("16. carriers should support rates fetch with multiple packages", async () => {
        const packages = [
            { weight: 1.5, length: 10, width: 10, height: 10 },
            { weight: 2.0, length: 12, width: 12, height: 12 }
        ];

        const ratesUps = await upsService.fetchRates({
            pickupPincode: "K1A0B1",
            deliveryPincode: "K1A0B2",
            packages
        });
        expect(Array.isArray(ratesUps)).toBe(true);

        const ratesCanadaPost = await canadaPostService.fetchRates({
            pickupPincode: "K1A0B1",
            deliveryPincode: "K1A0B2",
            packages
        });
        expect(Array.isArray(ratesCanadaPost)).toBe(true);
    });


    