const Shipment = require("../models/shipmentModel");

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
    const { page = 1, limit = 10, sort = "-createdAt" } = options;
    const skip = (page - 1) * limit;

    const query = Shipment.find().populate("orderId");

    const [data, total] = await Promise.all([
        query.sort(sort).skip(Number(skip)).limit(Number(limit)),
        Shipment.countDocuments()
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
