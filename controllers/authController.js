const bcrypt = require("bcryptjs");
const User = require("../models/User");
const sgMail = require('@sendgrid/mail');
require('dotenv').config();
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports.renderRegisterForm = (req, res) => {
  res.render("register.ejs");
};

module.exports.registerUser = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.send("User already exists. Try logging in.");
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = new User({
      username,
      email,
      password: hashedPassword
    });

    await newUser.save();
    req.session.userId = newUser._id;
    res.redirect("/dashboard");
  } catch (err) {
    console.log(err);
    res.send("Something went wrong!");
  }
};

// Already added: renderRegisterForm, registerUser

module.exports.renderLoginForm = (req, res) => {
  res.render("login");
};

module.exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.send("No user found with that email.");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.send("Invalid credentials.");
    }

    req.session.userId = user._id;
    res.redirect("/dashboard");
  } catch (err) {
    console.log(err);
    res.send("Something went wrong!");
  }
};

module.exports.logoutUser = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.send("Error logging out.");
    }
    res.redirect("/dashboard");
  });
};
module.exports.forgotPassword=(req,resp)=>{
 resp.render('forgotpassword.ejs');
}
module.exports.sendOtpforpassword=async (req,resp)=>{
  const {email}=req.body;
   const user = await User.findOne({ email });

    if (!user) {
      return resp.send("No user found with that email.");
    }
    const otp=generateOTP();
sgMail.setApiKey(process.env.SENDGRID_API_KEY); // Store in .env
  const msg = {
    to: email,
    from: 'xgreenmustafaattarwala10@gmail.com', // MUST be the verified sender email
    subject: 'Your OTP Code',
    text: `Your OTP is ${otp}`,
    html: `<strong>Your OTP is: ${otp}</strong>`,
  };

  const result=await sgMail.send(msg);
  console.log(result);
  req.session.otp=otp;
  req.session.emailId=email;
  console.log(req.session.emailId);
  resp.render('enter-otp.ejs');
}
module.exports.verifyOtp=async (req,resp)=>{
  const {otp}=req.body;
  const email=req.session.emailId;
  if(req.session.otp && req.session.otp===otp){
    resp.render('resetPassword.ejs');
    return;
  }
resp.render("enter-otp.ejs");
}
module.exports.resetPassword=async (req,resp)=>{
  const {password}=req.body;
   const hashedPassword = await bcrypt.hash(password, 10);
  const email=req.session.emailId;
  const user = await User.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { new: true }
    );
        if (!user) {
      return resp.status(404).send('User not found.');
    }
    req.session.otp = null;
    req.session.otpEmail = null;
    resp.redirect('/login');
  
}