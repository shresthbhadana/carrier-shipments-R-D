const productOrderService = require("../services/productOrderService");

const createProductOrder = async (req, res, next) => {
    try {
        const order =
            await productOrderService.createProductOrder(
                req.body
            );

        res.status(201).json({
            success: true,
            data: order
        });
    } catch (error) {
        next(error);
    }
};

const getOrderById = async (req, res, next) => {
    try {
        const order =
            await productOrderService.getOrderById(
                req.params.id
            );

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (error) {
        next(error);
    }
};

const getAllOrders = async (req, res, next) => {
    try {
        const orders =
            await productOrderService.getAllOrders();

        res.status(200).json({
            success: true,
            data: orders
        });
    } catch (error) {
        next(error);
    }
};

const updateOrder = async (req, res, next) => {
    try {
        const order =
            await productOrderService.updateOrder(
                req.params.id,
                req.body
            );

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (error) {
        next(error);
    }
};

const deleteProductOrder = async (req, res, next) => {
    try {
        await productOrderService.deleteProductOrder(
            req.params.id
        );

        res.status(200).json({
            success: true,
            message: "Order deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createProductOrder,
    getOrderById,
    getAllOrders,
    updateOrder,
    deleteProductOrder
};
