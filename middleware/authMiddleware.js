// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler'); // Important for handling async errors without try/catch in every middleware
const User = require('../models/User'); // Path to your User model

// Middleware to protect routes (ensure user is logged in)
const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user to the request object (without password)
      req.user = await User.findById(decoded.id).select('-password');
      next();
    } catch (error) {
      console.error(error);
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

// Middleware to authorize roles
// This function returns another middleware function
const authorize = (roles = []) => { // 'roles' is an array of allowed roles, e.g., ['admin', 'enterprise']
  return (req, res, next) => {
    // Convert a single role string to an array if passed as such
    if (typeof roles === 'string') {
      roles = [roles];
    }

    // Ensure user is authenticated and user object exists on req
    if (!req.user) {
      res.status(401);
      throw new Error('Not authorized, user not authenticated');
    }

    // Check if the user's role is included in the allowed roles
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      res.status(403); // Forbidden
      throw new Error('Not authorized to access this route');
    }
    next(); // User is authorized, proceed to the next middleware/route handler
  };
};

module.exports = {
  protect,
  authorize, // <--- **THIS IS CRUCIAL: 'authorize' MUST BE EXPORTED HERE**
};