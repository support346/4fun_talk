const crypto = require('crypto');
const { getConfig } = require('../config/zegocloud');

/**
 * Generates a ZegoCloud Token04.
 * Algorithm: AES-256-CBC encrypt a JSON payload, then base64-encode a binary
 * buffer containing expire_time | iv_len | iv | cipher_len | ciphertext.
 * The token is prefixed with the string "04".
 */
const generateToken = (userId, roomId, payload = '') => {
  const { appId, serverSecret, tokenExpire } = getConfig();

  const createTime = Math.floor(Date.now() / 1000);
  const expireTime = createTime + tokenExpire;

  const tokenInfo = {
    app_id: appId,
    user_id: userId,
    nonce: Math.floor(Math.random() * 2147483647),
    ctime: createTime,
    expire: expireTime,
    payload,
  };

  const plaintext = Buffer.from(JSON.stringify(tokenInfo), 'utf-8');

  // ZegoCloud uses AES-256-CBC: 32-byte ASCII key, random 16-byte IV
  const key = Buffer.from(serverSecret, 'ascii');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  // Buffer layout: [expire(8)] [ivLen(2)] [iv(16)] [encLen(2)] [enc]
  const buf = Buffer.alloc(8 + 2 + iv.length + 2 + encrypted.length);
  let offset = 0;

  buf.writeBigInt64BE(BigInt(expireTime), offset);
  offset += 8;

  buf.writeUInt16BE(iv.length, offset);
  offset += 2;

  iv.copy(buf, offset);
  offset += iv.length;

  buf.writeUInt16BE(encrypted.length, offset);
  offset += 2;

  encrypted.copy(buf, offset);

  const token = '04' + buf.toString('base64');
  return { token, expireTime, roomId };
};

module.exports = { generateToken };
