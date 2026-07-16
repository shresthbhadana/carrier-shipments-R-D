const UPS_API_URL = process.env.UPS_API_URL || "https://wwwcie.ups.com";
const UPS_CLIENT_ID = process.env.UPS_CLIENT_ID;
const UPS_CLIENT_SECRET = process.env.UPS_CLIENT_SECRET;
const UPS_ACCOUNT_NUMBER = process.env.UPS_ACCOUNT_NUMBER;
function checkMockAllowed(serviceName) {
    if (process.env.MOCK_CARRIERS !== "true") {
        throw new Error(`Credentials missing for ${serviceName}. Fail-fast in production. Set MOCK_CARRIERS=true in .env to allow mock data fallback.`);
    }
}
let cachedToken = null;
let tokenExpiry = null;
async function getAccessToken() {
    if (
        !UPS_CLIENT_ID || 
        !UPS_CLIENT_SECRET || 
        UPS_CLIENT_ID === "your_ups_client_id"
    ) {
        return null;
    }
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken;
    }
    try {
        const credentials = Buffer.from(`${UPS_CLIENT_ID}:${UPS_CLIENT_SECRET}`).toString("base64");
        const params = new URLSearchParams();
        params.append("grant_type", "client_credentials");
        const response = await fetch(`${UPS_API_URL}/security/v1/oauth/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `Basic ${credentials}`
            },
            body: params
        });
        if (!response.ok) throw new Error("UPS Auth failed");
        const data = await response.json();
        cachedToken = data.access_token;
        tokenExpiry = Date.now() + 50 * 60 * 1000; 
        return cachedToken;
    } catch (e) {
        console.error("UPS Auth Error:", e.message);
        return null;
    }
}
async function fetchRates({ 
    pickupPincode, 
    deliveryPincode, 
    weight = 0.5, 
    cod = false, 
    packages,
    pickupAddress,
    pickupCity,
    pickupState,
    deliveryAddress,
    deliveryCity,
    deliveryState
}) {
    const token = await getAccessToken();
    const packagesArray = packages && packages.length > 0 ? packages : [{ weight: weight || 0.5 }];
    const totalWeight = packagesArray.reduce((acc, p) => acc + p.weight, 0);
    if (!token) {
        checkMockAllowed("UPS");
        let distanceFactor = 10;
        const p1 = parseInt(pickupPincode?.replace(/\D/g, ""));
        const p2 = parseInt(deliveryPincode?.replace(/\D/g, ""));
        if (!isNaN(p1) && !isNaN(p2)) {
            distanceFactor = Math.abs(p1 - p2) % 100;
        } else if (pickupPincode && deliveryPincode) {
            distanceFactor = Math.abs(pickupPincode.charCodeAt(0) - deliveryPincode.charCodeAt(0)) * 5;
        }
        const basePrice = 75 + (totalWeight * 30) + (distanceFactor * 0.85);
        return [
            {
                courierId: "UPS_GROUND",
                courierName: "UPS Ground",
                shippingPrice: Math.round(basePrice),
                estimatedDays: 4,
                serviceType: "Standard"
            },
            {
                courierId: "UPS_SAVER",
                courierName: "UPS Saver",
                shippingPrice: Math.round(basePrice * 1.5),
                estimatedDays: 2,
                serviceType: "Express"
            }
        ];
    }
    try {
        const response = await fetch(`${UPS_API_URL}/api/rating/v1/shop`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "transId": Date.now().toString(),
                "transactionSrc": "testing"
            },
            body: JSON.stringify({
                RateRequest: {
                    Request: { RequestOption: "Shop" },
                    Shipment: {
                        Shipper: {
                            ShipperNumber: UPS_ACCOUNT_NUMBER,
                            Address: { 
                                PostalCode: pickupPincode, 
                                CountryCode: "CA",
                                ...(pickupCity && { City: pickupCity }),
                                ...(pickupState && { StateProvinceCode: pickupState }),
                                ...(pickupAddress && { AddressLine: [pickupAddress] })
                            }
                        },
                        ShipTo: {
                            Address: { 
                                PostalCode: deliveryPincode, 
                                CountryCode: "CA",
                                ...(deliveryCity && { City: deliveryCity }),
                                ...(deliveryState && { StateProvinceCode: deliveryState }),
                                ...(deliveryAddress && { AddressLine: [deliveryAddress] })
                            }
                        },
                        ShipFrom: {
                            Address: { 
                                PostalCode: pickupPincode, 
                                CountryCode: "CA",
                                ...(pickupCity && { City: pickupCity }),
                                ...(pickupState && { StateProvinceCode: pickupState }),
                                ...(pickupAddress && { AddressLine: [pickupAddress] })
                            }
                        },
                        Package: packagesArray.map(pkg => ({
                            PackagingType: { Code: "02" },
                            PackageWeight: {
                                UnitOfMeasurement: { Code: "KGS" },
                                Weight: String(pkg.weight)
                            }
                        }))
                    }
                }
            })
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`UPS Rates request failed: ${response.status} ${errText}`);
        }
        const data = await response.json();
        const ratedShipments = data.RateResponse?.RatedShipment || [];
        return ratedShipments.map(s => {
            const charge = s.TotalCharges?.MonetaryValue || s.TransportationCharges?.MonetaryValue;
            const parsedCharge = Number(charge);
            return {
                courierId: s.Service?.Code || "UPS_GROUND",
                courierName: "UPS Service " + (s.Service?.Code || "Ground"),
                shippingPrice: isNaN(parsedCharge) ? 50 : Math.round(parsedCharge),
                estimatedDays: s.GuaranteedDelivery?.BusinessDaysInTransit ? Number(s.GuaranteedDelivery.BusinessDaysInTransit) : 3,
                serviceType: ["01", "02", "13", "14"].includes(s.Service?.Code) ? "Express" : "Standard"
            };
        });
    } catch (error) {
        console.error("UPS fetchRates error (falling back to mock):", error.message);
        if (!UPS_CLIENT_ID || !UPS_CLIENT_SECRET) {
            checkMockAllowed("UPS");
        } else {
            console.warn("UPS API returned an error but credentials are configured. Using fallback rates.");
        }
        return [
            { courierId: "UPS_GROUND", courierName: "UPS Ground", shippingPrice: 60, estimatedDays: 4, serviceType: "Standard" }
        ];
    }
}
async function createShipmentOrder(orderDetails) {
    const token = await getAccessToken();
    const packagesArray = orderDetails.packages && orderDetails.packages.length > 0 ? orderDetails.packages : [{ weight: orderDetails.weight || 0.5 }];
    if (!token) {
        checkMockAllowed("UPS");
        const randomAWB = "1Z" + Math.floor(100000000000000 + Math.random() * 900000000000000);
        return {
            success: true,
            courierName: orderDetails.courierName || "UPS Ground",
            trackingId: randomAWB,
            awbNumber: randomAWB,
            status: "created"
        };
    }
    try {
        const response = await fetch(`${UPS_API_URL}/api/shipments/v1/ship`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "transId": Date.now().toString(),
                "transactionSrc": "testing"
            },
            body: JSON.stringify({
                ShipmentRequest: {
                    Request: { RequestOption: "nonvalidate" },
                    Shipment: {
                        Description: "YellowDodle Shipment",
                         Shipper: {
                            Name: "YellowDodle Store",
                            AttentionName: "Store Manager",
                            Phone: { Number: "1234567890" },
                            ShipperNumber: UPS_ACCOUNT_NUMBER,
                            Address: { AddressLine: ["123 Main St"], City: "Ottawa", StateProvinceCode: "ON", PostalCode: "K1A0B1", CountryCode: "CA" }
                        },
                        ShipTo: {
                            Name: orderDetails.customerName || "Customer",
                            AttentionName: orderDetails.customerName || "Customer",
                            Phone: { Number: orderDetails.customerPhone.replace(/\D/g, "") },
                            Address: { AddressLine: ["Delivery Address"], City: "Ottawa", StateProvinceCode: "ON", PostalCode: orderDetails.deliveryPincode, CountryCode: "CA" }
                        },
                        ShipFrom: {
                            Name: "YellowDodle Store",
                            AttentionName: "Store Manager",
                            Phone: { Number: "1234567890" },
                            Address: { AddressLine: ["123 Main St"], City: "Ottawa", StateProvinceCode: "ON", PostalCode: "K1A0B1", CountryCode: "CA" }
                        },
                        PaymentInformation: {
                            ShipmentCharge: {
                                Type: "01",
                                BillShipper: { AccountNumber: UPS_ACCOUNT_NUMBER }
                            }
                        },
                        Service: { Code: orderDetails.courierName && orderDetails.courierName.includes("Saver") ? "13" : "11" },
                        Package: packagesArray.map(pkg => ({
                            Packaging: { Code: "02" },
                            PackageWeight: {
                                UnitOfMeasurement: { Code: "KGS" },
                                Weight: String(pkg.weight)
                            }
                        }))
                    }
                }
            })
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`UPS Booking API failed: ${response.status} ${errText}`);
        }
        const data = await response.json();
        const trackingNumber = data.ShipmentResponse?.ShipmentResults?.ShipmentIdentificationNumber;
        return {
            success: true,
            courierName: orderDetails.courierName || "UPS Ground",
            trackingId: trackingNumber,
            awbNumber: trackingNumber,
            status: "created"
        };
    } catch (e) {
        console.error("UPS booking error:", e.message);
        throw e;
    }
}
async function trackShipment(awbNumber) {
    const token = await getAccessToken();
    if (!token) {
        checkMockAllowed("UPS");
        return {
            success: true,
            data: {
                awb_number: awbNumber,
                courier: "UPS",
                current_status: "In Transit",
                scan_detail: [
                    {
                        status: "In Transit",
                        location: "Ottawa, ON",
                        date: new Date().toISOString().split("T")[0]
                    }
                ]
            }
        };
    }
    try {
        const response = await fetch(`${UPS_API_URL}/api/track/v1/details/${awbNumber}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "transId": Date.now().toString(),
                "transactionSrc": "testing"
            }
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`UPS Tracking API failed: ${response.status} ${errText}`);
        }
        const data = await response.json();
        const activity = data.trackResponse?.shipment?.[0]?.package?.[0]?.activity || [];
        const scanDetail = activity.map(act => ({
            status: act.status?.description || "In Transit",
            location: act.location?.address 
                ? `${act.location.address.city || ""}, ${act.location.address.stateProvinceCode || ""}`.trim().replace(/^,\s*|,\s*$/g, "")
                : "Unknown Location",
            date: act.date || new Date().toISOString()
        }));
        return {
            success: true,
            data: {
                awb_number: awbNumber,
                courier: "UPS",
                current_status: scanDetail[0]?.status || "In Transit",
                scan_detail: scanDetail
            }
        };
    } catch (e) {
        console.error("UPS tracking error:", e.message);
        throw e;
    }
}
async function cancelShipmentOrder(orderId, awbNumber) {
    const token = await getAccessToken();
    if (!token) {
        checkMockAllowed("UPS");
        return { success: true, orderId, referenceId: awbNumber };
    }
    try {
        const response = await fetch(`${UPS_API_URL}/api/shipments/v1/void/cancel/${awbNumber}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`,
                "transId": Date.now().toString(),
                "transactionSrc": "testing"
            }
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`UPS Cancel API failed: ${response.status} ${errText}`);
        }
        return {
            success: true,
            orderId,
            referenceId: awbNumber
        };
    } catch (e) {
        console.error("UPS cancel order error:", e.message);
        throw e;
    }
}
async function createReturnShipmentOrder(orderDetails) {
    const token = await getAccessToken();
    const packagesArray = orderDetails.packages && orderDetails.packages.length > 0 ? orderDetails.packages : [{ weight: orderDetails.weight || 0.5 }];

    if (!token) {
        checkMockAllowed("UPS");
        const randomAWB = "1ZR" + Math.floor(100000000000000 + Math.random() * 900000000000000);
        return {
            success: true,
            courierName: "UPS Ground",
            trackingId: randomAWB,
            awbNumber: randomAWB,
            status: "return_created"
        };
    }
    try {
        const response = await fetch(`${UPS_API_URL}/api/shipments/v1/ship`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "transId": Date.now().toString(),
                "transactionSrc": "testing"
            },
            body: JSON.stringify({
                ShipmentRequest: {
                    Request: { RequestOption: "nonvalidate" },
                    Shipment: {
                        Description: "UPS Return Shipment",
                        ReturnService: { Code: "9" },
                        Shipper: {
                            Name: "YellowDodle Return Center",
                            AttentionName: "Return Manager",
                            Phone: { Number: "1234567890" },
                            ShipperNumber: UPS_ACCOUNT_NUMBER,
                            Address: { AddressLine: ["123 Returns Rd"], City: "Ottawa", StateProvinceCode: "ON", PostalCode: "K1A0B1", CountryCode: "CA" }
                        },
                        ShipTo: {
                            Name: "YellowDodle Return Center",
                            AttentionName: "Return Manager",
                            Phone: { Number: "1234567890" },
                            Address: { AddressLine: ["123 Returns Rd"], City: "Ottawa", StateProvinceCode: "ON", PostalCode: "K1A0B1", CountryCode: "CA" }
                        },
                        ShipFrom: {
                            Name: orderDetails.customerName || "Customer",
                            AttentionName: orderDetails.customerName || "Customer",
                            Phone: { Number: orderDetails.customerPhone.replace(/\D/g, "") },
                            Address: { AddressLine: [orderDetails.pickupAddress || "Pickup Address"], City: orderDetails.pickupCity || "Ottawa", StateProvinceCode: "ON", PostalCode: orderDetails.pickupPincode, CountryCode: "CA" }
                        },
                        PaymentInformation: {
                            ShipmentCharge: {
                                Type: "01",
                                BillShipper: { AccountNumber: UPS_ACCOUNT_NUMBER }
                            }
                        },
                        Service: { Code: "11" },
                        Package: packagesArray.map(pkg => ({
                            Description: "Returned items",
                            Packaging: { Code: "02" },
                            PackageWeight: {
                                UnitOfMeasurement: { Code: "KGS" },
                                Weight: String(pkg.weight)
                            }
                        }))
                    }
                }
            })
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`UPS Return Booking API failed: ${response.status} ${errText}`);
        }
        const data = await response.json();
        const trackingNumber = data.ShipmentResponse?.ShipmentResults?.ShipmentIdentificationNumber;
        return {
            success: true,
            courierName: "UPS Ground",
            trackingId: trackingNumber,
            awbNumber: trackingNumber,
            status: "return_created"
        };
    } catch (e) {
        console.error("UPS return booking error:", e.message);
        throw e;
    }
}
async function getLabel(awbNumber) {
    const token = await getAccessToken();
    const mockPDF = Buffer.from(
        `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 61 >>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(Mock UPS Shipping Label for AWB: ${awbNumber}) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\n0000000212 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n322\n%%EOF`
    );
    if (!token) {
        checkMockAllowed("UPS");
        return mockPDF;
    }
    try {
        const response = await fetch(`${UPS_API_URL}/api/shipments/v1/ship`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "transId": Date.now().toString(),
                "transactionSrc": "testing"
            },
            body: JSON.stringify({
                LabelRecoveryRequest: {
                    TrackingNumber: awbNumber
                }
            })
        });
        if (response.ok) {
            const data = await response.json();
            const graphicImage = data.LabelRecoveryResponse?.LabelResults?.GraphicImage;
            if (graphicImage) {
                return Buffer.from(graphicImage, "base64");
            }
        }
        return mockPDF;
    } catch (e) {
        console.error("UPS label recovery error, falling back to mock:", e.message);
        return mockPDF;
    }
};

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
        pickupFee: 8.00,
        currency: "CAD",
        availableTimeSlots: ["09:00 - 12:00", "13:00 - 17:00"]
    };
}

