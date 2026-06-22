const productOrderService = require("../services/productOrderService");

const createProductOrder = async (req, res, next) => {
    try {
        req.body.userId = req.user.id;
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
        const { page = 1, limit = 10, sort = "-createdAt" } = req.query;
        const result = await productOrderService.getAllOrders({
            page: parseInt(page),
            limit: parseInt(limit),
            sort
        });

        res.status(200).json({
            success: true,
            data: result.data,
            pagination: result.pagination
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
