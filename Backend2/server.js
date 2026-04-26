require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { success, error } = require('./utils/response');
const callRoutes = require('./routes/callRoutes');

const app = express();

app.use(helmet());

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use(limiter);

app.get('/health', (req, res) => {
  return success(res, {
    status: 'ok',
    service: 'zegocloud-call-backend',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/calls', callRoutes);

app.use((req, res) => {
  return error(res, `Route ${req.method} ${req.path} not found`, 404);
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  return error(res, 'Internal server error', 500);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ZegoCloud call backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
