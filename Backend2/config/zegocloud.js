const getConfig = () => {
  const appId = parseInt(process.env.ZEGO_APP_ID, 10);
  const serverSecret = process.env.ZEGO_SERVER_SECRET;
  const tokenExpire = parseInt(process.env.ZEGO_TOKEN_EXPIRE, 10) || 3600;

  if (!appId || isNaN(appId)) {
    throw new Error('ZEGO_APP_ID must be a valid number in environment variables');
  }
  if (!serverSecret || serverSecret.length !== 32) {
    throw new Error('ZEGO_SERVER_SECRET must be a 32-character string in environment variables');
  }

  return { appId, serverSecret, tokenExpire };
};

module.exports = { getConfig };
