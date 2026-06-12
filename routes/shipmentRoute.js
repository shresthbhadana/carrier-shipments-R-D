const express = require("express");
const router = express.Router();

const shipmentController =
    require("../controllers/shipmentController");

const validate =
    require("../validators/validateMiddleware");

const {
    createShipmentSchema,
    updateShipmentSchema,
    rateQuerySchema
} = require("../validators/shipmentValidator");

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
    "/:id",
    shipmentController.getShipmentById
);

router.put(
    "/:id",
    validate(updateShipmentSchema),
    shipmentController.updateShipment
);

router.delete(
    "/:id",
    shipmentController.deleteShipment
);

router.get(
    "/:id/track",
    shipmentController.trackShipment
);


router.post(
    "/:id/cancel",
    shipmentController.cancelShipment
);

router.post(
    "/:id/return",
    shipmentController.initiateReturn
);


module.exports = router;