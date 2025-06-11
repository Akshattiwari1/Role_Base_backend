const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'enterprise', 'buyer'],
    required: true // Added required true to ensure role is set
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  enterpriseStatus: { // Added for enterprise approval workflow
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: function() {
      // Set to 'pending' by default only if the role is 'enterprise'
      return this.role === 'enterprise' ? 'pending' : undefined;
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);