const User = require('../models/User');

// --- Enterprise Management ---
exports.updateEnterpriseStatus = async (req, res) => {
  try {
    const { id } = req.params; // User ID
    const { status } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status provided. Must be "approved" or "rejected".' });
    }

    const enterprise = await User.findById(id);

    if (!enterprise) {
      return res.status(404).json({ message: 'Enterprise not found.' });
    }

    if (enterprise.role !== 'enterprise') {
      return res.status(400).json({ message: 'User is not an enterprise. Cannot change enterprise status.' });
    }

    enterprise.enterpriseStatus = status;
    await enterprise.save();

    res.status(200).json({ message: `Enterprise ${enterprise.name} status updated to ${status}.` });
  } catch (error) {
    console.error("Error updating enterprise status:", error);
    res.status(500).json({ message: 'Server error updating enterprise status.' });
  }
};

// --- User Blocking ---
exports.toggleUserBlock = async (req, res) => {
  try {
    const { id } = req.params; // User ID

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Admins cannot block other admins or themselves
    if (user.role === 'admin') {
        if (req.user && req.user.id.toString() === id) { // Check if admin is trying to block themselves
            return res.status(403).json({ message: 'You cannot block your own admin account.' });
        }
        return res.status(403).json({ message: 'Cannot block an admin account.' });
    }

    user.isBlocked = !user.isBlocked; // Toggle the block status
    await user.save();

    res.status(200).json({ message: `User ${user.name} block status updated to ${user.isBlocked ? 'Blocked' : 'Unblocked'}.` });
  } catch (error) {
    console.error("Error toggling user block status:", error);
    res.status(500).json({ message: 'Server error toggling user block status.' });
  }
};

// --- Get All Users (for admin to view and manage) ---
exports.getAllUsers = async (req, res) => {
    try {
        // Exclude password from the results
        const users = await User.find().select('-password');
        res.status(200).json(users);
    } catch (error) {
        console.error("Error fetching all users:", error);
        res.status(500).json({ message: 'Server error fetching users.' });
    }
};