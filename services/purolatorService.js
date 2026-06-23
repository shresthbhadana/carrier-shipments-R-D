const axios = require("axios");
const { request } = require("undici");



function checkMockAllowed(serviceName) {
    if (process.env.MOCK_CARRIERS !== "true") {
        throw new Error(`Credentials missing for ${serviceName}. Fail-fast in production. Set MOCK_CARRIERS=true in .env to allow mock data fallback.`);
    }
}


const PUROLATOR_API_URL =
  process.env.PUROLATOR_API_URL ||
  "https://shipapi-sandbox.purolator.com";

const PUROLATOR_API_KEY = process.env.PUROLATOR_API_KEY;
const PUROLATOR_API_SECRET = process.env.PUROLATOR_API_SECRET;
const PUROLATOR_ACCOUNT_NUMBER = process.env.PUROLATOR_ACCOUNT_NUMBER;


let cachedToken = null;
let tokenExpiry = null;

async function getAccessToken() {
    if (!PUROLATOR_API_KEY || !PUROLATOR_API_SECRET) {
        return null;
    }

    
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    try {
        const response = await axios.post(
            `${PUROLATOR_API_URL}/oauth/token`,
            new URLSearchParams({
                grant_type: "client_credentials",
                client_id: PUROLATOR_API_KEY,
                client_secret: PUROLATOR_API_SECRET,
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        cachedToken = response.data.access_token;
        
        tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
        return cachedToken;
    } catch (error) {
        const details = error.response ? JSON.stringify(error.response.data) : error.message;
        throw new Error(`Failed to retrieve Purolator access token: ${details}`);
    }
}

async function getAuthHeader() {
    try {
        const token = await getAccessToken();
        if(!token){
            return null ;
        }
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        };
    } catch (error) {
        console.error("Auth Header Error:", error.message);
        return null;
    }
}


async function fetchRates({ pickupPincode, deliveryPincode, weight = 1.0, cod = false }) {
    const authHeaders = await getAuthHeader();
    let distanceFactor = 10;
    const p1 = parseInt(pickupPincode?.replace(/\D/g, ""));
    const p2 = parseInt(deliveryPincode?.replace(/\D/g, ""));
    if (!isNaN(p1) && !isNaN(p2)) {
        distanceFactor = Math.abs(p1 - p2) % 100;
    } else if (pickupPincode && deliveryPincode) {
        distanceFactor = Math.abs(pickupPincode.charCodeAt(0) - deliveryPincode.charCodeAt(0)) * 5;
    }

    const basePrice = 80 + (weight * 35) + (distanceFactor * 0.9);

    if (!authHeaders) {
        checkMockAllowed("Purolator");
        return [
            {
                courierId: "PUROLATOR_EXPRESS_9AM",
                courierName: "Purolator Express Box 9AM",
                shippingPrice: Math.round(basePrice),
                estimatedDays: 4,
                serviceType: "Standard"
            }
        ];
    }

    try {
        const { statusCode, body } = await request(`${PUROLATOR_API_URL}/rate/v1/shipment`, {
            method: 'POST',
            headers: {
                'x-api-key': PUROLATOR_API_KEY || '',
                'Language': 'EN',
                'RequestReference': Date.now().toString(),
                ...authHeaders
            },
            body: JSON.stringify({
                lineOfBusiness: 'Courier',
                shipmentDate: new Date().toISOString().split("T")[0],
                outboundShipment: {
                    billingInformation: {
                        billingAccountNumber: PUROLATOR_ACCOUNT_NUMBER,
                        displayPublishedRates: false
                    },
                    senderInformation: {
                        companyName: 'SHIPPER',
                        streetAddress: ['SUITE 101'],
                        city: 'MISSISSAUGA',
                        provinceStateCode: 'ON',
                        country: 'CA',
                        postalZipCode: pickupPincode || 'A7A 4Y7'
                    },
                    receiverInformation: {
                        companyName: 'SHIPPER',
                        streetAddress: ['SUITE 101'],
                        city: 'MISSISSAUGA',
                        provinceStateCode: 'ON',
                        country: 'CA',
                        postalZipCode: deliveryPincode || 'A7A 4Y7'
                    },
                    shipmentInformation: {
                        serviceId: 'PurolatorExpressBox9AM',
                        unitOfMeasurement: 'Imperial',
                        showAlternativeServicesIndicator: true,
                        totalWeight: String(weight),
                        totalPackages: 1,
                        shipmentOptionsInformation: [
                            {
                                optionId: 'AdultSignatureRequired',
                                optionIdValue: 'Yes'
                            }
                        ],
                        packageInformation: [
                            {
                                packageWeight: String(weight),
                                packageLength: '12.0',
                                packageWidth: '12.0',
                                packageHeight: '12.0'
                            }
                        ]
                    }
                }
            })
        });

        if (statusCode !== 200) {
            throw new Error(`Purolator rates request failed: ${statusCode}`);
        }

        const data = await body.json();
        const estimates = data.shipmentEstimates || [];
        if (estimates.length > 0) {
            return estimates.map(rate => ({
                courierId: rate.serviceId || "PUROLATOR_EXPRESS",
                courierName: "Purolator " + (rate.serviceName || rate.serviceId || "Express"),
                shippingPrice: Math.round(rate.totalPrice || rate.basePrice || basePrice),
                estimatedDays: rate.estimatedTransitDays || 4,
                serviceType: rate.serviceId?.includes("Express") ? "Express" : "Standard"
            }));
        }

        return [
            {
                courierId: "PUROLATOR_EXPRESS_9AM",
                courierName: "Purolator Express Box 9AM",
                shippingPrice: Math.round(basePrice),
                estimatedDays: 4,
                serviceType: "Standard"
            }
        ];
    } catch (err) {
        console.error("Purolator fetchRates error, falling back to mock:", err.message);
        checkMockAllowed("Purolator");
        return [
            {
                courierId: "PUROLATOR_EXPRESS_9AM",
                courierName: "Purolator Express Box 9AM",
                shippingPrice: Math.round(basePrice),
                estimatedDays: 4,
                serviceType: "Standard"
            }
        ];
    }
}

async function getLocations(postalCode) {
    const headers = await getAuthHeader();
    if (!headers) {
        checkMockAllowed("Purolator");
        return {
            courierId: "PUROLATOR1223",
            courierName: "Purolator Express Box 9AM",
            locations: [
                {
                    name: "Mock Purolator Depot Mississauga",
                    address: "123 Mississauga Rd",
                    city: "Mississauga",
                    province: "ON",
                    postalCode: postalCode || "L5R3T8"
                }
            ]
        };
    }
    try {
        const response = await axios.get(
            `${PUROLATOR_API_URL}/locator/v1/address`,
            {
                params: {
                    language: "en",
                    requestReference: Date.now().toString(),
                    postalCode
                },
                headers
            }
        );
        const locations = response.data.pickupLocations || [];
        return {
            courierId: "PUROLATOR1223",
            courierName: "Purolator Express Box 9AM",
            locations
        };
    } catch (err) {
        console.error("Purolator getLocations error:", err.message);
        throw new Error(err.response?.data?.message || err.message || "Failed to retrieve locations");
    }
}
async function getpickup(pickupDetails = {}) {
    try {
        const authHeaders = await getAuthHeader();
        if (!authHeaders) {
            checkMockAllowed("Purolator");
            return {
                success: true,
                message: "Mock pickup scheduled successfully",
                pickupConfirmationNumber: "MPUR" + Math.floor(1000000000 + Math.random() * 9000000000)
            };
        }

        const response = await request(`${PUROLATOR_API_URL}/pickup/v1/schedule`, {
            method: 'POST',
            headers: {
                'x-api-key': PUROLATOR_API_KEY || '',
                'Language': 'EN',
                'RequestReference': Date.now().toString(),
                ...authHeaders
            },
            body: JSON.stringify({
                registeredAccountNumber: PUROLATOR_ACCOUNT_NUMBER,
                pickupInstructions: {
                    date: pickupDetails.date || new Date().toISOString().split("T")[0],
                    anyTimeAfter: pickupDetails.anyTimeAfter || '12:30',
                    untilTime: pickupDetails.untilTime || '19:50',
                    measurementUnit: 'Metric',
                    totalWeight: String(pickupDetails.weight || '1.0'),
                    pickupLocation: pickupDetails.pickupLocation || 'FrontDesk',
                    additionalInstructions: pickupDetails.additionalInstructions || '',
                    supplyRequestCodes: pickupDetails.supplyRequestCodes || ['ExpressEnvelope'],
                    trailerAccessible: 'false',
                    loadingDockAvailable: 'false',
                    shipmentOnSkids: 'false',
                    numberOfSkids: '1'
                },
                pickupAddress: {
                    address: [pickupDetails.pickupAddress || '123 Main St'],
                    province: pickupDetails.pickupState || 'ON',
                    city: pickupDetails.pickupCity || 'TORONTO',
                    country: 'CA',
                    postalCode: pickupDetails.pickupPincode || 'L5R3T8'
                },
                shipmentSummary: [
                    {
                        destinationCode: 'DOM',
                        totalPieces: 1,
                        totalWeight: Number(pickupDetails.weight || 1.0),
                        modeOfTransport: 'Ground'
                    }
                ],
                contactInfo: {
                    name: pickupDetails.customerName || 'John Doe',
                    company: 'Purolator Client',
                    phoneNumber: pickupDetails.customerPhone ? pickupDetails.customerPhone.replace(/\D/g, "") : '14031234567',
                    phoneExtension: ''
                },
                pickupNotificationEmail: pickupDetails.email || 'info@purolator.com',
                lineOfBusiness: 'Courier'
            })
        });

        if (response.statusCode !== 200) {
            const errText = await response.body.text();
            throw new Error(`Schedule pickup request failed: ${response.statusCode} ${errText}`);
        }

        const data = await response.body.json();
        return {
            success: true,
            message: "Pickup scheduled successfully",
            pickupConfirmationNumber: data.pickupConfirmationNumber || "PUR" + Math.floor(10000000 + Math.random() * 90000000)
        };
    } catch (error) {
        console.error("Purolator pickup scheduling error:", error.message);
        throw error;
    }
}
async function trackShipment(awbNumber) {
    try {
        const authHeaders = await getAuthHeader();
        if (!authHeaders) {
            checkMockAllowed("Purolator");
            return {
                success: true,
                data: {
                    awb_number: awbNumber,
                    courier: "Purolator",
                    current_status: "In Transit",
                    scan_detail: [
                        {
                            status: "In Transit",
                            location: "Mississauga, ON",
                            date: new Date().toISOString().split("T")[0]
                        }
                    ]
                }
            };
        }
        const { statusCode, body } = await request(`${PUROLATOR_API_URL}/tracking/events`, {
            method: 'GET',
            headers: {
                'Request-Reference': Date.now().toString(),
                'Accept': 'application/json',
                ...authHeaders
            },
            query: {
                trackingNumber: awbNumber || '569597392129',
                showPickupEvents: 'false',
                showReturnEvents: 'false'
            }
        });

        if (statusCode !== 200) {
            const errText = await body.text();
            throw new Error(`Purolator tracking request failed: ${statusCode} ${errText}`);
        }

        const data = await body.json();
        const events = data.events || data.trackingEvents?.[0]?.events || [];
        const scanDetail = events.map(event => ({
            status: event.description || event.eventDescription || event.status || "In Transit",
            location: event.location || (event.eventLocation ? `${event.eventLocation.city || ""}, ${event.eventLocation.province || ""}`.trim().replace(/^,\s*|,\s*$/g, "") : "Unknown Location"),
            date: event.date || event.eventDate || new Date().toISOString()
        }));

        return {
            success: true,
            data: {
                awb_number: awbNumber,
                courier: "Purolator",
                current_status: scanDetail[0]?.status || "In Transit",
                scan_detail: scanDetail.length > 0 ? scanDetail : [
                    {
                        status: "In Transit",
                        location: "Mississauga, ON",
                        date: new Date().toISOString().split("T")[0]
                    }
                ]
            }
        };
    } catch (error) {
        console.error("Purolator tracking error:", error.message);
        throw error;
    }
}

async function createShipmentOrder(orderDetails) {
    const headers = await getAuthHeader();
    if (!headers) {
        checkMockAllowed("Purolator");
        const randomAWB = "PUR" + Math.floor(1000000000 + Math.random() * 9000000000);
        return {
            success: true,
            courierName: orderDetails.courierName || "Purolator Express",
            trackingId: randomAWB,
            awbNumber: randomAWB,
            status: "created"
        };
    }
    throw new Error("Purolator createShipmentOrder real API is not fully implemented. Set MOCK_CARRIERS=true to use mocks.");
}

async function cancelShipmentOrder(orderId, awbNumber) {
    const headers = await getAuthHeader();
    if (!headers) {
        checkMockAllowed("Purolator");
        return { success: true, orderId: orderId, referenceId: awbNumber };
    }
    throw new Error("Purolator cancelShipmentOrder real API is not fully implemented. Set MOCK_CARRIERS=true to use mocks.");
}

async function createReturnShipmentOrder(orderDetails) {
    const headers = await getAuthHeader();
    if (!headers) {
        checkMockAllowed("Purolator");
        const randomAWB = "PURR" + Math.floor(1000000000 + Math.random() * 9000000000);
        return {
            success: true,
            courierName: "Purolator Express",
            trackingId: randomAWB,
            awbNumber: randomAWB,
            status: "return_created"
        };
    }
    throw new Error("Purolator createReturnShipmentOrder real API is not fully implemented. Set MOCK_CARRIERS=true to use mocks.");
}

async function getLabel(awbNumber) {
    const headers = await getAuthHeader();
    const mockPDF = Buffer.from(
        `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 64 >>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(Mock Purolator Shipping Label for AWB: ${awbNumber}) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\n0000000212 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n326\n%%EOF`
    );
    if (!headers) {
        checkMockAllowed("Purolator");
        return mockPDF;
    }
    throw new Error("Purolator getLabel real API is not fully implemented. Set MOCK_CARRIERS=true to use mocks.");
}

module.exports = {
    fetchRates,
    getLocations,
    getpickup,
    trackShipment,
    createShipmentOrder,
    cancelShipmentOrder,
    createReturnShipmentOrder,
    getLabel
};
