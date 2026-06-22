const path = require("path");
const fs = require("fs");
const Shipment = require("../models/shipmentModel");

const serveLabel = async (req, res, next) => {
    try {
        const { filename } = req.params;
        const awbNumber = filename.replace(/\.pdf$/, "");
        const shipment = await Shipment.findOne({ awbNumber }).populate("orderId");
        if (!shipment) {
            return res.status(404).json({
                success: false,
                message: ["Label not found"]
            });
        }
        if (!shipment.orderId || shipment.orderId.userId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: ["Forbidden: You do not own this shipment"]
            });
        }
        const filePath = path.join(__dirname, "../labels", filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: ["Label file not found on disk"]
            });
        }
        res.sendFile(filePath);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    serveLabel
};
