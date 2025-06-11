// backend/models/Product.js
const mongoose = require('mongoose');

const productSchema = mongoose.Schema(
  {
    // Link to the Enterprise (User) who owns this product
    enterprise: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User', // Refers to the 'User' model (where your 'enterprise' role users are stored)
    },
    name: {
      type: String,
      required: true,
      trim: true, // Removes whitespace from both ends of a string
      maxlength: 100, // Example max length
    },
    description: {
      type: String,
      required: true,
      maxlength: 500, // Example max length
    },
    price: {
      type: Number,
      required: true,
      min: 0, // Price cannot be negative
      default: 0,
    },
    // Array of warehouses and their respective stock levels
    warehouses: [
      {
        warehouseName: {
          type: String,
          required: true,
          trim: true,
        },
        stockLevel: {
          type: Number,
          required: true,
          min: 0, // Stock level cannot be negative
          default: 0,
        },
      },
    ],
    isAvailable: {
      type: Boolean,
      default: true, // Whether the product is currently available for purchase
    },
    // You can add more fields here like imageUrl, category, etc.
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

// Method to calculate total stock across all warehouses (optional, but useful)
productSchema.methods.getTotalStock = function() {
    return this.warehouses.reduce((total, warehouse) => total + warehouse.stockLevel, 0);
};

module.exports = mongoose.model('Product', productSchema);