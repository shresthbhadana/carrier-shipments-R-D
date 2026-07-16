const shipmentService = require("../services/shipmentService");

const createShipment = async (req, res, next) => {
    try {
        const shipment = await shipmentService.createShipment(req.body);
        res.status(201).json({
            success: true,
            message: ["Shipment created successfully"],
            data: shipment
        });
    } catch (error) {
        next(error);
    }
};

const getShipmentById = async (req, res, next) => {
    try {
        const shipment = await shipmentService.getShipmentById(req.params.id);
        res.status(200).json({
            success: true,
            message: ["Shipment fetched successfully"],
            data: shipment
        });
    } catch (error) {
        next(error);
    }
};

const getAllShipments = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, sort = "-createdAt" } = req.query;
        const userId = req.user && req.user.role === "admin" ? null : req.user?.id;
        const result = await shipmentService.getAllShipments({
            page: parseInt(page),
            limit: parseInt(limit),
            sort,
            userId
        });
        res.status(200).json({
            success: true,
            message: ["Shipments fetched successfully"],
            data: result.data,
            pagination: result.pagination
        });
    } catch (error) {
        next(error);
    }
};

const updateShipment = async (req, res, next) => {
    try {
        const shipment = await shipmentService.updateShipment(req.params.id, req.body);
        res.status(200).json({
            success: true,
            message: ["Shipment updated successfully"],
            data: shipment
        });
    } catch (error) {
        next(error);
    }
};

const deleteShipment = async (req, res, next) => {
    try {
        await shipmentService.deleteShipment(req.params.id);
        res.status(200).json({
            success: true,
            message: ["Shipment deleted successfully"]
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
            message: ["Rates fetched successfully"],
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
            message: ["Tracking info fetched successfully"],
            data: trackingInfo.data
        });
    } catch (error) {
        next(error);
    }
};

const cancelShipment = async (req, res, next) => {
    try {
        const result = await shipmentService.cancelShipment(req.params.id);
        const msg = result && result.message ? result.message : "Shipment cancelled successfully";
        res.status(200).json({
            success: true,
            message: Array.isArray(msg) ? msg : [msg]
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
            message: ["Return initiated successfully"],
            data: returnShipment
        });
    } catch (error) {
        next(error);
    }
};

const getLabel = async (req, res, next) => {
    try {
        const labelUrl = await shipmentService.getLabel(req.params.id);
        res.status(200).json({
            success: true,
            message: ["Label fetched successfully"],
            data: { labelUrl }
        });
    } catch (error) {
        next(error);
    }
};

const schedulePickup = async (req, res, next) => {
    try {
        const result = await shipmentService.schedulePickup(req.params.id, req.body);
        res.status(200).json({
            success: true,
            message: ["Pickup scheduled successfully"],
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const getLocations = async (req, res, next) => {
    try {
        const locations = await shipmentService.getLocations({
            carrier: req.query.carrier,
            postalCode: req.query.postalCode
        });
        res.status(200).json({
            success: true,
            message: ["Locations fetched successfully"],
            data: locations
        });
    } catch (error) {
        next(error);
    }
};

const checkPickupAvailability = async (req, res, next) => {
    try {
        const result = await shipmentService.checkPickupAvailability(req.query);
        res.status(200).json({
            success: true,
            message: ["Pickup availability checked successfully"],
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const initiateShipmentPayment = async (req, res, next) => {
    try {
        const result = await shipmentService.initiateShipmentPayment(req.body);
        res.status(200).json({
            success: true,
            message: ["Payment initiated successfully"],
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const verifyShipmentPayment = async (req, res, next) => {
    try {
        const result = await shipmentService.verifyShipmentPayment(req.body);
        res.status(200).json({
            success: true,
            message: ["Payment verified and shipment booked successfully"],
            data: result
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
    initiateShipmentPayment,
    verifyShipmentPayment,
    trackShipment,
    cancelShipment,
    initiateReturn,
    getLabel,
    schedulePickup,
    getLocations,
    checkPickupAvailability
};