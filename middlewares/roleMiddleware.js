const roleAccess = (...roles) => {
  return (req, res, next) => {
    // Ensure req.user and req.user.role exist
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'Not authorized, no user role found' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: You do not have the required role.' });
    }
    next();
  };
};

module.exports = roleAccess;