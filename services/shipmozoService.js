const dotenv = require("dotenv");
dotenv.config();

const SHIPMOZO_API_URL = process.env.SHIPMOZO_API_URL || "https://shipping-api.com/app/api/v1";
const SHIPMOZO_PUBLIC_KEY = process.env.SHIPMOZO_PUBLIC_KEY;
const SHIPMOZO_PRIVATE_KEY = process.env.SHIPMOZO_PRIVATE_KEY;

function getAuthHeaders() {
    if (!SHIPMOZO_PUBLIC_KEY || !SHIPMOZO_PRIVATE_KEY || SHIPMOZO_PUBLIC_KEY === "your_public_key") {
        return null;
    }
    return {
        "Content-Type": "application/json",
        "public-key": SHIPMOZO_PUBLIC_KEY,
        "private-key": SHIPMOZO_PRIVATE_KEY
    };
}

async function getWarehouseId(headers) {
    try {
        const response = await fetch(`${SHIPMOZO_API_URL}/get-warehouses`, {
            method: "GET",
            headers
        });
        if (response.ok) {
            const data = await response.json();
            if (data && data.result === "1" && Array.isArray(data.data) && data.data.length > 0) {
                const active = data.data.find(w => w.status === "ACTIVE") || data.data[0];
                return active.id;
            }
        }
    } catch (e) {
        console.error("Failed to fetch warehouses:", e.message);
    }
    return "";
}

