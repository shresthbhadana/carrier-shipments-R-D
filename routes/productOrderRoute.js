const express = require("express");
const router = express.Router();

const validate = require("../validators/validateMiddleware");
const {
    createOrderSchema
} = require("../validators/productOrderValidator");

const productOrderController =
    require("../controllers/productOrderController");

router.post(
    "/",
    validate(createOrderSchema),
    productOrderController.createProductOrder
);

router.get(
    "/",
    productOrderController.getAllOrders
);

router.get(
    "/:id",
    productOrderController.getOrderById
);

router.put(
    "/:id",
    productOrderController.updateOrder
);

router.delete(
    "/:id",
    productOrderController.deleteProductOrder
);

module.exports = router;