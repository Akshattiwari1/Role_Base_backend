const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user from token to the request (without password)
      req.user = await User.findById(decoded.id).select('-password');
      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) { // Ensure user is attached by `protect` middleware first
        return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: `User role ${req.user.role} is not authorized to access this route` });
    }
    // Check if user is blocked
    if (req.user.isBlocked) {
        return res.status(403).json({ message: 'Your account has been blocked. Please contact an administrator.' });
    }
    // Additional check for enterprise status for relevant routes
    if (req.user.role === 'enterprise' && req.user.enterpriseStatus !== 'approved') {
        // Apply this restriction only to routes where product/order management is expected
        const currentPath = req.path.toLowerCase();
        if (currentPath.includes('/products') || currentPath.includes('/orders')) {
            return res.status(403).json({ message: 'Your enterprise account is not approved yet. Please wait for admin approval.' });
        }
    }
    next();
  };
};

module.exports = { protect, authorizeRoles };