const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middlewares/authMiddleware'); // Correct import: singular 'middleware'
const {
  addProduct,
  getAllProducts,
  getProductsByEnterprise,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');

// Enterprise only
router.post('/', protect, authorizeRoles('enterprise'), addProduct);
router.put('/:id', protect, authorizeRoles('enterprise'), updateProduct);
router.delete('/:id', protect, authorizeRoles('enterprise'), deleteProduct);

// Admin only (to view all products, including those from pending enterprises)
router.get('/all', protect, authorizeRoles('admin'), getAllProducts);

// Accessible by Admin, Enterprise (for their own), Buyer (for approved enterprises)
router.get('/enterprise/:enterpriseId', protect, authorizeRoles('admin', 'enterprise', 'buyer'), getProductsByEnterprise);

module.exports = router;