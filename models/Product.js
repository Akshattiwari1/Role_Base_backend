const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
  warehouseName: {
    type: String,
    required: true,
  },
  stockLevel: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  }
});

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  enterprise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Refers to the User model
    required: true,
  },
  warehouses: [warehouseSchema], // Array of warehouses with stock levels
  isAvailable: { // Could be used to quickly toggle product visibility
    type: Boolean,
    default: true,
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Product', ProductSchema);