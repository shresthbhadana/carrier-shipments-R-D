const dotenv = require("dotenv");
dotenv.config();

const FEDEX_API_URL = process.env.FEDEX_API_URL || "https://apis-sandbox.fedex.com";
const FEDEX_CLIENT_ID = process.env.FEDEX_CLIENT_ID;
const FEDEX_CLIENT_SECRET = process.env.FEDEX_CLIENT_SECRET;
const FEDEX_ACCOUNT_NUMBER = process.env.FEDEX_ACCOUNT_NUMBER;

// Token Caching (OAuth Token 1 घंटे के लिए वैध होता है)
let cachedToken = null;
let tokenExpiry = null;

// 1. Authentication Helper (OAuth 2.0 Token प्राप्त करने के लिए)
async function getAccessToken() {
    if (
        !FEDEX_CLIENT_ID || 
        !FEDEX_CLIENT_SECRET || 
        FEDEX_CLIENT_ID === "your_fedex_client_id"
    ) {
        return null; // Local mock mode
    }

    // टोकन एक्सपायरी चेक करें
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    try {
        const params = new URLSearchParams();
        params.append("grant_type", "client_credentials");
        params.append("client_id", FEDEX_CLIENT_ID);
        params.append("client_secret", FEDEX_CLIENT_SECRET);

        const response = await fetch(`${FEDEX_API_URL}/oauth/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: params
        });

        if (!response.ok) throw new Error("FedEx Auth failed");

        const data = await response.json();
        cachedToken = data.access_token;
        // टोकन को 50 मिनट के लिए कैशे करें (Buffer time के साथ)
        tokenExpiry = Date.now() + 50 * 60 * 1000; 
        return cachedToken;
    } catch (e) {
        console.error("FedEx Auth Error:", e.message);
        return null;
    }
}


async function fetchRates({ pickupPincode, deliveryPincode, weight = 0.5, cod = false }) {
    const token = await getAccessToken();

  
    if (!token) {
        const distanceFactor = Math.abs(parseInt(pickupPincode) - parseInt(deliveryPincode)) % 100;
        const basePrice = 80 + (weight * 35) + (distanceFactor * 0.9); // FedEx typically higher rates
        return [
            {
                courierId: "FEDEX_GROUND",
                courierName: "FedEx Ground",
                shippingPrice: Math.round(basePrice),
                estimatedDays: 4,
                serviceType: "Standard"
            },
            {
                courierId: "FEDEX_EXPRESS_SAVER",
                courierName: "FedEx Express Saver",
                shippingPrice: Math.round(basePrice * 1.6),
                estimatedDays: 2,
                serviceType: "Express"
            }
        ];
    }

    try {
   
        const response = await fetch(`${FEDEX_API_URL}/rate/v1/rates/quotes`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                accountNumber: { value: FEDEX_ACCOUNT_NUMBER },
                requestedShipment: {
                    shipper: { address: { postalCode: pickupPincode, countryCode: "CA" } },
                    recipient: { address: { postalCode: deliveryPincode, countryCode: "CA" } },
                    pickupType: "CONTACT_FEDEX_TO_SCHEDULE",
                    rateRequestType: ["LIST"],
                    requestedPackageLineItems: [
                        { weight: { units: "KG", value: weight } }
                    ]
                }
            })
        });

        if (!response.ok) throw new Error(`FedEx rates error: ${response.status}`);
        
        const data = await response.json();
      
        const rateReplyDetails = data.output.rateReplyDetails || [];
        return rateReplyDetails.map(rate => ({
            courierId: rate.serviceType,
            courierName: "FedEx " + rate.serviceName,
            shippingPrice: Math.round(rate.ratedShipmentDetails[0].shipmentRateDetail.totalNetCharge),
            estimatedDays: 3, 
            serviceType: rate.serviceType.includes("EXPRESS") ? "Express" : "Standard"
        }));
    } catch (error) {
        console.error("FedEx fetchRates error (falling back to mock):", error.message);
     
        return [
            { courierId: "FEDEX_GROUND", courierName: "FedEx Ground", shippingPrice: 50, estimatedDays: 4, serviceType: "Standard" }
        ];
    }
}

async function createShipmentOrder(orderDetails) {
    const token = await getAccessToken();

    if (!token) {
        const randomAWB = "FTN" + Math.floor(1000000000 + Math.random() * 9000000000);
        return {
            success: true,
            courierName: orderDetails.courierName || "FedEx Ground",
            trackingId: randomAWB,
            awbNumber: randomAWB,
            status: "created"
        };
    }

    try {
        const serviceType = orderDetails.courierName && orderDetails.courierName.includes("Express") 
            ? "FEDEX_EXPRESS_SAVER" 
            : "FEDEX_GROUND";

        const response = await fetch(`${FEDEX_API_URL}/ship/v1/shipments`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                accountNumber: { value: FEDEX_ACCOUNT_NUMBER },
                requestedShipment: {
                    serviceType: serviceType,
                    pickupType: "CONTACT_FEDEX_TO_SCHEDULE",
                    shippingChargesPayment: {
                        paymentType: "SENDER"
                    },
                    shipper: {
                        contact: { personName: "YellowDodle Store", phoneNumber: "1234567890" },
                        address: { streetLines: ["123 Main St"], city: "Ottawa", stateOrProvinceCode: "ON", postalCode: "K1A0B1", countryCode: "CA" }
                    },
                    recipient: {
                        contact: { personName: orderDetails.customerName, phoneNumber: orderDetails.customerPhone.replace(/\D/g, "") },
                        address: { streetLines: ["Delivery Address"], city: "Ottawa", stateOrProvinceCode: "ON", postalCode: orderDetails.deliveryPincode, countryCode: "CA" }
                    },
                    requestedPackageLineItems: [
                        { weight: { units: "KG", value: Number(orderDetails.weight || 0.5) } }
                    ]
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`FedEx Booking API failed: ${response.status} ${errText}`);
        }

        const data = await response.json();
        const transactionDetail = data.output.transactionShipments[0];
        const masterTrackingNumber = transactionDetail.masterTrackingNumber;

        return {
            success: true,
            courierName: orderDetails.courierName || "FedEx Ground",
            trackingId: masterTrackingNumber,
            awbNumber: masterTrackingNumber,
            status: "created"
        };
    } catch (e) {
        console.error("FedEx booking error:", e.message);
        throw e;
    }
}

async function trackShipment(awbNumber) {
    const token = await getAccessToken();

    if (!token) {
        return {
            success: true,
            data: {
                awb_number: awbNumber,
                courier: "FedEx",
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
        const response = await fetch(`${FEDEX_API_URL}/track/v1/associatedshipments`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                includeDetailedScans: true,
                trackingInfo: [
                    {
                        trackingNumberInfo: {
                            trackingNumber: awbNumber
                        }
                    }
                ]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`FedEx Tracking API failed: ${response.status} ${errText}`);
        }

        const data = await response.json();
        const trackDetail = data.output.completeTrackResults[0].trackResults[0];
        const currentStatus = trackDetail.latestStatusDetail.description || "In Transit";

        return {
            success: true,
            data: {
                awb_number: awbNumber,
                courier: "FedEx",
                current_status: currentStatus,
                scan_detail: []
            }
        };
    } catch (e) {
        console.error("FedEx tracking error:", e.message);
        throw e;
    }
}

async function cancelShipmentOrder(orderId, awbNumber) {
    const token = await getAccessToken();

    if (!token) {
        return { success: true, orderId, referenceId: awbNumber };
    }

    try {
        const response = await fetch(`${FEDEX_API_URL}/ship/v1/shipments/cancel`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                accountNumber: { value: FEDEX_ACCOUNT_NUMBER },
                trackingNumber: awbNumber
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`FedEx Cancel API failed: ${response.status} ${errText}`);
        }

        return {
            success: true,
            orderId,
            referenceId: awbNumber
        };
    } catch (e) {
        console.error("FedEx cancel order error:", e.message);
        throw e;
    }
}

async function createReturnShipmentOrder(orderDetails) {
    const token = await getAccessToken();

    if (!token) {
        const randomAWB = "RFTN" + Math.floor(1000000000 + Math.random() * 9000000000);
        return {
            success: true,
            courierName: "FedEx Ground",
            trackingId: randomAWB,
            awbNumber: randomAWB,
            status: "return_created"
        };
    }

    try {
        const response = await fetch(`${FEDEX_API_URL}/ship/v1/shipments`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                accountNumber: { value: FEDEX_ACCOUNT_NUMBER },
                requestedShipment: {
                    serviceType: "FEDEX_GROUND",
                    pickupType: "CONTACT_FEDEX_TO_SCHEDULE",
                    shippingChargesPayment: { paymentType: "SENDER" },
                    shipmentSpecialServices: {
                        specialServiceTypes: ["RETURN_SHIPMENT"],
                        returnShipmentDetail: { returnType: "PRINT_RETURN_LABEL" }
                    },
                    shipper: {
                        contact: { personName: orderDetails.customerName, phoneNumber: orderDetails.customerPhone.replace(/\D/g, "") },
                        address: { streetLines: [orderDetails.pickupAddress || "Pickup Address"], city: orderDetails.pickupCity || "Ottawa", stateOrProvinceCode: "ON", postalCode: orderDetails.pickupPincode, countryCode: "CA" }
                    },
                    recipient: {
                        contact: { personName: "YellowDodle Return Center", phoneNumber: "1234567890" },
                        address: { streetLines: ["123 Returns Rd"], city: "Ottawa", stateOrProvinceCode: "ON", postalCode: "K1A0B1", countryCode: "CA" }
                    },
                    requestedPackageLineItems: [
                        { weight: { units: "KG", value: Number(orderDetails.weight || 0.5) } }
                    ]
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`FedEx Return API failed: ${response.status} ${errText}`);
        }

        const data = await response.json();
        const transactionDetail = data.output.transactionShipments[0];
        const masterTrackingNumber = transactionDetail.masterTrackingNumber;

        return {
            success: true,
            courierName: "FedEx Ground",
            trackingId: masterTrackingNumber,
            awbNumber: masterTrackingNumber,
            status: "return_created"
        };
    } catch (e) {
        console.error("FedEx return order error:", e.message);
        throw e;
    }
}

module.exports = {
    fetchRates,
    createShipmentOrder,
    trackShipment,
    cancelShipmentOrder,
    createReturnShipmentOrder
};