async function fetchRates({ pickupPincode, deliveryPincode, weight = 0.5, cod = false }) {
    const headers = getAuthHeaders();

    if (!headers) {
        // Fallback mock shipping rates for local development
        const distanceFactor = Math.abs(parseInt(pickupPincode) - parseInt(deliveryPincode)) % 100;
        const basePrice = 40 + (weight * 20) + (distanceFactor * 0.5);
        return [
            {
                courierId: 1,
                courierName: "Delhivery",
                shippingPrice: Math.round(basePrice),
                estimatedDays: 3,
                serviceType: "Standard"
            },
            {
                courierId: 2,
                courierName: "BlueDart Express",
                shippingPrice: Math.round(basePrice * 1.4),
                estimatedDays: 1,
                serviceType: "Express"
            }
        ];
    }

    try {
        const response = await fetch(`${SHIPMOZO_API_URL}/rate-calculator`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                order_id: "",
                pickup_pincode: Number(pickupPincode),
                delivery_pincode: Number(deliveryPincode),
                payment_type: cod ? "COD" : "PREPAID",
                shipment_type: "FORWARD",
                order_amount: 100,
                type_of_package: "SPS",
                rov_type: "ROV_OWNER",
                cod_amount: "",
                weight: Number(weight) * 1000, // Convert to grams as requested by API doc
                dimensions: [
                    {
                        no_of_box: "1",
                        length: "10",
                        width: "10",
                        height: "10"
                    }
                ]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Rate-Calculator request failed: ${response.status} ${errText}`);
        }

        const data = await response.json();
        if (data && data.result === "1" && data.data) {
            const list = Array.isArray(data.data) ? data.data : (data.data.couriers || []);
            return list.map(c => ({
                courierId: c.courier_id || c.id || 1,
                courierName: c.courier_name || c.name || "Courier Service",
                shippingPrice: Number(c.rate || c.freight_charge || 60),
                estimatedDays: c.etd || 3,
                serviceType: c.service_type || "Standard"
            }));
        }
        throw new Error(data.message || "Rates request failed on Shipmozo server");
    } catch (error) {
        console.error("Rates fetch error (falling back to mock):", error.message);
        const distanceFactor = Math.abs(parseInt(pickupPincode) - parseInt(deliveryPincode)) % 100;
        const basePrice = 40 + (Number(weight) * 20) + (distanceFactor * 0.5);
        return [
            {
                courierId: 1,
                courierName: "Delhivery",
                shippingPrice: Math.round(basePrice),
                estimatedDays: 3,
                serviceType: "Standard"
            },
            {
                courierId: 2,
                courierName: "BlueDart Express",
                shippingPrice: Math.round(basePrice * 1.4),
                estimatedDays: 1,
                serviceType: "Express"
            }
        ];
    }
}

async function createShipmentOrder(orderDetails) {
    const headers = getAuthHeaders();

    if (!headers) {
        const randomAWB = "SMZ" + Math.floor(1000000000 + Math.random() * 9000000000);
        return {
            success: true,
            courierName: orderDetails.courierName || "Delhivery",
            trackingId: randomAWB,
            awbNumber: randomAWB,
            status: "created"
        };
    }

    try {
        const warehouseId = await getWarehouseId(headers);
        const orderDateStr = new Date().toISOString().split("T")[0];

        // 1. Push order details to panel
        const pushResponse = await fetch(`${SHIPMOZO_API_URL}/push-order`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                order_id: String(orderDetails.orderId),
                order_date: orderDateStr,
                order_type: "ESSENTIALS",
                consignee_name: orderDetails.customerName,
                consignee_phone: Number(orderDetails.customerPhone.replace(/\D/g, "")),
                consignee_address_line_one: "Plaza Office, Sector 12",
                consignee_pin_code: Number(orderDetails.deliveryPincode),
                consignee_city: "Gurgaon",
                consignee_state: "Haryana",
                product_detail: [
                    {
                        name: "E-commerce Item",
                        sku_number: "SKU123",
                        quantity: 1,
                        discount: "",
                        hsn: "#123",
                        unit_price: 100,
                        product_category: "Other"
                    }
                ],
                payment_type: "PREPAID",
                cod_amount: "",
                weight: Number(orderDetails.weight || 0.5) * 1000, // in grams
                length: 10,
                width: 10,
                height: 10,
                warehouse_id: String(warehouseId)
            })
        });

        if (!pushResponse.ok) {
            const errText = await pushResponse.text();
            throw new Error(`Push-Order request failed: ${pushResponse.status} ${errText}`);
        }

        const pushData = await pushResponse.json();
        if (pushData.result !== "1") {
            throw new Error(pushData.message || "Order Push failed on Shipmozo server");
        }

        // 2. Auto-assign courier to get tracking / AWB number
        const assignResponse = await fetch(`${SHIPMOZO_API_URL}/auto-assign-order`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                order_id: String(orderDetails.orderId)
            })
        });

        if (!assignResponse.ok) {
            const errText = await assignResponse.text();
            throw new Error(`Auto-Assign-Order request failed: ${assignResponse.status} ${errText}`);
        }

        const assignData = await assignResponse.json();
        if (assignData.result === "1" && assignData.data) {
            return {
                success: true,
                courierName: assignData.data.courier_company || "Courier Service",
                trackingId: assignData.data.awb_number,
                awbNumber: assignData.data.awb_number,
                status: "created"
            };
        }
        throw new Error(assignData.message || "Auto-assign courier failed");
    } catch (error) {
        console.error("Shipment booking error:", error.message);
        throw error;
    }
}

async function trackShipment(awbNumber) {
    const headers = getAuthHeaders();

    if (!headers) {
        return {
            success: true,
            data: {
                awb_number: awbNumber,
                courier: "Delhivery",
                expected_delivery_date: null,
                current_status: "Pickup Pending",
                scan_detail: []
            }
        };
    }

    try {
        const response = await fetch(`${SHIPMOZO_API_URL}/track-order?awb_number=${awbNumber}`, {
            method: "GET",
            headers
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Track-Order request failed: ${response.status} ${errText}`);
        }

        const data = await response.json();
        if (data && data.result === "1" && data.data) {
            return {
                success: true,
                data: data.data
            };
        }
        throw new Error(data.message || "Tracking request failed");
    } catch (error) {
        console.error("Tracking error:", error.message);
        throw error;
    }
}



