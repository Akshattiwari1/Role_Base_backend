// backend/routes/adminRoutes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Assuming you have a User model
const Product = require('../models/Product'); // For dashboard stats
const Order = require('../models/Order');     // For dashboard stats
const { protect, authorize } = require('../middleware/authMiddleware'); // Your authentication/authorization middleware
const asyncHandler = require('express-async-handler'); // For handling async errors in middleware/routes

// --- User Management Routes ---

// @desc    Get all users (buyers and enterprises)
// @route   GET /api/admin/users
// @access  Private/Admin
router.get('/users', protect, authorize(['admin']), asyncHandler(async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ['buyer', 'enterprise', 'admin'] } }).select('-password'); // Include admin for comprehensive list
    res.json(users);
  } catch (error) {
    console.error('Error fetching users for admin:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
}));

// @desc    Update user status (e.g., approve/reject enterprise, block user)
// @route   PUT /api/admin/users/:id/status  <-- CORRECTED ROUTE
// @access  Private/Admin
router.put('/users/:id/status', protect, authorize(['admin']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { enterpriseStatus, isBlocked } = req.body;

  try {
    const user = await User.findById(id);

    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // Prevent blocking an admin from admin interface itself for safety
    if (user.role === 'admin' && user._id.toString() !== req.user.id && isBlocked !== undefined) {
      res.status(403);
      throw new Error('Cannot block another admin user');
    }
    // Prevent admin from changing their own enterprise status if they somehow gain enterprise role
    if (user._id.toString() === req.user.id && enterpriseStatus !== undefined) {
      res.status(403);
      throw new Error('Cannot change your own enterprise status through this interface.');
    }


    if (enterpriseStatus !== undefined) {
        user.enterpriseStatus = enterpriseStatus;
    }
    if (isBlocked !== undefined) {
        user.isBlocked = isBlocked;
    }

    const updatedUser = await user.save();
    res.json({ message: 'User status updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ message: error.message || 'Server error updating user status' });
  }
}));


// --- Dashboard Statistics Route ---

// @desc    Get admin dashboard statistics
// @route   GET /api/admin/dashboard-stats
// @access  Private/Admin
router.get('/dashboard-stats', protect, authorize(['admin']), asyncHandler(async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();

    // Orders per enterprise
    const ordersPerEnterprise = await Order.aggregate([
      {
        $group: {
          _id: '$enterprise', // Group by enterprise ID
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      {
        $lookup: {
          from: 'users', // The collection name for Users (usually pluralized model name)
          localField: '_id',
          foreignField: '_id',
          as: 'enterpriseInfo'
        }
      },
      {
        $unwind: { path: '$enterpriseInfo', preserveNullAndEmptyArrays: true } // Use preserveNullAndEmptyArrays for cases where enterpriseInfo might be missing
      },
      {
        $project: {
          _id: 0,
          enterpriseId: '$_id',
          enterpriseName: '$enterpriseInfo.name', // Will be null if no info
          totalOrders: 1,
          totalAmount: 1
        }
      }
    ]);

    // Buyer activity (e.g., number of purchases per buyer)
    const buyerActivity = await Order.aggregate([
      {
        $group: {
          _id: '$buyer', // Group by buyer ID
          totalPurchases: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' }
        }
      },
      {
        $lookup: {
          from: 'users', // The collection name for Users
          localField: '_id',
          foreignField: '_id',
          as: 'buyerInfo'
        }
      },
      {
        $unwind: { path: '$buyerInfo', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          _id: 0,
          buyerId: '$_id',
          buyerName: '$buyerInfo.name', // Will be null if no info
          totalPurchases: 1,
          totalSpent: 1
        }
      }
    ]);

    res.json({
      totalProducts,
      totalOrders,
      ordersPerEnterprise,
      buyerActivity
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server error fetching dashboard statistics' });
  }
}));


module.exports = router;