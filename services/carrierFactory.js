const fedexService = require("./fedexService");
const canadaPostService = require("./canadaPostService");
const shipmozoService = require("./shipmozoService");
const purolatorService = require("./purolatorService");

const getCarrierService = (courierName) => {
    if (!courierName) return fedexService;
    const name = courierName.toLowerCase().trim();
    if (name.includes("fedex")) return fedexService;
    if (name.includes("purolator") || name.includes("populator") || name.includes("porulator")) return purolatorService;
    if (name.includes("canada") || name.includes("postal")) return canadaPostService;
    if (name.includes("delhivery") || name.includes("bluedart") || name.includes("shipmozo")) return shipmozoService;
    return fedexService;
};

module.exports = {
    getCarrierService
};
