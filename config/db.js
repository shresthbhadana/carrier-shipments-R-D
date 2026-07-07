const mongoose = require("mongoose");
const { logger } = require("./logger");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL, {
            tls: true,
            tlsAllowInvalidCertificates: false
        });
        logger.info("MongoDB is connected securely using TLS/SSL");
   } catch (error) {
       logger.error("Error to connect mongodb:", error);
       console.log("error to connect mongodb:", error)
      process.exit(1);
    }
 };

module.exports = connectDB;