const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL)
        console.log("mongoDB is connected successfully")

    } catch (error) {
        console.log("error to connect mongodb", error)
        process.exit(1)
    }
}

module.exports = connectDB