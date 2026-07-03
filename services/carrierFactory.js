const fedexService = require("./fedexService");
const canadaPostService = require("./canadaPostService");
const shipmozoService = require("./shipmozoService");
const purolatorService = require("./purolatorService");
const upsService = require("./upsService");
const glsService = require("./glsService");

const getCarrierService = (courierName) => {
    if (!courierName) return fedexService;
    const name = courierName.toLowerCase().trim();
    if (name.includes("fedex")) return fedexService;
    if (name.includes("purolator") || name.includes("populator") || name.includes("porulator")) return purolatorService;
    if (name.includes("canada") || name.includes("postal")) return canadaPostService;
    if (name.includes("delhivery") || name.includes("bluedart") || name.includes("shipmozo")) return shipmozoService;
    if (name.includes("ups")) return upsService;
    if (name.includes("gls") || name.includes("dicom")) return glsService;
    return fedexService;
};

module.exports = {
    getCarrierService
};
