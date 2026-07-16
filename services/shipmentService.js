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
const upsService = require("./upsService");
const glsService = require("./glsService");
const { getRedisKey, setRedisKey, delRedisKey } = require("../config/redis");
const crypto = require("crypto");

let cachedPlatformFee = null;
let feeCacheTime = 0;

const getPlatformFee = async () => {
    const cachedFee = await getRedisKey("setting:platform_fee");
    if (cachedFee !== null) {
        return Number(cachedFee);
    }
    if (cachedPlatformFee !== null && Date.now() - feeCacheTime < 60000) {
        return cachedPlatformFee;
    }
    try {
        const Setting = require("../models/settingModel");
        const platformFeeSetting = await Setting.findOne({ key: "platform_fee" });
        const val = platformFeeSetting ? Number(platformFeeSetting.value) : 10;
        await setRedisKey("setting:platform_fee", val.toString(), 60);
        cachedPlatformFee = val;
        feeCacheTime = Date.now();
        return val;
    } catch (err) {
        return cachedPlatformFee !== null ? cachedPlatformFee : 10;
    }
};

const invalidatePlatformFeeCache = async () => {
    cachedPlatformFee = null;
    feeCacheTime = 0;
    await delRedisKey("setting:platform_fee");
};

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
    const cachedKeyString = `${payload.pickupPincode}:${payload.deliveryPincode}:${payload.weight}:${payload.cod}:${JSON.stringify(payload.packages || [])}`;
    const cacheHash = crypto.createHash("sha256").update(cachedKeyString).digest("hex");
    const redisKey =  `rates:cache:${cacheHash}`;
       const cachedData = await getRedisKey(redisKey);
    if (cachedData) {
        return JSON.parse(cachedData);
    }
    const results = await Promise.allSettled([
        shipmozoService.fetchRates({
            pickupPincode: payload.pickupPincode,
            deliveryPincode: payload.deliveryPincode,
            weight: payload.weight,
            cod: payload.cod,
            packages: payload.packages
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
            cod: payload.cod,
            pickupAddress: payload.pickupAddress,
            pickupCity: payload.pickupCity,
            pickupState: payload.pickupState,
            deliveryAddress: payload.deliveryAddress,
            deliveryCity: payload.deliveryCity,
            deliveryState: payload.deliveryState,
            packages: payload.packages
        }),
        purolatorService.fetchRates({
            pickupPincode: payload.pickupPincode,
            deliveryPincode: payload.deliveryPincode,
            weight: payload.weight,
            cod: payload.cod,
            pickupAddress: payload.pickupAddress,
            pickupCity: payload.pickupCity,
            pickupState: payload.pickupState,
            deliveryAddress: payload.deliveryAddress,
            deliveryCity: payload.deliveryCity,
            deliveryState: payload.deliveryState,
            packages: payload.packages
        }),
        upsService.fetchRates({
            pickupPincode : payload.pickupPincode,
            deliveryPincode: payload.deliveryPincode,
            weight : payload.weight,
            cod : payload.cod,
            pickupAddress: payload.pickupAddress,
            pickupCity: payload.pickupCity,
            pickupState: payload.pickupState,
            deliveryAddress: payload.deliveryAddress,
            deliveryCity: payload.deliveryCity,
            deliveryState: payload.deliveryState,
            packages: payload.packages
        }),
        glsService.fetchRates({
            pickupPincode: payload.pickupPincode,
            deliveryPincode: payload.deliveryPincode,
            weight: payload.weight,
            cod: payload.cod,
            pickupAddress: payload.pickupAddress,
            pickupCity: payload.pickupCity,
            pickupState: payload.pickupState,
            deliveryAddress: payload.deliveryAddress,
            deliveryCity: payload.deliveryCity,
            deliveryState: payload.deliveryState,
            packages: payload.packages
        })
    ]);

    const shipmozoRates = results[0].status === "fulfilled" ? results[0].value : [];
    const canadaPostRates = results[1].status === "fulfilled" ? results[1].value : [];
    const fedexRates = results[2].status === "fulfilled" ? results[2].value : [];
    const purolatorRates = results[3].status === "fulfilled" ? results[3].value : [];
    const upsRates = results[4].status === "fulfilled" ? results[4].value : [];
    const glsRates = results[5].status === "fulfilled" ? results[5].value : [];

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
    if (results[4].status === "rejected") {
        console.error("UPS fetch rates error:", results[4].reason.message);
    }
    if (results[5].status === "rejected") {
        console.error("GLS fetch rates error:", results[5].reason.message);
    }

    const platformFee = await getPlatformFee();
    const taxRate = parseFloat(process.env.TAX_RATE || "0.18");

    const allRates = [
        ...shipmozoRates,
        ...canadaPostRates,
        ...fedexRates,
        ...purolatorRates,
        ...upsRates,
        ...glsRates
    ];

    const finalRates = allRates.map(rate => {
        const basePrice = Number(rate.shippingPrice) || 0;
        const gstAmount = Number(((basePrice + platformFee) * taxRate).toFixed(2));
        const finalPrice = Number((basePrice + platformFee + gstAmount).toFixed(2));
        return {
            ...rate,
            baseShippingPrice: basePrice,
            platformFee: platformFee,
            gstAmount: gstAmount,
            shippingPrice: finalPrice
        };
    });
