const express =  require("express");
const router =  express.Router();
const uploads =  require("../middlewares/uploadMiddleware");


router.post("/",(req,res,next)=>{
    uploads.single("file")(req,res,(err)=>{
        if(err){
            return res.status(400).json({
                success: false,
                message : [err.message]
            })
        };
        if(!req.file){
            return res.status(400).json({
                success:false,
                message : ["No file uploaded"]
            })
           
    
        }
         res.status(200).json({
                success : true,
                message : ["File uploaded successfully"],
                data : req.file   
            })
    })
});
module.exports = router;
