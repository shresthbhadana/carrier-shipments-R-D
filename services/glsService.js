const axios = require("axios");

const GLS_API_BASE_URL = process.env.GLS_API_BASE_URL || "https://sandbox-smart4i.gls-canada.com/v1";
const GLS_USERNAME = process.env.GLS_USERNAME;
const GLS_PASSWORD = process.env.GLS_PASSWORD;
const GLS_BILLING_ACCOUNT = process.env.GLS_BILLING_ACCOUNT;
const GLS_INTEGRATION_ENABLED = process.env.GLS_INTEGRATION_ENABLED === "true";

function checkMockAllowed(serviceName) {
    if (process.env.MOCK_CARRIERS !== "true") {
        throw new Error(`credentials missing for ${serviceName}. Fail-fast in production. Set MOCK_CARRIERS=true in .env to allow mock data fallback.`);
    }
}

function getAuthHeader() {
    if (process.env.MOCK_CARRIERS === "true") {
        return null;
    }
    if (!GLS_USERNAME || !GLS_PASSWORD || !GLS_INTEGRATION_ENABLED) {
        return null;
    }
    const token = Buffer.from(`${GLS_USERNAME}:${GLS_PASSWORD}`).toString("base64");
    return {
        "Authorization": `Basic ${token}`,
        "Content-Type": "application/json"
    };
}

function getProvinceFromPostalCode(postalCode) {
    if (!postalCode) return "ON";
    const char = postalCode.trim().charAt(0).toUpperCase();
    switch (char) {
        case "A": return "NL";
        case "B": return "NS";
        case "C": return "PE";
        case "E": return "NB";
        case "G":
        case "H":
        case "J": return "QC";
        case "K":
        case "L":
        case "M":
        case "N":
        case "P": return "ON";
        case "R": return "MB";
        case "S": return "SK";
        case "T": return "AB";
        case "V": return "BC";
        case "Y": return "YT";
        case "X": return "NT";
        default: return "ON";
    }
}

function constructAddress(name, addressLine1, city, state, postalCode, phone) {
    const prov = state || getProvinceFromPostalCode(postalCode);
    const contactPhone = phone ? phone.replace(/\D/g, "") : "15145550199";
    return {
        name: name || "Contact",
        customerName: name || "Contact",
        addressLine1: addressLine1 || "123 Address Rd",
        city: city || "Toronto",
        province: prov,
        provinceCode: prov,
        postalCode: postalCode,
        country: "CA",
        countryCode: "CA",
        contact: {
            fullName: name || "Contact",
            telephone: contactPhone
        }
    };
}

function constructParcels(packagesArray) {
    return packagesArray.map(pkg => ({
        weight: Number(pkg.weight) || 1.0,
        declaredWeight: Number(pkg.weight) || 1.0,
        length: Number(pkg.length) || 10,
        width: Number(pkg.width) || 10,
        height: Number(pkg.height) || 10,
        depth: Number(pkg.height || pkg.depth) || 10,
        quantity: 1,
        parcelType: "Box"
    }));
}