await setRedisKey(redisKey, JSON.stringify(finalRates), 1800);
    return finalRates;
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
const checkPickupAvailability = async (options) => {
    const { carrier, pickupPincode, pickupDate } = options;
    if (!pickupPincode) {
        throw new Error("pickup pincode is required");
    }
    const carrierService = getCarrierService(carrier);
    
    if (!carrierService.checkPickupAvailability || typeof carrierService.checkPickupAvailability !== "function") {
        throw new Error(`Carrier ${carrier || "default"} does not support pickup availability check`);
    }
    return carrierService.checkPickupAvailability({ pickupPincode, pickupDate });
};
const initiateShipmentPayment = async (payload) => {
    const {
        orderId,
        courierName,
        customerName,
        customerPhone,
        pickupPincode,
        deliveryPincode,
        weight,
        pickupAddress,
        pickupCity,
        pickupState,
        deliveryAddress,
        deliveryCity,
        deliveryState,
        packages
    } = payload;

    const order = await productOrderRepository.findById(orderId);
    if (!order) {
        throw new Error("Order not found");
    }

    const carrierService = getCarrierService(courierName);
    const rates = await carrierService.fetchRates({
        pickupPincode,
        deliveryPincode,
        weight,
        pickupAddress,
        pickupCity,
        pickupState,
        deliveryAddress,
        deliveryCity,
        deliveryState,
        packages
    });

    const platformFee = await getPlatformFee();
    const taxRate = parseFloat(process.env.TAX_RATE || "0.18");

    const finalRates = rates.map(rate => {
        const basePrice = Number(rate.shippingPrice) || 0;
        const gstAmount = Number(((basePrice + platformFee) * taxRate).toFixed(2));
        const finalPrice = Number((basePrice + platformFee + gstAmount).toFixed(2));
        return {
            ...rate,
            baseShippingPrice: basePrice,
            platformFee,
            gstAmount,
            shippingPrice: finalPrice
        };
    });

    const selectedRate = finalRates.find(
        r => r.courierName.toLowerCase() === courierName.toLowerCase()
    );
    if (!selectedRate) {
        throw new Error(`Courier service '${courierName}' is not available for this route`);
    }

    const baseShippingPrice = selectedRate.baseShippingPrice;
    const gstAmount = selectedRate.gstAmount;
    const finalShippingPrice = selectedRate.shippingPrice;

    const razorpay = require("../config/razorpay");
    const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(finalShippingPrice * 100),
        currency: "INR",
        receipt: `receipt_shipment_${orderId}_${Date.now()}`
    });

    const Shipment = require("../models/shipmentModel");
    let shipment = await Shipment.findOne({ orderId, status: "pending" });

    const shipmentData = {
        orderId,
        courierName: selectedRate.courierName,
        baseShippingPrice,
        platformFee,
        gstAmount,
        shippingPrice: finalShippingPrice,
        status: "pending",
        paymentStatus: "pending",
        razorpayOrderId: razorpayOrder.id,
        customerName,
        customerPhone,
        pickupPincode,
        deliveryPincode,
        weight,
        packages
    };

    if (shipment) {
        shipment = await Shipment.findByIdAndUpdate(shipment._id, shipmentData, { new: true });
    } else {
        shipment = await Shipment.create(shipmentData);
    }

    return {
        razorpayOrder,
        shipment
    };
};

const verifyShipmentPayment = async (payload) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = payload;

    const crypto = require("crypto");
    const isProduction = process.env.NODE_ENV === "production";
    const secret = isProduction
        ? (process.env.RAZORPAY_LIVE_SECRET || process.env.RAZORPAY_KEY_SECRET)
        : process.env.RAZORPAY_TEST_SECRET;

    if (!secret) {
        throw new Error("Razorpay secret is not configured");
    }

    const hmacPayload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
        .createHmac("sha256", secret)
        .update(hmacPayload)
        .digest("hex");

    if (generated_signature !== razorpay_signature) {
        throw new Error("Payment signature verification failed");
    }

    const Shipment = require("../models/shipmentModel");
    const shipment = await Shipment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!shipment) {
        throw new Error("Shipment order not found for this transaction");
    }

    shipment.paymentStatus = "paid";
    shipment.razorpayPaymentId = razorpay_payment_id;
    shipment.razorpaySignature = razorpay_signature;
    await shipment.save();

    const carrierService = getCarrierService(shipment.courierName);
    let bookingResult;
    try {
        bookingResult = await carrierService.createShipmentOrder({
            orderId: shipment.orderId,
            customerName: shipment.customerName || "Customer",
            customerPhone: shipment.customerPhone || "9876543210",
            deliveryPincode: shipment.deliveryPincode,
            weight: shipment.weight || 0.5,
            packages: shipment.packages,
            courierName: shipment.courierName
        });
    } catch (bookingError) {
        console.error(`Post-payment shipment booking failed: ${bookingError.message}`);
        bookingResult = {
            trackingId: null,
            awbNumber: null,
            status: "pending_booking"
        };
    }

    shipment.trackingId = bookingResult.trackingId;
    shipment.awbNumber = bookingResult.awbNumber;
    shipment.status = bookingResult.status;
    await shipment.save();

    const isBookingFailed = !bookingResult.trackingId;
    await productOrderRepository.updateOrder(shipment.orderId, {
        shipmentId: shipment._id,
        orderStatus: isBookingFailed ? "pending_booking" : (bookingResult.status === "created" ? "processing" : "pending")
    });

    return shipment;
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
    checkPickupAvailability,
    invalidatePlatformFeeCache
};
