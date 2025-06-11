const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      console.log("Decoded user:", req.user.name, req.user.role); // Log more user details
      next();
    } catch (err) {
      console.error("Token verification failed:", err); // Log the actual error
      return res.status(400).json({ message: "Token is not valid" });
    }
  } else {
    return res.status(401).json({ message: "Authorization header missing or malformed" });
  }
};

module.exports = protect;