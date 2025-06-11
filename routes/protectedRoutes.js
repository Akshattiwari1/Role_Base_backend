// backend/routes/protectedRoutes.js
const express = require('express');
const protect = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/admin-resource', protect, authorize('admin'), (req, res) => {
  res.json({ message: 'Welcome to the Admin Protected Resource!', user: req.user });
});

router.get('/enterprise-resource', protect, authorize('enterprise'), (req, res) => {
  res.json({ message: 'Welcome to the Enterprise Protected Resource!', user: req.user });
});

router.get('/buyer-resource', protect, authorize('buyer'), (req, res) => {
  res.json({ message: 'Welcome to the Buyer Protected Resource!', user: req.user });
});

router.get('/any-authenticated', protect, (req, res) => {
  res.json({ message: 'Welcome, any authenticated user!', user: req.user });
});

module.exports = router;