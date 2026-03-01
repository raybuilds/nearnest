const rateLimit = require("express-rate-limit");

const complaintLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many complaint attempts. Please slow down.",
  },
});

module.exports = { complaintLimiter };
