// backend/middlewares/roleMiddleware.js
const authorize = (...roles) => {
    return (req, res, next) => {
        // req.user should be set by the 'protect' middleware
        if (!req.user || !req.user.role) {
            return res.status(401).json({ message: 'Not authorized, user role missing.' });
        }

        // Check if the user's role is in the allowed roles list
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied: You do not have the required role.' });
        }
        next();
    };
};

module.exports = authorize; // Exporting directly