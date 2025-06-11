const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register User
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Basic validation for role
    if (!role || !['admin', 'enterprise', 'buyer'].includes(role)) {
        return res.status(400).json({ message: 'Invalid or missing role. Role must be "admin", "enterprise", or "buyer".' });
    }

    const existingUser = await User.findOne({ $or: [{ name }, { email }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User with that name or email already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, role });

    res.status(201).json({ message: `Registered successfully: ${name}. Role: ${role}.` + (role === 'enterprise' ? ' Awaiting admin approval.' : '') });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ message: 'Something went wrong during registration.' });
  }
};

// Login User
exports.login = async (req, res) => {
  try {
    const { name, password } = req.body;

    const user = await User.findOne({ name });
    if (!user) {
      return res.status(404).json({ message: `User with name ${name} not found` });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account has been blocked. Please contact support.' });
    }

    // For enterprises, check if they are approved
    if (user.role === 'enterprise' && user.enterpriseStatus !== 'approved') {
        return res.status(403).json({ message: `Your enterprise account is currently ${user.enterpriseStatus}. Please wait for admin approval.` });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({ token, role: user.role, name: user.name }); // Also return role and name for client-side use
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: 'Login failed due to server error' });
  }
};