const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product'); // Make sure to import Product model
const User = require('../models/User');     // Make sure to import User model for populating buyer/enterprise names if needed by admin route
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
    // Basic validation: Check if products exist and if buyer has enough balance (optional, but good practice)
    const orderItems = [];
    let calculatedTotalAmount = 0;
    let enterpriseIdForOrder = null; // Assuming an order is placed for products from a single enterprise for simplicity

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.name}` });
      }

      // Check if enterprise is assigned (all products in one order must be from the same enterprise)
      if (!enterpriseIdForOrder) {
        enterpriseIdForOrder = product.enterprise.toString();
      } else if (enterpriseIdForOrder !== product.enterprise.toString()) {
        return res.status(400).json({ message: 'All items in one order must belong to the same enterprise.' });
      }

      orderItems.push({
        product: product._id,
        name: product.name,
        quantity: item.quantity,
        priceAtOrder: product.price, // Store price at the time of order
      });
      calculatedTotalAmount += product.price * item.quantity;
    }

    if (Math.abs(calculatedTotalAmount - totalAmount) > 0.01) { // Floating point comparison
      return res.status(400).json({ message: 'Calculated total amount does not match provided total amount.' });
    }

    const order = new Order({
      buyer: req.user.id,
      enterprise: enterpriseIdForOrder, // Assign the enterprise for the order
      items: orderItems,
      totalAmount,
    });

    const createdOrder = await order.save();
    res.status(201).json(createdOrder);
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ message: 'Server error placing order' });
  }
});

// @desc    Get buyer's own orders
// @route   GET /api/orders/my-orders
// @access  Private/Buyer
router.get('/my-orders', protect, authorize(['buyer']), async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user.id })
      .populate('items.product', 'name description price') // Populate product details for items
      .populate('enterprise', 'name') // Populate enterprise name
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
      .populate('buyer', 'name email') // Populate buyer info
      .populate('items.product', 'name description price') // Populate product details for items
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
    const { buyerId, enterpriseId } = req.query; // Get filter parameters from query

    let filter = {};
    if (buyerId) {
      filter.buyer = buyerId;
    }
    if (enterpriseId) {
      filter.enterprise = enterpriseId;
    }

    const orders = await Order.find(filter)
      .populate('buyer', 'name email') // Populate buyer info
      .populate('enterprise', 'name')  // Populate enterprise info
      .populate('items.product', 'name description price') // Populate product details for items
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
  const { status, items: updatedItems } = req.body; // updatedItems will be present when enterprise approves

  try {
    const order = await Order.findById(id).populate('items.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Role-based authorization for status changes
    if (req.user.role === 'enterprise') {
      // Enterprise can only approve/reject their own product's orders
      if (order.enterprise.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to manage this order' });
      }
      if (status === 'approved') {
        if (!updatedItems || updatedItems.length === 0 || updatedItems.some(item => !item.assignedWarehouse || item.assignedWarehouse === '')) {
            return res.status(400).json({ message: 'Assigned warehouses are required for all items before approval.' });
        }
        // Deduct stock and assign warehouses for each item
        for (const updatedItem of updatedItems) {
            const orderItem = order.items.find(item => item._id.toString() === updatedItem._id);

            if (orderItem) {
                // Find the product and update its stock in the relevant warehouse
                const product = await Product.findById(orderItem.product._id);
                if (!product) {
                    throw new Error(`Product not found for item ${orderItem.name}`);
                }

                // Update the assignedWarehouse in the order item itself
                orderItem.assignedWarehouse = updatedItem.assignedWarehouse;

                // Find the specific warehouse in the product's warehouses array
                const warehouseToUpdate = product.warehouses.find(
                    wh => wh.warehouseName === updatedItem.assignedWarehouse
                );

                if (warehouseToUpdate) {
                    if (warehouseToUpdate.stockLevel >= orderItem.quantity) {
                        warehouseToUpdate.stockLevel -= orderItem.quantity;
                    } else {
                        // If stock isn't sufficient for some reason, roll back or error
                        // You might want a more sophisticated rollback here or prevent approval if stock is low
                        return res.status(400).json({ message: `Insufficient stock for ${orderItem.name} in warehouse '${warehouseToUpdate.warehouseName}'. Available: ${warehouseToUpdate.stockLevel}, Needed: ${orderItem.quantity}` });
                    }
                } else {
                    return res.status(400).json({ message: `Warehouse '${updatedItem.assignedWarehouse}' not found for product ${product.name}. Please ensure the warehouse exists.` });
                }
                await product.save(); // Save the updated product with new stock level
            }
        }
        order.status = status; // Set order status to approved
      } else if (status === 'rejected') {
        order.status = status;
      } else {
        return res.status(400).json({ message: 'Invalid status for enterprise update. Only "approved" or "rejected" allowed.' });
      }
    } else if (req.user.role === 'admin') {
      // Admin can change status to shipped, delivered, cancelled
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