async function fetchRates({ pickupPincode, deliveryPincode, weight = 0.5, cod = false, packages }) {
    const headers = getAuthHeader();
    const packagesArray = packages && packages.length > 0 ? packages : [{ weight: weight || 0.5 }];
    const totalWeight = packagesArray.reduce((acc, p) => acc + p.weight, 0);

    let distanceFactor = 10;
    const p1 = parseInt(pickupPincode?.replace(/\D/g, ""));
    const p2 = parseInt(deliveryPincode?.replace(/\D/g, ""));
    if (!isNaN(p1) && !isNaN(p2)) {
        distanceFactor = Math.abs(p1 - p2) % 100;
    } else if (pickupPincode && deliveryPincode) {
        distanceFactor = Math.abs(pickupPincode.charCodeAt(0) - deliveryPincode.charCodeAt(0)) * 5;
    }

    const basePrice = 60 + (totalWeight * 25) + (distanceFactor * 0.75);

    if (!headers) {
        checkMockAllowed("GLS");
        return [
            {
                courierId: "GLS_STANDARD",
                courierName: "GLS Standard",
                shippingPrice: Math.round(basePrice),
                estimatedDays: 3,
                serviceType: "Standard"
            },
            {
                courierId: "GLS_PRIORITY",
                courierName: "GLS Priority",
                shippingPrice: Math.round(basePrice * 1.3),
                estimatedDays: 1,
                serviceType: "Express"
            }
        ];
    }

    try {
        const cleanBilling = GLS_BILLING_ACCOUNT ? GLS_BILLING_ACCOUNT.replace(/"/g, "") : "";
        const response = await axios.post(`${GLS_API_BASE_URL}/rate`, {
            category: "Parcel",
            sender: constructAddress("Sender", "123 Shipper St", "Montreal", null, pickupPincode),
            consignee: constructAddress("Consignee", "456 Consignee St", "Toronto", null, deliveryPincode),
            parcels: constructParcels(packagesArray),
            paymentType: "Prepaid",
            deliveryType: "GRD",
            unitOfMeasurement: "K",
            billing: cleanBilling
        }, { headers });

        const data = response.data;
        const totalAmount = data.totalAmount || data.totalCharge || data.total || (data.rates && data.rates[0] ? data.rates[0].totalAmount : null) || basePrice;
        return [
            {
                courierId: "GLS_STANDARD",
                courierName: "GLS Standard",
                shippingPrice: Math.round(totalAmount),
                estimatedDays: data.transitDays || 3,
                serviceType: "Standard"
            }
        ];
    } catch (error) {
        const details = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error("GLS fetchRates error, falling back to mock:", details);
        if (process.env.MOCK_CARRIERS === "true") {
            return [
                {
                    courierId: "GLS_STANDARD",
                    courierName: "GLS Standard",
                    shippingPrice: Math.round(basePrice),
                    estimatedDays: 3,
                    serviceType: "Standard"
                }
            ];
        }
        throw error;
    }
}

async function createShipmentOrder(orderDetails) {
    const headers = getAuthHeader();
    const packagesArray = orderDetails.packages && orderDetails.packages.length > 0 ? orderDetails.packages : [{ weight: orderDetails.weight || 0.5 }];

    if (!headers) {
        checkMockAllowed("GLS");
        const randomAWB = "GLS" + Math.floor(1000000000 + Math.random() * 9000000000);
        return {
            success: true,
            courierName: orderDetails.courierName || "GLS Standard",
            trackingId: randomAWB,
            awbNumber: `mock-${randomAWB}`,
            status: "created"
        };
    }

    try {
        const cleanBilling = GLS_BILLING_ACCOUNT ? GLS_BILLING_ACCOUNT.replace(/"/g, "") : "";
        const response = await axios.post(`${GLS_API_BASE_URL}/shipment`, {
            category: "Parcel",
            billingAccount: cleanBilling,
            deliveryType: "GRD",
            paymentType: "Prepaid",
            unitOfMeasurement: "K",
            sender: constructAddress("YellowDodle Store", orderDetails.pickupAddress, orderDetails.pickupCity, orderDetails.pickupState, orderDetails.pickupPincode || "H9P2T7", "15145550199"),
            consignee: constructAddress(orderDetails.customerName, orderDetails.deliveryAddress, orderDetails.deliveryCity, orderDetails.deliveryState, orderDetails.deliveryPincode, orderDetails.customerPhone),
            parcels: constructParcels(packagesArray)
        }, { headers });

        const data = response.data;
        const shipmentId = data.id || (response.headers['location'] ? response.headers['location'].split('/').pop() : null);
        const trackingNumber = data.trackingNumber || shipmentId;

        return {
            success: true,
            courierName: orderDetails.courierName || "GLS Standard",
            trackingId: trackingNumber,
            awbNumber: `${shipmentId}-${trackingNumber}`,
            status: "created"
        };
    } catch (error) {
        console.error("GLS createShipmentOrder error:", error.response ? error.response.data : error.message);
        throw error;
    }
}

async function cancelShipmentOrder(orderId, awbNumber) {
    const headers = getAuthHeader();
    if (!headers || awbNumber.startsWith("mock-")) {
        checkMockAllowed("GLS");
        return { success: true, orderId, referenceId: awbNumber };
    }

    try {
        const parts = awbNumber.split("-");
        const shipmentId = parts[0];

        await axios.delete(`${GLS_API_BASE_URL}/shipment/${shipmentId}`, { headers });
        return {
            success: true,
            orderId,
            referenceId: awbNumber
        };
    } catch (error) {
        console.error("GLS cancelShipmentOrder error:", error.response ? error.response.data : error.message);
        throw error;
    }
}

async function createReturnShipmentOrder(orderDetails) {
    const headers = getAuthHeader();
    const packagesArray = orderDetails.packages && orderDetails.packages.length > 0 ? orderDetails.packages : [{ weight: orderDetails.weight || 0.5 }];

    if (!headers) {
        checkMockAllowed("GLS");
        const randomAWB = "GLSR" + Math.floor(1000000000 + Math.random() * 9000000000);
        return {
            success: true,
            courierName: "GLS Standard",
            trackingId: randomAWB,
            awbNumber: `mock-${randomAWB}`,
            status: "return_created"
        };
    }

    try {
        const cleanBilling = GLS_BILLING_ACCOUNT ? GLS_BILLING_ACCOUNT.replace(/"/g, "") : "";
        const response = await axios.post(`${GLS_API_BASE_URL}/shipment`, {
            category: "Parcel",
            billingAccount: cleanBilling,
            deliveryType: "GRD",
            paymentType: "Prepaid",
            unitOfMeasurement: "K",
            sender: constructAddress(orderDetails.customerName, orderDetails.pickupAddress, orderDetails.pickupCity, orderDetails.pickupState, orderDetails.pickupPincode, orderDetails.customerPhone),
            consignee: constructAddress("YellowDodle Return Center", "123 Returns Rd", "Toronto", "ON", "M5V2T6", "15145550199"),
            parcels: constructParcels(packagesArray)
        }, { headers });

        const data = response.data;
        const shipmentId = data.id || (response.headers['location'] ? response.headers['location'].split('/').pop() : null);
        const trackingNumber = data.trackingNumber || shipmentId;

        return {
            success: true,
            courierName: "GLS Standard",
            trackingId: trackingNumber,
            awbNumber: `${shipmentId}-${trackingNumber}`,
            status: "return_created"
        };
    } catch (error) {
        console.error("GLS createReturnShipmentOrder error:", error.response ? error.response.data : error.message);
        throw error;
    }
}

async function getLabel(awbNumber) {
    const headers = getAuthHeader();
    const mockPDF = Buffer.from(
        `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 60 >>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(Mock GLS Shipping Label for AWB: ${awbNumber}) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\n0000000207 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n321\n%%EOF`
    );

    if (!headers || awbNumber.startsWith("mock-")) {
        checkMockAllowed("GLS");
        return mockPDF;
    }

    try {
        const parts = awbNumber.split("-");
        const shipmentId = parts[0];

        const response = await axios.get(`${GLS_API_BASE_URL}/shipment/label/${shipmentId}`, {
            params: {
                labelType: "FourByFive"
            },
            headers: {
                ...headers,
                "Accept": "application/pdf"
            },
            responseType: "arraybuffer"
        });

        return Buffer.from(response.data);
    } catch (error) {
        console.error("GLS getLabel error, falling back to mock:", error.message);
        return mockPDF;
    }
}

async function trackShipment(awbNumber) {
    const headers = getAuthHeader();
    const parts = awbNumber.split("-");
    const trackingNumber = parts[parts.length - 1];

    if (!headers || awbNumber.startsWith("mock-")) {
        checkMockAllowed("GLS");
        return {
            success: true,
            data: {
                awb_number: awbNumber,
                courier: "GLS",
                current_status: "In Transit",
                scan_detail: [
                    {
                        status: "In Transit",
                        location: "Montreal, QC",
                        date: new Date().toISOString().split("T")[0]
                    }
                ]
            }
        };
    }

    try {
        const response = await axios.get(`${GLS_API_BASE_URL}/tracking/list/${trackingNumber}`, { headers });
        const data = response.data;
        const trackingInfo = Array.isArray(data) ? data[0] : data;
        const events = trackingInfo?.events || trackingInfo?.history || [];
        const currentStatus = trackingInfo?.status || "In Transit";

        const scanDetail = events.map(event => ({
            status: event.description || event.status || "In Transit",
            location: event.location || "Unknown Location",
            date: event.date || new Date().toISOString()
        }));

        return {
            success: true,
            data: {
                awb_number: awbNumber,
                courier: "GLS",
                current_status: currentStatus,
                scan_detail: scanDetail.length > 0 ? scanDetail : [
                    {
                        status: currentStatus,
                        location: "GLS Terminal",
                        date: new Date().toISOString()
                    }
                ]
            }
        };
    } catch (error) {
        console.error("GLS tracking error:", error.message);
        throw error;
    }
}

async function checkPickupAvailability({ pickupPincode, pickupDate }) {
    const cleanCode = pickupPincode?.trim().replace(/\s+/g, "");
    const isValid = /^[A-Z]\d[A-Z]\d[A-Z]\d$/i.test(cleanCode);
    if (!isValid) {
        return {
            available: false,
            pickupFee: 0,
            currency: "CAD",
            availableTimeSlots: [],
            message: "Pickup not available for this pincode/postal code"
        };
    }
    return {
        available: true,
        pickupFee: 0.00,
        currency: "CAD",
        availableTimeSlots: ["09:00 - 12:00", "13:00 - 17:00"]
    };
}

module.exports = {
    fetchRates,
    createShipmentOrder,
    trackShipment,
    cancelShipmentOrder,
    createReturnShipmentOrder,
    getLabel,
    checkPickupAvailability
};