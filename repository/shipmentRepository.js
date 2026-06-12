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

const findAllShipments = async () => {
    return Shipment.find();
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
