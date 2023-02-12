const userModel = require("../models/userModel");
const uploadFile = require("../aws/aws");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken")
const { validPhone, validEmail, validValue, isValidImg, validName, validPincode, validObjectId, validPassword, isValidBody } = require("../validator/validation");


exports.createUser = async function (req, res) {
  try {
    let data = req.body;
    let file = req.files;

    if (Object.keys(data).length == 0) return res.status(400).send({ status: false, message: "Please give some data" });

    let { fname, lname, email, phone, password, address } = data;

    if (!fname) return res.status(400).send({ status: false, message: "FirstName is mandatory" })
    if (!lname) return res.status(400).send({ status: false, message: "lastName is mandatory" })
    if (!email) return res.status(400).send({ status: false, message: "Email is mandatory" })
    if (!phone) return res.status(400).send({ status: false, message: "Phone is mandatory" })

    if (file && file.length == 0) return res.status(400).send({ status: false, message: "ProfileImage is a mandatory" })
    if (!password) return res.status(400).send({ status: false, message: "Password is mandatory" })
    if (!address) return res.status(400).send({ status: false, message: "Address is required" })


    if (!validName(fname.trim())) return res.status(400).send({ status: false, message: "FirstName should be in alphabets only" })
    if (!validName(lname.trim())) return res.status(400).send({ status: false, message: "LastName should be in alphabets only" })

    if (!validEmail(email)) return res.status(400).send({ status: false, message: "Please provide correct email" })
    let findEmail = await userModel.findOne({ email })
    if (findEmail) return res.status(400).send({ status: false, message: "User with this email already exists" })

    if (!validPhone(phone)) return res.status(400).send({ status: false, message: "Please provide correct phone number" })
    let findPhone = await userModel.findOne({ phone });
    if (findPhone) return res.status(400).send({ status: false, message: "User with this phone number already exists" })

    if (!validPassword(password)) return res.status(400).send({ status: false, message: "Password Should be (8-15) in length with one upperCase, special character and number" })


    //Hashing
    const saltRounds = 10;
    const hash = bcrypt.hashSync(password, saltRounds)

    address = JSON.parse(address)
    let { shipping, billing } = address

    if (!shipping) return res.status(400).send({ status: false, message: "Shipping Address is mandatory" })
    if (!billing) return res.status(400).send({ status: false, message: "Billing Address is required" })

    if (shipping) {
      if (!shipping.street) return res.status(400).send({ status: false, message: "Shipping Street is mandatory" })
      if (!validValue(shipping.street)) return res.status(400).send({ status: false, Message: "Please provide street name in string format" })

      if (!shipping.city) return res.status(400).send({ status: false, message: "Shipping City is mandatory" })
      if (!validValue(shipping.city)) return res.status(400).send({ status: false, Message: "Please provide city name in string format" })

      if (!shipping.pincode) return res.status(400).send({ status: false, message: "Shipping Pincode is mandatory" })
      if (!validPincode(shipping.pincode)) return res.status(400).send({ status: false, Message: "Please provide pincode in number format" })
    }

    if (billing) {
      if (!billing.street) return res.status(400).send({ status: false, message: "Billing Street is mandatory" })
      if (!validValue(billing.street)) return res.status(400).send({ status: false, Message: "Please provide street name in string format" })

      if (!billing.city) return res.status(400).send({ status: false, message: "Billing City is mandatory" })
      if (!validValue(billing.city)) return res.status(400).send({ status: false, Message: "Please provide city name in string format" })

      if (!billing.pincode) return res.status(400).send({ status: false, message: "Billing Pincode is mandatory" })
      if (!validPincode(billing.pincode)) return res.status(400).send({ status: false, Message: "Please provide pincode in number format" })
    }

    if (file && file.length > 0) {
      if (!isValidImg(file[0].originalname)) return res.status(400).send({ status: false, message: "Please provide image in jpg|gif|png|jpeg|jfif " })
    }
    let url = await uploadFile(file[0]);

    const userData = {
      fname: fname, lname: lname, profileImage: url, email: email,
      phone: phone, password: hash, address: address
    }

    const user = await userModel.create(userData);
    return res.status(201).send({ status: true, message: "User created successfully", data: user });

  }
  catch (error) {
    return res.status(500).send({ status: false, message: error.message });
  }
}



//------------------------------------------------------------Login Api-------------------------------------------------------------------------------

