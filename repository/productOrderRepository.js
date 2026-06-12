
const ProductOrder = require("../models/productModel");

const createProductOrder = async (payload) => {
    return ProductOrder.create(payload);
}
const findById = async (orderId) => {
    return ProductOrder.findById(orderId).populate("userId");
}

const updateOrder = async (orderId, data) => {
    return ProductOrder.findByIdAndUpdate(orderId, data, { new: true });
}
const findAllProduct = async () => {
    return ProductOrder.find();
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
