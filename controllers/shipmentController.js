const shipmentService = require("../services/shipmentService");

const createShipment = async (req, res, next) => {
    try {
        const shipment =
            await shipmentService.createShipment(
                req.body
            );

        res.status(201).json({
            success: true,
            data: shipment
        });
    } catch (error) {
        next(error);
    }
};

const getShipmentById = async (req, res, next) => {
    try {
        const shipment =
            await shipmentService.getShipmentById(
                req.params.id
            );

        res.status(200).json({
            success: true,
            data: shipment
        });
    } catch (error) {
        next(error);
    }
};

const getAllShipments = async (req, res, next) => {
    try {
        const shipments =
            await shipmentService.getAllShipments();

        res.status(200).json({
            success: true,
            data: shipments
        });
    } catch (error) {
        next(error);
    }
};

const updateShipment = async (req, res, next) => {
    try {
        const shipment =
            await shipmentService.updateShipment(
                req.params.id,
                req.body
            );

        res.status(200).json({
            success: true,
            data: shipment
        });
    } catch (error) {
        next(error);
    }
};

const deleteShipment = async (req, res, next) => {
    try {
        await shipmentService.deleteShipment(
            req.params.id
        );

        res.status(200).json({
            success: true,
            message: "Shipment deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};

const getRates = async (req, res, next) => {
    try {
        const rates = await shipmentService.getRates(req.body);
        res.status(200).json({
            success: true,
            data: rates
        });
    } catch (error) {
        next(error);
    }
};

const trackShipment = async (req, res, next) => {
    try {
        const trackingInfo = await shipmentService.trackShipment(req.params.id);
        res.status(200).json({
            success: true,
            data: trackingInfo.data
        });
    } catch (error) {
        next(error);
    }
};

const cancelShipment = async (req, res, next) => {
    try {
        const result = await shipmentService.cancelShipment(req.params.id);
        res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};

const initiateReturn = async (req, res, next) => {
    try {
        const returnShipment = await shipmentService.initiateReturn(req.params.id, req.body);
        res.status(200).json({
            success: true,
            data: returnShipment
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createShipment,
    getShipmentById,
    getAllShipments,
    updateShipment,
    deleteShipment,
    getRates,
    trackShipment,
    cancelShipment,
    initiateReturn
};