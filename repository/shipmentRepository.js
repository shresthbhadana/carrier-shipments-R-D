const Shipment = require("../models/shipmentModel");
const ProductOrder = require("../models/productOrderModel");

const createShipment = async (payload) => {
    return Shipment.create(payload);
};

const findById = async (shipmentId) => {
    return Shipment.findById(shipmentId).populate("orderId");
};

const updateShipment = async (shipmentId, data) => {
    return Shipment.findByIdAndUpdate(
        shipmentId,
        data,
        { new: true, runValidators: true }
    );
};

const findAllShipments = async (options = {}) => {
    const { page = 1, limit = 10, sort = "-createdAt", userId } = options;
    const skip = (page - 1) * limit;

    let dbQuery = {};
    if (userId) {
        const orders = await ProductOrder.find({ userId }).select("_id");
        const orderIds = orders.map(order => order._id);
        dbQuery = { orderId: { $in: orderIds } };
    }

    const [data, total] = await Promise.all([
        Shipment.find(dbQuery)
            .populate("orderId")
            .sort(sort)
            .skip(Number(skip))
            .limit(Number(limit)),
        Shipment.countDocuments(dbQuery)
    ]);

    return {
        data,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
        }
    };
};

const deleteShipment = async (shipmentId) => {
    return Shipment.findByIdAndDelete(shipmentId);
};

module.exports = {
    createShipment,
    findById,
    updateShipment,
    findAllShipments,
    deleteShipment
};
