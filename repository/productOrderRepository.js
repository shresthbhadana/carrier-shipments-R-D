
const ProductOrder = require("../models/productOrderModel");

const createProductOrder = async (payload) => {
    return ProductOrder.create(payload);
}
const findById = async (orderId) => {
    return ProductOrder.findById(orderId).populate("userId");
}

const updateOrder = async (orderId, data) => {
    return ProductOrder.findByIdAndUpdate(orderId, data, { new: true });
}
const findAllProduct = async (options = {}) => {
    const { page = 1, limit = 10, sort = "-createdAt" } = options;
    const skip = (page - 1) * limit;

    const query = ProductOrder.find().populate("userId");

    const [data, total] = await Promise.all([
        query.sort(sort).skip(Number(skip)).limit(Number(limit)),
        ProductOrder.countDocuments()
    ]);

    return {
        data,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
        }
    };
};
const deleteProductOrder = async (productId) => {
    return ProductOrder.findByIdAndDelete(productId);
}

module.exports = {
    createProductOrder,
    findById,
    updateOrder,
    findAllProduct,
    deleteProductOrder
};
