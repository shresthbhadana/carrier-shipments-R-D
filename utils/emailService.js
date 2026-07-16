const nodemailer = require("nodemailer");

const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.mailtrap.io",
    port: parseInt(process.env.SMTP_PORT || "2525"),
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const sendVerificationEmail = async (email, otp) => {
    const mailOptions = {
        from: '"YellowDodle Setup" <no-reply@yellowdodle.com>',
        to: email,
        subject: "Verify your Account - OTP",
        text: `Your OTP code is ${otp}. It expires in 5 minutes.`,
        html: `<p>Your OTP code is <b>${otp}</b>. It expires in 5 minutes.</p>`
    };
    return transport.sendMail(mailOptions);
};

const sendBookingSuccessEmail = async (email, shipmentDetails) => {
    const mailOptions = {
        from: '"YellowDodle Shipping" <no-reply@yellowdodle.com>',
        to: email,
        subject: "Shipment Booked Successfully",
        text: `Your order has been booked with ${shipmentDetails.courierName}. Tracking ID is ${shipmentDetails.trackingId}.`,
        html: `<p>Your order has been booked with <b>${shipmentDetails.courierName}</b>. Tracking ID is <b>${shipmentDetails.trackingId}</b>.</p>`
    };
    return transport.sendMail(mailOptions);
};

module.exports = {
    sendVerificationEmail,
    sendBookingSuccessEmail
};
