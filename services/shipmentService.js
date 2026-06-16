const mongoose = require("mongoose");
const shipmentRepository = require("../repository/shipmentRepository");
const canadaPostService = require("./canadaPostService");
const shipmozoService = require("./shipmozoService");
const fedexService = require("./fedexService");
const fs = require("fs");
const path = require("path");

const createShipment = async (payload) => {
    if (!payload.orderId) {
        throw new Error("Order Id is required");
    }

    if (!mongoose.Types.ObjectId.isValid(payload.orderId)) {
        throw new Error("Invalid Order Id");
    }

    if (!payload.courierName) {
        throw new Error("Courier name is required");
    }

    return shipmentRepository.createShipment(payload);
};

const getShipmentById = async (shipmentId) => {
    if (!shipmentId) {
        throw new Error("Shipment Id is required");
    }

    if (!mongoose.Types.ObjectId.isValid(shipmentId)) {
        throw new Error("Invalid Shipment Id");
    }

    const shipment = await shipmentRepository.findById(shipmentId);

    if (!shipment) {
        throw new Error("Shipment not found");
    }

    return shipment;
};

const getAllShipments = async () => {
    return shipmentRepository.findAllShipments();
};

const updateShipment = async (shipmentId, data) => {
    if (!shipmentId) {
        throw new Error("Shipment Id is required");
    }

    if (!mongoose.Types.ObjectId.isValid(shipmentId)) {
        throw new Error("Invalid Shipment Id");
    }

    const shipment = await shipmentRepository.findById(shipmentId);

    if (!shipment) {
        throw new Error("Shipment not found");
    }

    return shipmentRepository.updateShipment(
        shipmentId,
        data
    );
};

const deleteShipment = async (shipmentId) => {
    if (!shipmentId) {
        throw new Error("Shipment Id is required");
    }

    if (!mongoose.Types.ObjectId.isValid(shipmentId)) {
        throw new Error("Invalid Shipment Id");
    }

    const shipment = await shipmentRepository.findById(shipmentId);

    if (!shipment) {
        throw new Error("Shipment not found");
    }

    return shipmentRepository.deleteShipment(shipmentId);
};

const getRates = async (payload) => {
    let shipmozoRates = [];
    let canadaPostRates = [];
    let fedexRates = [];

    try {
        shipmozoRates = await shipmozoService.fetchRates({
            pickupPincode: payload.pickupPincode,
            deliveryPincode: payload.deliveryPincode,
            weight: payload.weight,
            cod: payload.cod
        });
    } catch (error) {
        console.error("Shipmozo fetch rates error:", error.message);
    }

    try {
        canadaPostRates = await canadaPostService.fetchRates({
            pickupPincode: payload.pickupPincode,
            deliveryPincode: payload.deliveryPincode,
            weight: payload.weight,
            cod: payload.cod
        });
    } catch (error) {
        console.error("Canada Post fetch rates error:", error.message);
    }

    try {
        fedexRates = await fedexService.fetchRates({
            pickupPincode: payload.pickupPincode,
            deliveryPincode: payload.deliveryPincode,
            weight: payload.weight,
            cod: payload.cod
        });
    } catch (error) {
        console.error("FedEx fetch rates error:", error.message);
    }

    return [...shipmozoRates, ...canadaPostRates, ...fedexRates];
};

const trackShipment = async (shipmentId) => {
    if (!shipmentId) {
        throw new Error("Shipment Id is required");
    }

    if (!mongoose.Types.ObjectId.isValid(shipmentId)) {
        throw new Error("Invalid Shipment Id");
    }

    const shipment = await shipmentRepository.findById(shipmentId);

    if (!shipment) {
        throw new Error("Shipment not found");
    }

    if (!shipment.awbNumber) {
        throw new Error("Tracking ID / AWB is not available for this shipment yet");
    }

    return fedexService.trackShipment(shipment.awbNumber);
};

const cancelShipment = async (shipmentId) => {
    if (!shipmentId) throw new Error("Shipment Id is required");
    if (!mongoose.Types.ObjectId.isValid(shipmentId)) throw new Error("Invalid Shipment Id");

    const shipment = await shipmentRepository.findById(shipmentId);
    if (!shipment) throw new Error("Shipment not found");

    if (!shipment.awbNumber) {
        throw new Error("No AWB code linked. Cannot cancel un-booked shipment.");
    }

    await fedexService.cancelShipmentOrder(shipment.orderId._id || shipment.orderId, shipment.awbNumber);

    await shipmentRepository.updateShipment(shipmentId, { status: "cancelled" });

    const productOrderRepository = require("../repository/productOrderRepository");
    await productOrderRepository.updateOrder(shipment.orderId._id || shipment.orderId, { orderStatus: "cancelled" });

    return { success: true, message: "Order and shipment cancelled successfully" };
};

const initiateReturn = async (shipmentId, returnData) => {
    if (!shipmentId) throw new Error("Shipment Id is required");
    if (!mongoose.Types.ObjectId.isValid(shipmentId)) throw new Error("Invalid Shipment Id");

    const shipment = await shipmentRepository.findById(shipmentId);
    if (!shipment) throw new Error("Shipment not found");

    const returnShipmentResult = await fedexService.createReturnShipmentOrder({
        orderId: shipment.orderId._id || shipment.orderId,
        customerName: returnData.customerName || "Customer",
        customerPhone: returnData.customerPhone || "9876543210",
        pickupAddress: returnData.pickupAddress,
        pickupPincode: returnData.pickupPincode,
        pickupCity: returnData.pickupCity,
        pickupState: returnData.pickupState,
        weight: returnData.weight || 0.5,
        returnReasonId: returnData.returnReasonId,
        customerRequest: returnData.customerRequest,
        reasonComment: returnData.reasonComment
    });

    const returnShipment = await shipmentRepository.createShipment({
        orderId: shipment.orderId._id || shipment.orderId,
        courierName: returnShipmentResult.courierName,
        trackingId: returnShipmentResult.trackingId,
        awbNumber: returnShipmentResult.awbNumber,
        shippingPrice: shipment.shippingPrice,
        status: returnShipmentResult.status
    });

    const productOrderRepository = require("../repository/productOrderRepository");
    await productOrderRepository.updateOrder(shipment.orderId._id || shipment.orderId, {
        orderStatus: "returned"
    });

    return returnShipment;
};

const getLabel = async (shipmentId) => {
    const shipment = await shipmentRepository.findById(shipmentId);

    if (!shipment) throw new Error("Shipment not found");
    if (!shipment.awbNumber) throw new Error("AWB not found");

    const dir = path.join(__dirname, "../labels");
    const filename = `${shipment.awbNumber}.pdf`;
    const filePath = path.join(dir, filename);
    const labelUrl = `/labels/${filename}`;

   
    if (fs.existsSync(filePath)) {
        if (!shipment.labelUrl) {
            await shipmentRepository.updateShipment(shipmentId, { labelUrl });
        }
        return labelUrl;
    }

    const labelBuffer = await fedexService.getLabel(shipment.awbNumber);
    if (!labelBuffer) throw new Error("Failed to fetch label from FedEx");

    if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
    }

   
    await fs.promises.writeFile(filePath, labelBuffer);

   
    await shipmentRepository.updateShipment(shipmentId, { labelUrl });

    return labelUrl;
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
    initiateReturn,
    getLabel
};
