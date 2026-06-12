const productOrderRepository = require("../repository/productOrderRepository");
const shipmentRepository = require("../repository/shipmentRepository");
const canadaPostService = require("./canadaPostService");

const createProductOrder = async (payload) => {
    if (!payload.userId) {
        throw new Error("User Id is required");
    }

    if (!payload.products || !Array.isArray(payload.products)) {
        throw new Error("Products array is required");
    }

    if (payload.products.length === 0) {
        throw new Error("At least one product is required");
    }

    if (!payload.pickupPincode || !payload.deliveryPincode) {
        throw new Error("Pickup and Delivery pincodes are required");
    }

    if (!payload.customerName || !payload.customerPhone) {
        throw new Error("Customer name and phone number are required");
    }

    // 1. Calculate subtotal
    const subtotal = payload.products.reduce((acc, item) => {
        return acc + (item.price * item.quantity);
    }, 0);

    // 2. Fetch shipping rate from Shipmozo
    const rates = await canadaPostService.fetchRates({
        pickupPincode: payload.pickupPincode,
        deliveryPincode: payload.deliveryPincode,
        weight: payload.weight || 0.5,
        cod: false
    });

    if (!rates || rates.length === 0) {
        throw new Error("No courier services available for the selected pin codes");
    }

    // Select chosen courier or the cheapest one
    let selectedCourier = rates[0];
    if (payload.courierName) {
        const found = rates.find(r => r.courierName.toLowerCase() === payload.courierName.toLowerCase());
        if (found) {
            selectedCourier = found;
        }
    }

    const shippingPrice = selectedCourier.shippingPrice;
    const courierName = selectedCourier.courierName;

    // 3. Calculate final total amount
    const totalAmount = subtotal + shippingPrice;

    // 4. Save Product Order in DB
    const orderData = {
        userId: payload.userId,
        products: payload.products,
        subtotal,
        shippingPrice,
        totalAmount,
        orderStatus: "pending"
    };
    
    const order = await productOrderRepository.createProductOrder(orderData);

    // 5. Create Shipment in Shipmozo
    let shipmentResult;
    try {
        shipmentResult = await canadaPostService.createShipmentOrder({
            orderId: order._id,
            customerName: payload.customerName,
            customerPhone: payload.customerPhone,
            deliveryPincode: payload.deliveryPincode,
            weight: payload.weight || 0.5,
            courierName: courierName
        });
    } catch (shipmentError) {
        console.error("Failed to book shipment on Canada Post:", shipmentError.message);
        // We will fallback to a default created state to avoid breaking checkout,
        // but mark the error details.
        shipmentResult = {
            success: false,
            courierName,
            trackingId: null,
            awbNumber: null,
            status: "pending_booking"
        };
    }

    // 6. Save Shipment in DB
    const shipment = await shipmentRepository.createShipment({
        orderId: order._id,
        courierName: shipmentResult.courierName,
        trackingId: shipmentResult.trackingId,
        awbNumber: shipmentResult.awbNumber,
        shippingPrice: shippingPrice,
        status: shipmentResult.status
    });

    // 7. Update order with shipment reference
    await productOrderRepository.updateOrder(order._id, {
        shipmentId: shipment._id,
        orderStatus: shipmentResult.trackingId ? "processing" : "pending"
    });

    // Fetch the final updated order populated with user (matching previous repo findById populate behaviour)
    const finalOrder = await productOrderRepository.findById(order._id);
    return finalOrder;
};

const getOrderById = async (orderId) => {

    if (!orderId) {
        throw new Error("Order Id is required");
    }

    const order = await productOrderRepository.findById(orderId);

    if (!order) {
        throw new Error("Order not found");
    }

    return order;
};

const getAllOrders = async () => {
    return productOrderRepository.findAllProduct();
};

const updateOrder = async (orderId, data) => {

    if (!orderId) {
        throw new Error("Order Id is required");
    }

    const order = await productOrderRepository.findById(orderId);

    if (!order) {
        throw new Error("Order not found");
    }

    return productOrderRepository.updateOrder(orderId, data);
};

const deleteProductOrder = async (orderId) => {

    if (!orderId) {
        throw new Error("Order Id is required");
    }

    const order = await productOrderRepository.findById(orderId);

    if (!order) {
        throw new Error("Order not found");
    }

    return productOrderRepository.deleteProductOrder(orderId);
};

module.exports = {
    createProductOrder,
    getOrderById,
    getAllOrders,
    updateOrder,
    deleteProductOrder
};