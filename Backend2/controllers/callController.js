const { v4: uuidv4 } = require('uuid');
const { generateToken } = require('../services/tokenService');
const { success, error } = require('../utils/response');

// In-memory store for active rooms (keyed by roomId)
const activeRooms = new Map();

const getToken = (req, res) => {
  try {
    const { userId, roomId, payload } = req.body;
    const result = generateToken(userId, roomId, payload || '');
    return success(res, {
      token: result.token,
      roomId: result.roomId,
      userId,
      expireTime: result.expireTime,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const createRoom = (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return error(res, 'userId is required', 400);
    }

    const roomId = uuidv4();
    activeRooms.set(roomId, {
      roomId,
      createdBy: userId.trim(),
      createdAt: Date.now(),
      participants: [userId.trim()],
    });

    return success(res, { roomId }, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const getRoomInfo = (req, res) => {
  const { roomId } = req.params;
  const room = activeRooms.get(roomId);
  if (!room) {
    return error(res, 'Room not found', 404);
  }
  return success(res, { room });
};

const joinRoom = (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;

    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return error(res, 'userId is required', 400);
    }

    const room = activeRooms.get(roomId);
    if (!room) {
      return error(res, 'Room not found', 404);
    }

    const uid = userId.trim();
    if (!room.participants.includes(uid)) {
      room.participants.push(uid);
    }

    const result = generateToken(uid, roomId);
    return success(res, {
      token: result.token,
      roomId,
      userId: uid,
      expireTime: result.expireTime,
      participants: room.participants,
    });
  } catch (err) {
    console.log(err);
    
    return error(res, err.message, 500);
  }
};

const endRoom = (req, res) => {
  const { roomId } = req.params;
  if (!activeRooms.has(roomId)) {
    return error(res, 'Room not found', 404);
  }
  activeRooms.delete(roomId);
  return success(res, { message: 'Room ended successfully' });
};

module.exports = { getToken, createRoom, getRoomInfo, joinRoom, endRoom };
