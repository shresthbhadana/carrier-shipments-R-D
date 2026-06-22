const express = require("express");
const router = express.Router();
const { authenticateJWT } = require("../middlewares/authMiddleware");
const { verifyOrderOwnership } = require("../middlewares/ownershipMiddleware");

const validate = require("../validators/validateMiddleware");
const {
    createOrderSchema ,updateOrderSchema
} = require("../validators/productOrderValidator");

const productOrderController =
    require("../controllers/productOrderController");

router.post(
    "/",
    authenticateJWT,

    validate(createOrderSchema),
    productOrderController.createProductOrder
);

router.get(
    "/", authenticateJWT,
    verifyOrderOwnership,
    productOrderController.getAllOrders
);

router.get(
    "/:id", authenticateJWT,
    verifyOrderOwnership,
    productOrderController.getOrderById
);

router.put(
    "/:id", authenticateJWT,
    verifyOrderOwnership,validate(updateOrderSchema),
    productOrderController.updateOrder
);

router.delete(
    "/:id", authenticateJWT,
    verifyOrderOwnership,
    productOrderController.deleteProductOrder
);

module.exports = router;