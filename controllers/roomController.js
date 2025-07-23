const { v4: uuidv4 } = require('uuid');
const User=require('../models/User.js');
module.exports.createRoom = async (req, res) => {
  const roomId =uuidv4();
  const requireApproval = req.query.requireApproval === 'on';
 const user=await User.findById(req.session.userId);

  const isHost = true;
  res.render('room', {
    roomId,
    my_username: user.username,
    isHost,
    requireApproval
  });
}


module.exports.joinRoom = async (req, res) => {
  const roomId = req.params.roomId;
  const isHost = false;
  const user=await User.findById(req.session.userId);

  res.render('room', {
    roomId,
    my_username: user.username,
    isHost,
    requireApproval: false  // server will enforce real value later
  });
}
module.exports.getinRoom=(req,resp)=>{
  const roomId=req.query.roomId;
  resp.redirect(`/room/${roomId}`);
}
