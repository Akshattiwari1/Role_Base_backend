const Product = require('../models/Product');
const User = require('../models/User');

// @desc    Add a new product
// @route   POST /api/products
// @access  Private/Enterprise (approved only)
const addProduct = async (req, res) => {
  const { name, description, price, warehouses } = req.body;
  const enterpriseId = req.user._id;

  if (!name || !description || !price || !warehouses || warehouses.length === 0) {
    return res.status(400).json({ message: 'Please enter all required product fields including at least one warehouse.' });
  }

  const invalidWarehouses = warehouses.some(wh => !wh.warehouseName || typeof wh.stockLevel !== 'number' || wh.stockLevel < 0);
  if (invalidWarehouses) {
      return res.status(400).json({ message: 'Each warehouse must have a name and a valid stock level (non-negative number).' });
  }

  try {
    const enterpriseUser = await User.findById(enterpriseId);
    if (!enterpriseUser || enterpriseUser.role !== 'enterprise' || enterpriseUser.enterpriseStatus !== 'approved') {
      return res.status(403).json({ message: 'You must be an approved enterprise to add products.' });
    }

    const product = await Product.create({
      name,
      description,
      price,
      enterprise: enterpriseId,
      warehouses,
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all products (Admin view, also used by Buyer to filter approved)
// @route   GET /api/products/all
// @access  Private/Admin, Buyer (frontend filters for approved enterprises)
const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({}).populate('enterprise', 'name email enterpriseStatus');
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get products by a specific enterprise
// @route   GET /api/products/enterprise/:enterpriseId
// @access  Private (accessible by Admin, Enterprise, Buyer)
const getProductsByEnterprise = async (req, res) => {
  const { enterpriseId } = req.params;

  try {
    const enterpriseUser = await User.findById(enterpriseId);
    if (!enterpriseUser || enterpriseUser.role !== 'enterprise') {
      return res.status(404).json({ message: 'Enterprise not found' });
    }

    // Only show products from 'approved' enterprises to buyers
    if (req.user.role === 'buyer' && enterpriseUser.enterpriseStatus !== 'approved') {
        return res.status(403).json({ message: 'This enterprise account is not yet approved or is blocked.' });
    }
    
    const products = await Product.find({ enterprise: enterpriseId }).populate('enterprise', 'name');
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Enterprise (approved only)
const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, description, price, warehouses, isAvailable } = req.body;
  const enterpriseId = req.user._id;

  try {
    let product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.enterprise.toString() !== enterpriseId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this product' });
    }

    product.name = name || product.name;
    product.description = description || product.description;
    product.price = price !== undefined ? price : product.price;
    product.warehouses = warehouses !== undefined ? warehouses : product.warehouses;
    product.isAvailable = isAvailable !== undefined ? isAvailable : product.isAvailable;

    const invalidWarehouses = product.warehouses.some(wh => !wh.warehouseName || typeof wh.stockLevel !== 'number' || wh.stockLevel < 0);
    if (invalidWarehouses) {
        return res.status(400).json({ message: 'Each warehouse must have a name and a valid stock level (non-negative number).' });
    }

    product = await product.save();
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Enterprise (approved only)
const deleteProduct = async (req, res) => {
  const { id } = req.params;
  const enterpriseId = req.user._id;

  try {
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.enterprise.toString() !== enterpriseId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this product' });
    }

    await Product.deleteOne({ _id: id });
    res.json({ message: 'Product removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  addProduct,
  getAllProducts,
  getProductsByEnterprise,
  updateProduct,
  deleteProduct,
};
