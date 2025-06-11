// backend/routes/productRoutes.js
const express = require('express');
const router = express.Router();
const Product = require('../models/Product'); // Assuming you have a Product model
const { protect, authorize } = require('../middleware/authMiddleware'); // Assuming your auth middleware

// @desc    Get all products (accessible to all authenticated users)
// @route   GET /api/products
// @access  Private (all authenticated roles: buyer, enterprise, admin)
router.get('/', protect, async (req, res) => {
  try {
    const products = await Product.find({ isAvailable: true })
      .populate('enterprise', 'name');
    res.json(products);
  } catch (error) {
    console.error('Error fetching all products:', error);
    res.status(500).json({ message: 'Server error fetching products' });
  }
});

// @desc    Get products for a specific enterprise (My Products)
// @route   GET /api/products/my-products
// @access  Private/Enterprise
router.get('/my-products', protect, authorize(['enterprise']), async (req, res) => {
  try {
    const products = await Product.find({ enterprise: req.user.id });
    res.json(products);
  } catch (error) {
    console.error('Error fetching enterprise products:', error);
    res.status(500).json({ message: 'Server error fetching enterprise products' });
  }
});

// @desc    Add a new product
// @route   POST /api/products
// @access  Private/Enterprise
router.post('/', protect, authorize(['enterprise']), async (req, res) => {
  const { name, description, price, warehouses } = req.body;

  if (!name || !description || !price || !warehouses || warehouses.length === 0) {
    return res.status(400).json({ message: 'Please enter all product fields including at least one warehouse.' });
  }

  try {
    const product = new Product({
      enterprise: req.user.id,
      name,
      description,
      price,
      warehouses,
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ message: 'Server error adding product' });
  }
});

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Enterprise
router.put('/:id', protect, authorize(['enterprise']), async (req, res) => {
  const { id } = req.params;
  const { name, description, price, warehouses, isAvailable } = req.body;

  try {
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Ensure the product belongs to the logged-in enterprise
    if (product.enterprise.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this product' });
    }

    product.name = name || product.name;
    product.description = description || product.description;
    product.price = price || product.price;
    product.warehouses = warehouses || product.warehouses;
    if (isAvailable !== undefined) {
        product.isAvailable = isAvailable;
    }

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Server error updating product' });
  }
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Enterprise
router.delete('/:id', protect, authorize(['enterprise']), async (req, res) => {
  const { id } = req.params;

  try {
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Ensure the product belongs to the logged-in enterprise
    if (product.enterprise.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this product' });
    }

    await product.deleteOne();
    res.json({ message: 'Product removed' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Server error deleting product' });
  }
});

module.exports = router;