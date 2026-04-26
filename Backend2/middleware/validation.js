const { body, validationResult } = require('express-validator');
const { error } = require('../utils/response');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, 'Validation failed', 422, errors.array());
  }
  next();
};

const tokenRules = [
  body('userId')
    .trim()
    .notEmpty().withMessage('userId is required')
    .isString().withMessage('userId must be a string')
    .isLength({ min: 1, max: 64 }).withMessage('userId must be 1-64 characters'),
  body('roomId')
    .trim()
    .notEmpty().withMessage('roomId is required')
    .isString().withMessage('roomId must be a string')
    .isLength({ min: 1, max: 128 }).withMessage('roomId must be 1-128 characters'),
  body('payload')
    .optional()
    .isString().withMessage('payload must be a string'),
];

module.exports = { handleValidation, tokenRules };
