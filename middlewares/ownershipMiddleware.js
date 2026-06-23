const ProductOrder = require("../models/productOrderModel"); 
const Shipment = require("../models/shipmentModel");

const verifyOrderOwnership = async (req, res, next) => {
    try {
        const order = await ProductOrder.findById(req.params.id);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: ["Order not found"]
            });
        }
        
        
        if (order.userId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: ["Unauthorized: You do not own this order"]
            });
        }
        
        req.order = order; 
        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            message: ["Server error during order ownership check"]
        });
    }
};

const verifyShipmentOwnership = async (req, res, next) => {
    try {
     
        const shipment = await Shipment.findById(req.params.id).populate("orderId");
        if (!shipment) {
            return res.status(404).json({
                success: false,
                message: ["Shipment not found"]
            });
        }
      
        if (!shipment.orderId || shipment.orderId.userId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: ["Unauthorized: You do not own this shipment"]
            });
        }
        req.shipment = shipment;
        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            message: ["Server error during shipment ownership check"]
        });
    }
};


module.exports = {
    verifyOrderOwnership,
    verifyShipmentOwnership
};