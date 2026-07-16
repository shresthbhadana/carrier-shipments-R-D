const Shipment = require("../models/shipmentModel");
const productOrderRepository = require("../repository/productOrderRepository");
const { getCarrierService } = require("../services/carrierFactory");

const startBookingScheduler = () => {
    setInterval(async () => {
        try {
            const failedShipments = await Shipment.find({
                status: "pending_booking",
                paymentStatus: "paid"
            });

            for (const shipment of failedShipments) {
                try {
                    const carrierService = getCarrierService(shipment.courierName);
                    const bookingResult = await carrierService.createShipmentOrder({
                        orderId: shipment.orderId,
                        customerName: shipment.customerName || "Customer",
                        customerPhone: shipment.customerPhone || "9876543210",
                        deliveryPincode: shipment.deliveryPincode,
                        weight: shipment.weight || 0.5,
                        packages: shipment.packages,
                        courierName: shipment.courierName
                    });

                    if (bookingResult.trackingId) {
                        shipment.trackingId = bookingResult.trackingId;
                        shipment.awbNumber = bookingResult.awbNumber;
                        shipment.status = bookingResult.status;
                        await shipment.save();

                        await productOrderRepository.updateOrder(shipment.orderId, {
                            shipmentId: shipment._id,
                            orderStatus: bookingResult.status === "created" ? "processing" : "pending"
                        });
                    }
                } catch (err) {
                    console.error("Booking retry failed for shipment ID:", shipment._id, err.message);
                }
            }
        } catch (error) {
            console.error("Scheduler failed:", error.message);
        }
    }, 300000);
};

module.exports = {
    startBookingScheduler
};
