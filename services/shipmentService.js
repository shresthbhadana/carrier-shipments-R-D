const mongoose = require("mongoose");
const shipmentRepository = require("../repository/shipmentRepository");
const productOrderRepository = require("../repository/productOrderRepository");
const fs = require("fs");
const path = require("path");
const { getCarrierService } = require("./carrierFactory");
const fedexService = require("./fedexService");
const canadaPostService = require("./canadaPostService");
const shipmozoService = require("./shipmozoService");
const purolatorService = require("./purolatorService");
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

    if (!payload.trackingId || !payload.awbNumber) {
        const carrierService = getCarrierService(payload.courierName);
        const bookingResult = await carrierService.createShipmentOrder({
            orderId: payload.orderId,
            customerName: payload.customerName || "Customer",
            customerPhone: payload.customerPhone || "9876543210",
            deliveryPincode: payload.deliveryPincode,
            weight: payload.weight || 0.5,
            courierName: payload.courierName
        });

        payload.trackingId = bookingResult.trackingId;
        payload.awbNumber = bookingResult.awbNumber;
        payload.status = bookingResult.status;
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

const getAllShipments = async (options) => {
    return shipmentRepository.findAllShipments(options);
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
    const results = await Promise.allSettled([
        shipmozoService.fetchRates({
            pickupPincode: payload.pickupPincode,
            deliveryPincode: payload.deliveryPincode,
            weight: payload.weight,
            cod: payload.cod
        }),
        canadaPostService.fetchRates({
            pickupPincode: payload.pickupPincode,
            deliveryPincode: payload.deliveryPincode,
            weight: payload.weight,
            cod: payload.cod
        }),
        fedexService.fetchRates({
            pickupPincode: payload.pickupPincode,
            deliveryPincode: payload.deliveryPincode,
            weight: payload.weight,
            cod: payload.cod
        }),
        purolatorService.fetchRates({
            pickupPincode: payload.pickupPincode,
            deliveryPincode: payload.deliveryPincode,
            weight: payload.weight,
            cod: payload.cod
        })
    ]);

    const shipmozoRates = results[0].status === "fulfilled" ? results[0].value : [];
    const canadaPostRates = results[1].status === "fulfilled" ? results[1].value : [];
    const fedexRates = results[2].status === "fulfilled" ? results[2].value : [];
    const purolatorRates = results[3].status === "fulfilled" ? results[3].value : [];

    if (results[0].status === "rejected") {
        console.error("Shipmozo fetch rates error:", results[0].reason.message);
    }
    if (results[1].status === "rejected") {
        console.error("Canada Post fetch rates error:", results[1].reason.message);
    }
    if (results[2].status === "rejected") {
        console.error("FedEx fetch rates error:", results[2].reason.message);
    }
    if (results[3].status === "rejected") {
        console.error("Purolator fetch rates error:", results[3].reason.message);
    }

    return [...shipmozoRates, ...canadaPostRates, ...fedexRates, ...purolatorRates];
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
     const carrierService = getCarrierService(shipment.courierName);
    return carrierService.trackShipment(shipment.awbNumber);
};

const cancelShipment = async (shipmentId) => {
    if (!shipmentId) throw new Error("Shipment Id is required");
    if (!mongoose.Types.ObjectId.isValid(shipmentId)) throw new Error("Invalid Shipment Id");

    const shipment = await shipmentRepository.findById(shipmentId);
    if (!shipment) throw new Error("Shipment not found");

    if (!shipment.awbNumber) {
        throw new Error("No AWB code linked. Cannot cancel un-booked shipment.");
    }

    const carrierService = getCarrierService(shipment.courierName);
    await carrierService.cancelShipmentOrder(shipment.orderId._id || shipment.orderId, shipment.awbNumber);

    await shipmentRepository.updateShipment(shipmentId, { status: "cancelled" });

    await productOrderRepository.updateOrder(shipment.orderId._id || shipment.orderId, { orderStatus: "cancelled" });

    return { success: true, message: "Order and shipment cancelled successfully" };
};

const initiateReturn = async (shipmentId, returnData) => {
    if (!shipmentId) throw new Error("Shipment Id is required");
    if (!mongoose.Types.ObjectId.isValid(shipmentId)) throw new Error("Invalid Shipment Id");

    const shipment = await shipmentRepository.findById(shipmentId);
    if (!shipment) throw new Error("Shipment not found");
      const carrierService = getCarrierService(shipment.courierName);

    const returnShipmentResult = await carrierService.createReturnShipmentOrder({
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

    await productOrderRepository.updateOrder(shipment.orderId._id || shipment.orderId, {
        orderStatus: "returned"
    });

    return returnShipment;
};

const getLabel = async (shipmentId) => {
    const shipment = await shipmentRepository.findById(shipmentId);

    if (!shipment) throw new Error("Shipment not found");
    if (!shipment.awbNumber) throw new Error("AWB not found");
       const carrierService = getCarrierService(shipment.courierName);

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

    const labelBuffer = await carrierService.getLabel(shipment.awbNumber);
    if (!labelBuffer) throw new Error(`Failed to fetch label for ${shipment.courierName }`);

    if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
    }

   
    await fs.promises.writeFile(filePath, labelBuffer);

   
    await shipmentRepository.updateShipment(shipmentId, { labelUrl });

    return labelUrl;
};

const schedulePickup = async (shipmentId, pickupData) => {
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

    const carrierService = getCarrierService(shipment.courierName);
    const pickupFn = carrierService.schedulePickup || carrierService.getpickup;
    if (!pickupFn || typeof pickupFn !== "function") {
        throw new Error(`Carrier ${shipment.courierName || "unknown"} does not support pickup scheduling`);
    }

    const result = await pickupFn(pickupData);

    // Save pickup confirmation number if returned
    if (result && result.pickupConfirmationNumber) {
        await shipmentRepository.updateShipment(shipmentId, {
            pickupConfirmationNumber: result.pickupConfirmationNumber
        });
    }

    return result;
};

const getLocations = async (options = {}) => {
    const { carrier, postalCode } = options;
    if (!postalCode) {
        throw new Error("Postal code is required");
    }
    const carrierService = getCarrierService(carrier);
    if (!carrierService.getLocations || typeof carrierService.getLocations !== "function") {
        throw new Error(`Carrier ${carrier || "default"} does not support location lookup`);
    }
    return carrierService.getLocations(postalCode);
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
    getLabel,
    schedulePickup,
    getLocations
};
