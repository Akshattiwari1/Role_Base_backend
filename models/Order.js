// backend/models/Order.js
const mongoose = require('mongoose');

// Define the schema for individual items within an order
const orderItemSchema = mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product', // Reference to the Product model
    required: true, // This field is required
  },
  enterpriseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Assuming enterprises are also users (role: 'enterprise')
    required: true, // This field is required
  },
  name: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  priceAtOrder: {
    type: Number,
    required: true,
  },
  // Optional: For enterprises to assign a warehouse for fulfillment
  assignedWarehouse: {
    type: String,
    default: '', // Can be empty initially
  }
}, {
  _id: true // Mongoose will automatically generate _id for each subdocument (item)
});

// Define the main Order schema
const orderSchema = mongoose.Schema({
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the User model (the buyer)
    required: true,
  },
  enterprise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the User model (the enterprise whose product was bought)
    required: true,
  },
  items: [orderItemSchema], // Array of order items using the defined schema
  totalAmount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
  },
  orderDate: {
    type: Date,
    default: Date.now,
  },
  // Optional fields for payment and shipping details
  paymentInfo: {
    method: { type: String },
    status: { type: String }
  },
  shippingAddress: {
    address: { type: String },
    city: { type: String },
    postalCode: { type: String },
    country: { type: String }
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields automatically
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;