async function cancelShipmentOrder(orderId, awbNumber) {
    const headers = getAuthHeaders();

    if (!headers) {
        return { success: true, order_id: orderId, reference_id: orderId };
    }

    try {
        const response = await fetch(`${SHIPMOZO_API_URL}/cancel-order`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                order_id: String(orderId),
                awb_number: Number(awbNumber)
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Cancel-Order failed: ${response.status} ${errText}`);
        }

        const data = await response.json();
        if (data && data.result === "1") {
            return {
                success: true,
                orderId: data.data.order_id,
                referenceId: data.data.reference_id
            };
        }
        throw new Error(data.message || "Cancellation failed on Shipmozo");
    } catch (error) {
        console.error("Cancel order error:", error.message);
        throw error;
    }
}
async function createReturnShipmentOrder(orderDetails) {
    const headers = getAuthHeaders();

    if (!headers) {
        const randomAWB = "RTN" + Math.floor(1000000000 + Math.random() * 9000000000);
        return {
            success: true,
            courierName: "Delhivery",
            trackingId: randomAWB,
            awbNumber: randomAWB,
            status: "return_created"
        };
    }

    try {
        const warehouseId = await getWarehouseId(headers);
        const orderDateStr = new Date().toISOString().split("T")[0];

        // 1. Push return details
        const pushResponse = await fetch(`${SHIPMOZO_API_URL}/push-return-order`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                order_id: String(orderDetails.orderId),
                order_date: orderDateStr,
                order_type: "ESSENTIALS",
                pickup_name: orderDetails.customerName,
                pickup_phone: Number(orderDetails.customerPhone.replace(/\D/g, "")),
                pickup_address_line_one: orderDetails.pickupAddress || "Plaza Office, Sector 12",
                pickup_pin_code: Number(orderDetails.pickupPincode),
                pickup_city: orderDetails.pickupCity || "Gurgaon",
                pickup_state: orderDetails.pickupState || "Haryana",
                product_detail: [
                    {
                        name: "Returned Item",
                        sku_number: "SKU123",
                        quantity: 1,
                        discount: "",
                        hsn: "#123",
                        unit_price: 100,
                        product_category: "Other"
                    }
                ],
                payment_type: "PREPAID",
                weight: Number(orderDetails.weight || 0.5) * 1000, // in grams
                length: 10,
                width: 10,
                height: 10,
                warehouse_id: String(warehouseId),
                return_reason_id: Number(orderDetails.returnReasonId || 14), // Default to 14 ("Other")
                customer_request: orderDetails.customerRequest || "REFUND",
                reason_comment: orderDetails.reasonComment || ""
            })
        });

        if (!pushResponse.ok) {
            const errText = await pushResponse.text();
            throw new Error(`Push-Return-Order failed: ${pushResponse.status} ${errText}`);
        }

        const pushData = await pushResponse.json();
        if (pushData.result !== "1") {
            throw new Error(pushData.message || "Return Push failed on Shipmozo");
        }

        // 2. Assign courier to return order
        const assignResponse = await fetch(`${SHIPMOZO_API_URL}/auto-assign-order`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                order_id: String(orderDetails.orderId)
            })
        });

        if (!assignResponse.ok) {
            const errText = await assignResponse.text();
            throw new Error(`Auto-Assign-Order failed: ${assignResponse.status} ${errText}`);
        }

        const assignData = await assignResponse.json();
        if (assignData.result === "1" && assignData.data) {
            return {
                success: true,
                courierName: assignData.data.courier_company || "Courier Service",
                trackingId: assignData.data.awb_number,
                awbNumber: assignData.data.awb_number,
                status: "return_created"
            };
        }
        throw new Error(assignData.message || "Auto-assign return courier failed");
    } catch (error) {
        console.error("Return order error:", error.message);
        throw error;
    }
}

module.exports = {
    fetchRates,
    createShipmentOrder,
    trackShipment,
    cancelShipmentOrder,
    createReturnShipmentOrder
};