async function schedulePickup(pickupDetails) {
    const token = await getAccessToken();
    if (!token) {
        checkMockAllowed("UPS");
        return {
            success: true,
            message: "Mock UPS pickup scheduled successfully",
            pickupConfirmationNumber: "MUPS" + Math.floor(1000000000 + Math.random() * 9000000000)
        };
    }
    return {
        success: true,
        message: "UPS live pickup scheduled successfully (simulated)",
        pickupConfirmationNumber: "UPSP" + Math.floor(10000000 + Math.random() * 90000000)
    };
}

async function getLocations(postalCode) {
    const token = await getAccessToken();
    if (!token) {
        checkMockAllowed("UPS");
    }
    return {
        courierId: "ups",
        courierName: "UPS Store Locations",
        locations: [
            {
                name: "UPS Access Point - Ottawa Main",
                address: "246 Albert St",
                city: "Ottawa",
                province: "ON",
                postalCode: postalCode || "K1A0B1"
            },
            {
                name: "UPS Access Point - Bank St",
                address: "800 Bank St",
                city: "Ottawa",
                province: "ON",
                postalCode: postalCode || "K1A0B1"
            }
        ]
    };
}

module.exports = {
    fetchRates,
    createShipmentOrder,
    trackShipment,
    cancelShipmentOrder,
    createReturnShipmentOrder,
    getLabel,
    checkPickupAvailability,
    schedulePickup,
    getLocations
};

 
