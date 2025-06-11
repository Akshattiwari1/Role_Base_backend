const User = require('../models/User');

// @desc    Get all users (for admin dashboard)
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update an enterprise's status (pending, approved, rejected)
// @route   PUT /api/admin/enterprise/:id/status
// @access  Private/Admin
const updateEnterpriseStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'pending', 'approved', 'rejected'

  try {
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'enterprise') {
      return res.status(400).json({ message: 'User is not an enterprise account' });
    }

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    user.enterpriseStatus = status;
    await user.save();

    res.json({
      message: `Enterprise status updated to ${status}`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        enterpriseStatus: user.enterpriseStatus,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Toggle user block status (admin can block/unblock any non-admin user)
// @route   PUT /api/admin/user/:id/block
// @access  Private/Admin
const toggleUserBlock = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Admin cannot block other admins or themselves
    if (user.role === 'admin' || user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: 'Cannot block an admin user or yourself.' });
    }

    user.isBlocked = !user.isBlocked; // Toggle the block status
    await user.save();

    res.json({
      message: `User ${user.name} block status toggled to ${user.isBlocked ? 'Blocked' : 'Unblocked'}`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isBlocked: user.isBlocked,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllUsers,
  updateEnterpriseStatus,
  toggleUserBlock,
};
