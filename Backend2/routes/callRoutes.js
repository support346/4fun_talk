const express = require('express');
const router = express.Router();
const { getToken, createRoom, getRoomInfo, joinRoom, endRoom } = require('../controllers/callController');
const { tokenRules, handleValidation } = require('../middleware/validation');

// Generate a ZegoCloud token for a given userId + roomId
router.post('/token', tokenRules, handleValidation, getToken);

// Create a new call room (returns a unique roomId)
router.post('/room', createRoom);

// Get info about an existing room
router.get('/room/:roomId', getRoomInfo);

// Join an existing room (validates room exists, returns token)
router.post('/room/:roomId/join', joinRoom);

// End / close a room
router.delete('/room/:roomId', endRoom);

module.exports = router;
