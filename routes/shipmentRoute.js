const express = require("express");
const router = express.Router();

const shipmentController =
    require("../controllers/shipmentController");

const validate =
    require("../validators/validateMiddleware");

const { 
    createShipmentSchema, 
    updateShipmentSchema, 
    rateQuerySchema,
    objectIdSchema,
    initiateReturnSchema 
} = require("../validators/shipmentValidator");
const validateParams = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.params);
    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details.map((e) => e.message)
        });
    }
    next();
};
//authentication midddleware
const {authenticateJWT} = require("../middlewares/authMiddleware");
//ownershipMiddleware
const {verifyShipmentOwnership} = require("../middlewares/ownershipMiddleware");

router.use(authenticateJWT)





router.post(
    "/",
    validate(createShipmentSchema),
    shipmentController.createShipment
);

router.post(
    "/rates",
    validate(rateQuerySchema),
    shipmentController.getRates
);

router.get(
    "/",
    shipmentController.getAllShipments
);

router.get(
    "/:id",verifyShipmentOwnership,
    shipmentController.getShipmentById
);

router.put(
    "/:id",verifyShipmentOwnership,
    validate(updateShipmentSchema),
    shipmentController.updateShipment
);

router.delete(
    "/:id",verifyShipmentOwnership,
    shipmentController.deleteShipment
);


router.get(
    "/:id/label",verifyShipmentOwnership,
    shipmentController.getLabel
);

router.post(
    "/:id/cancel",  validateParams(objectIdSchema),verifyShipmentOwnership,
    shipmentController.cancelShipment
);

router.post(
    "/:id/return", validateParams(objectIdSchema),
    validate(initiateReturnSchema),verifyShipmentOwnership,
    shipmentController.initiateReturn
);


module.exports = router;