const productOrderRepository = require("../repository/productOrderRepository");
const shipmentRepository = require("../repository/shipmentRepository");
const fedexService = require("./fedexService");
const canadaPostService = require("./canadaPostService");
const shipmozoService = require("./shipmozoService");
const mongoose = require("mongoose");
const Product = require("../models/productInfoModel");

const getCarrierService = (courierName) => {
    if (!courierName) return fedexService;
    const name = courierName.toLowerCase().trim();
    if (name.includes("fedex")) return fedexService;
    if (name.includes("canada") || name.includes("postal")) return canadaPostService;
    if (name.includes("delhivery") || name.includes("bluedart") || name.includes("shipmozo")) return shipmozoService;
    return fedexService;
};

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

    // Retrieve correct prices from the database for each product
    const productIds = payload.products.map(p => p.productId);
    const dbProducts = await Product.find({ _id: { $in: productIds } });

    // Create a lookup map for product prices
    const productMap = {};
    dbProducts.forEach(p => {
        productMap[p._id.toString()] = p.price;
    });

    // Construct the products array with server-resolved prices
    const resolvedProducts = payload.products.map(p => {
        const price = productMap[p.productId.toString()];
        if (price === undefined) {
            throw new Error(`Product with ID ${p.productId} not found`);
        }
        return {
            productId: p.productId,
            quantity: p.quantity,
            price: price
        };
    });

    const subtotal = resolvedProducts.reduce((acc, item) => {
        return acc + (item.price * item.quantity);
    }, 0);

    const carrierService = getCarrierService(payload.courierName);
    const rates = await carrierService.fetchRates({
        pickupPincode: payload.pickupPincode,
        deliveryPincode: payload.deliveryPincode,
        weight: payload.weight || 0.5,
        cod: false
    });

    if (!rates || rates.length === 0) {
        throw new Error("No courier services available for the selected pin codes");
    }

    let selectedCourier = rates[0];
    if (payload.courierName) {
        const found = rates.find(r => r.courierName.toLowerCase() === payload.courierName.toLowerCase());
        if (found) {
            selectedCourier = found;
        }
    }

    const shippingPrice = selectedCourier.shippingPrice;
    const courierName = selectedCourier.courierName;
    const totalAmount = subtotal + shippingPrice;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const orderData = {
            userId: payload.userId,
            products: resolvedProducts,
            subtotal,
            shippingPrice,
            totalAmount,
            orderStatus: "pending"
        };
        
        const ProductOrder = require("../models/productOrderModel");
        const Shipment = require("../models/shipmentModel");
        
        const orders = await ProductOrder.create([orderData], { session });
        const order = orders[0];
        
        let shipmentResult;
        try {
            shipmentResult = await carrierService.createShipmentOrder({
                orderId: order._id,
                customerName: payload.customerName,
                customerPhone: payload.customerPhone,
                deliveryPincode: payload.deliveryPincode,
                weight: payload.weight || 0.5,
                courierName: courierName
            });
        } catch (bookingError) {
            throw new Error(`Carrier Booking failed: ${bookingError.message}`);
        }
        
        const shipments = await Shipment.create([{
            orderId: order._id,
            courierName: shipmentResult.courierName,
            trackingId: shipmentResult.trackingId,
            awbNumber: shipmentResult.awbNumber,
            shippingPrice: shippingPrice,
            status: shipmentResult.status
        }], { session });
        const shipment = shipments[0];
        
        await ProductOrder.findByIdAndUpdate(
            order._id, 
            {
                shipmentId: shipment._id,
                orderStatus: shipmentResult.trackingId ? "processing" : "pending"
            }, 
            { session, new: true }
        );
        
        await session.commitTransaction();
        session.endSession();
        return await productOrderRepository.findById(order._id);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

const getOrderById = async (orderId) => {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        throw new Error("Invalid Order ID");
    }

    const order = await productOrderRepository.findById(orderId);

    if (!order) {
        throw new Error("Order not found");
    }

    return order;
};

const getAllOrders = async (options) => {
    return productOrderRepository.findAllProduct(options);
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