exports.loginUser = async function (req, res) {
  try {
    let { email, password } = req.body;

    if (Object.keys(req.body).length === 0) {
      return res.status(400).send({ status: false, message: "please input user Details" });
    }

    if (!email) {
      return res.status(400).send({ status: false, message: "EmailId is mandatory", });
    }
    if (!validEmail(email)) {
      return res.status(400).send({ status: false, message: "EmailId should be Valid", });
    }
    if (!password) {
      return res.status(400).send({ status: false, message: "Password is mandatory" });
    }
    if (password.length < 8 || password.length > 15) {
      return res.status(400).send({ status: false, message: "the length of password must be min: 8 or max: 15", });
    }

    let verifyUser = await userModel.findOne({ email: email });
    if (!verifyUser) return res.status(400).send({ status: false, message: "Invalid Login Credential" });

    
    //-------------------------------------------Decrypt the password and compare the password with user input------------------------------------------//
    
    const isCorrectPassword=bcrypt.compareSync(password, verifyUser.password)
    if(! isCorrectPassword) return res.status(400).send({status:false,message:"Incorrect password"})


    let payload = {
      exp: Math.floor(Date.now() / 1000) + 6000,
      iat: Date.now(), userId: verifyUser["_id"],
    };


    let token = jwt.sign(payload, "Group15");

    res.setHeader("authorization", token);
    res.status(200).send({ status: true, message: "User login successfull", data: { userId: verifyUser["_id"], token } });
  } catch (error) {
    res.status(500).send({ status: false, message: error.message, });
  }
};

//-----------------------------------------------------get users-------------------------------------------
exports.getProfile = async function (req, res) {
  try {
    const userId = req.params.userId;

    if (!validObjectId(userId)) return res.status(400).send({ status: false, message: "Please provide valid user id" })

    const loggedUser = req.token.userId;
    if (userId != loggedUser) return res.status(403).send({ status: false, message: "you can't see other people's profile" })

    const profileData = await userModel.findById(userId)
    return res.status(200).send({ status: true, message: "User profile details", data: profileData })
  }
  catch (err) {
    return res.status(500).send({ status: false, message: err.message })
  }
}


//------------------------------------------------------------Update Api-------------------------------------------------------------------------------

exports.updateUser = async (req, res) => {
  try {
    
    let userId = req.params.userId
    if (!validObjectId(userId)) return res.status(400).send({ status: false, message: "Please provide a valid user id" })

    let loggedUser = req.token.userId
    if (userId !== loggedUser) return res.status(403).send({ status: false, message: "You are not authorized to perform this task" })

    let data = req.body;
    let file = req.files

    if (!isValidBody(data) && (typeof (file) == "undefined")) return res.status(400).send({ status: false, message: "Please give some data" })

    let { fname, lname, email, phone, password, address } = data

    let newobj = {}
    if (fname) {
      if (!validName(fname.trim())) return res.status(400).send({ status: false, message: "FirstName should be in alphabets only" })
      newobj.fname = fname
    }
    if (lname) {
      if (!validName(lname.trim())) return res.status(400).send({ status: false, message: "LastName should be in alphabets only" })
      newobj.lname = lname
    }
    if (email) {
      if (!validEmail(email)) return res.status(400).send({ status: false, message: "Please provide correct email" })
      let findEmail = await userModel.findOne({ email });
      if (findEmail) return res.status(400).send({ status: false, message: "User with this email already exists" })
      newobj.email = email
    }
    if (file && file.length > 0) {
      if (!isValidImg(file[0].originalname)) return res.status(400).send({ status: false, message: "Please provide image in jpg/gif/png/jpeg/jfif " })
      let url = await uploadFile(file[0]);
      newobj.profileImage = url

    }
    if (phone) {
      if (!validPhone(phone)) return res.status(400).send({ status: false, message: "Please provide correct phone number" })
      let findPhone = await userModel.findOne({ phone });
      if (findPhone) return res.status(400).send({ status: false, message: "User with this phone number already exists" })
      newobj.phone = phone
    }
    if (password) {
      if (!validPassword(password)) return res.status(400).send({ status: false, message: "Password Should be (8-15) in length with one upperCase, special character and number" })
      const saltRounds = 10;
      newobj.password = bcrypt.hashSync(password, saltRounds)

    }

    if (address) {
      address = JSON.parse(address)

      let { shipping, billing } = address

      if (shipping) {
        if (shipping.street) {
          if (!validValue(shipping.street)) return res.status(400).send({ status: false, Message: "Please provide street name in string format" })
        }

        if (shipping.city) {
          if (!validValue(shipping.city)) return res.status(400).send({ status: false, Message: "Please provide city name in string format" })
        }

        if (shipping.pincode) {
          if (!validPincode(shipping.pincode)) return res.status(400).send({ status: false, Message: "Please provide pincode in number format" })
        }
      }
      if (billing) {

        if (billing.street) {
          if (!validValue(billing.street)) return res.status(400).send({ status: false, Message: "Please provide street name in string format" })
        }

        if (billing.city) {
          if (!validValue(billing.city)) return res.status(400).send({ status: false, Message: "Please provide city name in string format" })
        }

        if (billing.pincode) {
          if (!validPincode(billing.pincode)) return res.status(400).send({ status: false, Message: "Please provide pincode in number format" })
        }
      }
      newobj.address = address
    }

    const updatedUser = await userModel.findOneAndUpdate({ _id: userId }, { $set: newobj }, { new: true })

    return res.status(200).send({ status: true, message: "User profile updated", data: updatedUser })
  }
  catch (err) {
    return res.status(500).send({ status: false, message: err.message })
  }
}