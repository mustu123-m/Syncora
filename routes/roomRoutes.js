const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/authMiddleware');
const roomController=require('../controllers/roomController.js');
// For host (form submission from dashboard)
router.get('/room', requireLogin,roomController.createRoom);

// For others joining directly by URL
router.get('/room/:roomId', requireLogin,roomController.joinRoom);
router.get('/join-room',requireLogin,roomController.getinRoom);
module.exports = router;
