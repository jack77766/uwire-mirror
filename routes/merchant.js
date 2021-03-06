var express     = require('express');
var router      = express.Router();
var multer      = require('multer');
var cloudinary  = require('cloudinary');


var Merchant = require('../models/merchant.js');
var Business = require('../models/business.js');

var myFunctions = require('../modules.js')



//CLOUDINARY CONFIG
cloudinary.config({ 
  cloud_name: 'shimmyshimmycocobop', 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

//MULTER CONFIG
var storage = multer.diskStorage({
   filename: function(req, file, callback) {
      callback(null, file.originalname);
   }
});
var upload = multer({ storage: storage })

//MERCHANT PAGE
router.get('/merchant', function(req, res) {
   Merchant.findOne({'user.id': req.user.id}, function(err, foundMerchant) {
      if(!foundMerchant) {
         res.render('merchant/personal_app_new');
      }
      else {
         Business.findOne({'user.id': req.user.id}, function(err, foundBusiness) {
            if(!foundBusiness) {
               res.render('merchant/business_app_new');
            }
            else res.render('merchant/index')
         });
      }
   });
});

//MERCHANT PERSONAL APP EDIT
router.get('/merchant/personal_app_edit', function(req, res) {
   Merchant.findOne({'user.id':req.user.id}, function(err, foundMerchant) {
      if(err) console.log(err);
      else {
         var doc_image  = myFunctions.pdfThumbnail(foundMerchant.doc_image);
         var util_image = myFunctions.pdfThumbnail(foundMerchant.util_image);
         res.render('merchant/personal_app_edit', {merchant: foundMerchant, 
                                                   doc_image: doc_image, util_image: util_image});
      }
   })
});


//MERCHANT PERSONAL APP NEW
var fieldsUpload = upload.fields([{ name: 'doc_image', maxCount: 1 }, { name: 'util_image', maxCount: 1 }]);
router.post('/merchant/personal_app_new', fieldsUpload, async function(req, res, next) {
   var user = {
      id:       req.user.id, 
      username: req.user.username
   };

   //UPLOAD DOCUMENT IMAGES TO CLOUDINARY
   let upload1 = await uploadToCloudinary(req.files['doc_image'][0].path);
   let upload2 = await uploadToCloudinary(req.files['util_image'][0].path);
         
   //CREATE MERCHANT OBJECT
   var newMerchant = {user:      user, 
                     first_name: req.body.first_name,
                     last_name:  req.body.last_name,
                     email:      req.body.email, 
                     phone:      req.body.phone, 
                     doc_type:   req.body.doc_type,
                     doc_num:    req.body.doc_num, 
                     doc_image:  upload1.secure_url,  
                     address:    req.body.address, 
                     country:    req.body.country, 
                     city:       req.body.city, 
                     state:      req.body.state, 
                     post_code:  req.body.post_code,
                     util_image: upload2.secure_url
                  }
   //INSERT MERCHANT OBJECT INTO DB
   Merchant.create(newMerchant, function(err, createdMerchant) {
      if(err) {
         console.log(err);
         res.send("Error creating Merchant");
      }
      else {
         console.log(createdMerchant);
         // User.findByIdAndUpdate(req.user.id, )
         res.render('merchant/business_app_new', {merchant: createdMerchant});
      }
   });
});


//PERSONAL APP UPDATE
router.put('/merchant/personal_app_edit', fieldsUpload, async function(req, res) {
   var merchant = req.body.merchant;

   //IF USER UPLOADED DOCUMENT IMAGE UPLOAD TO CLOUDINARY
   if(req.files['doc_image']) {
      console.log("Received a new document image");
      let upload1 = await uploadToCloudinary(req.files['doc_image'][0].path);
      merchant.doc_image  = upload1.secure_url; 
   }
   //IF USER UPLOADED UTILITY IMAGE UPLOAD TO CLOUDINARY
   if(req.files['util_image']) {
      console.log("Received a new utility image");
      let upload2 = await uploadToCloudinary(req.files['util_image'][0].path);
      merchant.util_image = upload2.secure_url; 
   }
   //UPDATE MERCHANT INFO 
   Merchant.findOneAndUpdate({'user.id':req.user.id}, merchant, function(err, updatedMerchant){
      if(err) console.log(err);
      else {
         console.log("Updated Merchant: " + updatedMerchant);
         res.render('merchant/index');
      }
   });
});

//BUSINESS APP EDIT
router.get('/merchant/business_app_edit', function(req, res) {
   Business.findOne({'user.id':req.user.id}, function(err, foundBusiness) {
      if(err) console.log(err);
      else {
         var image_urls = foundBusiness.images;
         var images = [];
         image_urls.forEach(function(url) {
            images.push(myFunctions.pdfThumbnail(url));
         });
         res.render('merchant/business_app_edit', {business: foundBusiness, images:images});
      }
   })
});

//BUSINESS APP UPDATE
router.put('/merchant/business_app_edit', upload.array('images' , 10), async function(req, res) {
   var business = req.body.business;
   if(req.files[0]) {
      var imageArray = [];
      for(var i = 0; i < req.files.length; i++) {
         let upload = await uploadToCloudinary(req.files[i].path);
         imageArray.push(upload.secure_url);
      }
      business.images = imageArray;
   }

   Business.findOneAndUpdate({'user.id':req.user.id}, business, function(err, updatedBusiness) {
      if(err) console.log(err);
      else {
         console.log("Updated Business: " + updatedBusiness);
         res.render('merchant/index')
      }
   });


});

//BUSINESS APP POST
router.post('/merchant/business_app_new', upload.array('images' , 10),  async function(req, res, next) {

   var user = {
      id:       req.user.id, 
      username: req.user.username
   }
   //UPLOAD IMAGES TO CLOUDINARY AND STORE URL IN imageArray
   var imageArray = [];
   for(var i = 0; i < req.files.length; i++) {
      let upload = await uploadToCloudinary(req.files[i].path);
      imageArray.push(upload.secure_url);
   }

   //CREATE BUSINESS OBJECT
   var newBusiness = {
                     user: user, 
                     name: req.body.name, 
                     address: req.body.address, 
                     country: req.body.country, 
                     city: req.body.city,
                     state: req.body.state, 
                     post_code: req.body.post_code, 
                     registration_number: req.body.registration_number,
                     website: req.body.website, 
                     phone: req.body.phone,
                     images: imageArray
   }
   
   Business.create(newBusiness, function(err, createdBusiness) {
      if(err) {
         console.log(err);
         res.send("Error creating Business");
      }
      else {
         console.log(createdBusiness);
         res.render('merchant/index');
      }
   });
});



function uploadToCloudinary(image) {
   return new Promise((resolve, reject) => {
     cloudinary.v2.uploader.upload(image, (err, url) => {
       if (err) return reject(err);
       resolve(url);
     })
   });
 }



module.exports = router;