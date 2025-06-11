// backend/routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User'); // Used for populating buyer/enterprise names
const { protect, authorize } = require('../middleware/authMiddleware');

// @desc    Place a new order
// @route   POST /api/orders
// @access  Private/Buyer
router.post('/', protect, authorize(['buyer']), async (req, res) => {
  const { items, totalAmount } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'No order items' });
  }

  try {
    const orderItems = [];
    let calculatedTotalAmount = 0;
    let enterpriseIdForOrder = null; // This will hold the ObjectId of the single enterprise for this order

    // Validate products and determine the single enterprise for the order
    for (const item of items) {
      const product = await Product.findById(item.product); // `item.product` is the product ID from frontend

      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.name || item.product}` });
      }

      // Check if product has an associated enterprise (critical for validation and order logic)
      if (!product.enterprise) {
          console.error(`Product ${product._id} (${product.name}) found, but has no associated enterprise.`);
          return res.status(500).json({ message: `Product "${product.name}" is missing enterprise information. Please contact support.` });
      }

      // Ensure all items in the order belong to the same enterprise
      if (!enterpriseIdForOrder) {
        enterpriseIdForOrder = product.enterprise.toString();
      } else if (enterpriseIdForOrder !== product.enterprise.toString()) {
        return res.status(400).json({ message: 'All items in one order must belong to the same enterprise.' });
      }

      // === CRUCIAL FIX: Provide productId and enterpriseId for each item, matching OrderItemSchema ===
      orderItems.push({
        productId: product._id,       // Maps to `productId` in orderItemSchema
        enterpriseId: product.enterprise, // Maps to `enterpriseId` in orderItemSchema
        name: product.name,
        quantity: item.quantity,
        priceAtOrder: product.price,
      });
      calculatedTotalAmount += product.price * item.quantity;
    }

    // Basic validation for total amount (optional, but good for security/accuracy)
    if (Math.abs(calculatedTotalAmount - totalAmount) > 0.01) {
      return res.status(400).json({ message: 'Calculated total amount does not match provided total amount.' });
    }

    // Create the order document
    const order = new Order({
      buyer: req.user.id, // User ID from the protect middleware
      enterprise: enterpriseIdForOrder, // Overall order enterprise ID
      items: orderItems, // Array of items, now conforming to orderItemSchema
      totalAmount,
    });

    const createdOrder = await order.save();
    res.status(201).json(createdOrder);

  } catch (error) {
    console.error('Error placing order:', error);
    // Provide a more descriptive error message if it's a Mongoose validation error
    const errorMessage = error.name === 'ValidationError'
      ? `Order validation failed: ${Object.values(error.errors).map(err => err.message).join(', ')}`
      : 'Server error placing order';
    res.status(500).json({ message: errorMessage });
  }
});

// @desc    Get buyer's own orders
// @route   GET /api/orders/my-orders
// @access  Private/Buyer
router.get('/my-orders', protect, authorize(['buyer']), async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user.id })
      .populate('items.productId', 'name description price') // Populate using productId
      .populate('items.enterpriseId', 'name') // Populate using enterpriseId
      .populate('enterprise', 'name') // Populate overall enterprise for order
      .sort({ orderDate: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching buyer orders:', error);
    res.status(500).json({ message: 'Server error fetching buyer orders' });
  }
});

// @desc    Get orders for enterprise's products
// @route   GET /api/orders/enterprise-orders
// @access  Private/Enterprise
router.get('/enterprise-orders', protect, authorize(['enterprise']), async (req, res) => {
  try {
    const orders = await Order.find({ enterprise: req.user.id })
      .populate('buyer', 'name email')
      .populate('items.productId', 'name description price') // Populate using productId
      .populate('items.enterpriseId', 'name') // Populate using enterpriseId
      .sort({ orderDate: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching enterprise orders:', error);
    res.status(500).json({ message: 'Server error fetching enterprise orders' });
  }
});

// @desc    Get all orders (Admin only, with filtering)
// @route   GET /api/orders/all
// @access  Private/Admin
router.get('/all', protect, authorize(['admin']), async (req, res) => {
  try {
    const { buyerId, enterpriseId } = req.query;

    let filter = {};
    if (buyerId) {
      filter.buyer = buyerId;
    }
    if (enterpriseId) {
      filter.enterprise = enterpriseId;
    }

    const orders = await Order.find(filter)
      .populate('buyer', 'name email')
      .populate('enterprise', 'name')
      .populate('items.productId', 'name description price') // Populate using productId
      .populate('items.enterpriseId', 'name') // Populate using enterpriseId
      .sort({ orderDate: -1 });

    res.json(orders);
  } catch (error) {
    console.error('Error fetching all orders (admin):', error);
    res.status(500).json({ message: 'Server error fetching all orders' });
  }
});


// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Enterprise or Admin
router.put('/:id/status', protect, async (req, res) => {
  const { id } = req.params;
  const { status, items: updatedItems } = req.body;

  try {
    // Populate `items.productId` to get product details needed for stock update
    const order = await Order.findById(id).populate('items.productId');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Role-based authorization for status changes
    if (req.user.role === 'enterprise') {
      // Ensure the enterprise can only manage orders for their own products
      if (order.enterprise.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to manage this order' });
      }
      if (status === 'approved') {
        if (!updatedItems || updatedItems.length === 0 || updatedItems.some(item => !item.assignedWarehouse || item.assignedWarehouse === '')) {
            return res.status(400).json({ message: 'Assigned warehouses are required for all items before approval.' });
        }
        for (const updatedItem of updatedItems) {
            const orderItem = order.items.find(item => item._id.toString() === updatedItem._id);

            if (orderItem) {
                // Use orderItem.productId directly as it's populated
                const product = await Product.findById(orderItem.productId._id);
                if (!product) {
                    throw new Error(`Product not found for item ${orderItem.name}`);
                }

                orderItem.assignedWarehouse = updatedItem.assignedWarehouse;

                const warehouseToUpdate = product.warehouses.find(
                    wh => wh.warehouseName === updatedItem.assignedWarehouse
                );

                if (warehouseToUpdate) {
                    if (warehouseToUpdate.stockLevel >= orderItem.quantity) {
                        warehouseToUpdate.stockLevel -= orderItem.quantity;
                    } else {
                        return res.status(400).json({ message: `Insufficient stock for ${orderItem.name} in warehouse '${warehouseToUpdate.warehouseName}'. Available: ${warehouseToUpdate.stockLevel}, Needed: ${orderItem.quantity}` });
                    }
                } else {
                    return res.status(400).json({ message: `Warehouse '${updatedItem.assignedWarehouse}' not found for product ${product.name}. Please ensure the warehouse exists.` });
                }
                await product.save();
            }
        }
        order.status = status;
      } else if (status === 'rejected') {
        order.status = status;
      } else {
        return res.status(400).json({ message: 'Invalid status for enterprise update. Only "approved" or "rejected" allowed.' });
      }
    } else if (req.user.role === 'admin') {
      const validAdminStatuses = ['shipped', 'delivered', 'cancelled'];
      if (!validAdminStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status for admin update. Only "shipped", "delivered", or "cancelled" allowed.' });
      }
      order.status = status;
    } else {
      return res.status(403).json({ message: 'Not authorized to change order status' });
    }

    const updatedOrder = await order.save();
    res.json({ message: `Order status updated to ${updatedOrder.status}`, order: updatedOrder });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: error.message || 'Server error updating order status' });
  }
});


module.exports = router;