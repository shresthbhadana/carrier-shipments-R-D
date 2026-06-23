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
    initiateReturnSchema,
    schedulePickupSchema,
    getLocationsSchema
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

const {authenticateJWT} = require("../middlewares/authMiddleware");

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
    "/locations",
    validate(getLocationsSchema, "query"),
    shipmentController.getLocations
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

router.get(
    "/:id/track",
    validateParams(objectIdSchema),
    verifyShipmentOwnership,
    shipmentController.trackShipment
);

router.post(
    "/:id/pickup",
    validateParams(objectIdSchema),
    validate(schedulePickupSchema),
    verifyShipmentOwnership,
    shipmentController.schedulePickup
);

module.exports = router;