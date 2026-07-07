const multer = require("multer");
const path =  require("path");
const storage = multer.diskStorage({
    destination : (req,res,cb) =>{
        cb(null,"uploads/")
    },
    filename : (req,res,cb)=>{
        const uniquieSuffix = Date.now()+"-"+ Math.round(Math.random());
        Math.round(Math.random() * 1E9);
        cb(null,file.fileName + "-"+uniquieSuffix+ path.extname(file.originalName))
        
    }
});
const ALLOWED_TYPES = /jpeg|jpg|png|pdf/;
const fielFilter = (req,res,cb)=>{
    const extName = ALLOWED_TYPES.test(path.extname(file.originalname).toLowerCase());
    const mimeType = ALLOWED_TYPES.test(file.mimetype);
    if(extName && mimeType){
        return cb(null,true);
    }else{
        cb(new Error("invalid file type"),false)
    }
};
const uploads =  multer({
    storage : storage,
    limits :{ fileSize : 1024*1024*10},
    fileFilter : fielFilter
});
module.exports  = uploads;

