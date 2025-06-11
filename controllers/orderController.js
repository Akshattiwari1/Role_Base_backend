// backend/controllers/orderController.js
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User'); // Ensure these are correctly imported

// @desc    Place a new order
// @route   POST /api/orders
// @access  Private/Buyer
const createOrder = async (req, res) => {
  const { items, totalAmount } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'No order items' });
  }

  try {
    const orderItems = [];
    let calculatedTotalAmount = 0;
    let enterpriseIdForOrder = null;

    for (const item of items) {
      const product = await Product.findById(item.product);

      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.name || item.product}` });
      }

      if (!product.enterprise) {
        console.error(`Product ${product._id} (${product.name}) found, but has no associated enterprise.`);
        return res.status(500).json({ message: `Product "${product.name}" is missing enterprise information. Please contact support.` });
      }

      if (!enterpriseIdForOrder) {
        enterpriseIdForOrder = product.enterprise.toString();
      } else if (enterpriseIdForOrder !== product.enterprise.toString()) {
        return res.status(400).json({ message: 'All items in one order must belong to the same enterprise.' });
      }

      orderItems.push({
        productId: product._id,
        enterpriseId: product.enterprise,
        name: product.name,
        quantity: item.quantity,
        priceAtOrder: product.price,
      });
      calculatedTotalAmount += product.price * item.quantity;
    }

    if (Math.abs(calculatedTotalAmount - totalAmount) > 0.01) {
      return res.status(400).json({ message: 'Calculated total amount does not match provided total amount.' });
    }

    const order = new Order({
      buyer: req.user.id,
      enterprise: enterpriseIdForOrder,
      items: orderItems,
      totalAmount,
    });

    const createdOrder = await order.save();
    res.status(201).json(createdOrder);

  } catch (error) {
    console.error('Error placing order:', error);
    const errorMessage = error.name === 'ValidationError'
      ? `Order validation failed: ${Object.values(error.errors).map(err => err.message).join(', ')}`
      : 'Server error placing order';
    res.status(500).json({ message: errorMessage });
  }
};

// @desc    Get buyer's own orders
// @route   GET /api/orders/my-orders
// @access  Private/Buyer
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user.id })
      .populate('items.productId', 'name description price')
      .populate('items.enterpriseId', 'name')
      .populate('enterprise', 'name')
      .sort({ orderDate: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching buyer orders:', error);
    res.status(500).json({ message: 'Server error fetching buyer orders' });
  }
};

// @desc    Get orders for enterprise's products
// @route   GET /api/orders/enterprise-orders
// @access  Private/Enterprise
const getEnterpriseOrders = async (req, res) => {
  try {
    const orders = await Order.find({ enterprise: req.user.id })
      .populate('buyer', 'name email')
      .populate('items.productId', 'name description price')
      .populate('items.enterpriseId', 'name')
      .populate('enterprise', 'name') // Add this for enterprise name on the order itself
      .sort({ orderDate: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching enterprise orders:', error);
    res.status(500).json({ message: 'Server error fetching enterprise orders' });
  }
};

// @desc    Get all orders (Admin only, with filtering)
// @route   GET /api/orders/all
// @access  Private/Admin
const getAllOrders = async (req, res) => {
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
      .populate('items.productId', 'name description price')
      .populate('items.enterpriseId', 'name')
      .sort({ orderDate: -1 });

    res.json(orders);
  } catch (error) {
    console.error('Error fetching all orders (admin):', error);
    res.status(500).json({ message: 'Server error fetching all orders' });
  }
};


// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Enterprise or Admin
const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status, items: updatedItems } = req.body;

  try {
    const order = await Order.findById(id).populate('items.productId');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const isAuthorized = req.user.role === 'admin' ||
                         (req.user.role === 'enterprise' && order.enterprise.toString() === req.user.id.toString());

    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }

    // Enterprise can only approve/reject, and needs warehouse info for approval
    if (req.user.role === 'enterprise') {
      if (status === 'approved') {
        if (!updatedItems || updatedItems.length === 0 || updatedItems.some(item => !item.assignedWarehouse || item.assignedWarehouse === '')) {
          return res.status(400).json({ message: 'Assigned warehouses are required for all items before approval.' });
        }
        for (const updatedItem of updatedItems) {
          const orderItem = order.items.find(item => item._id.toString() === updatedItem._id);
          if (orderItem) {
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
};

module.exports = {
  createOrder,
  getMyOrders,
  getEnterpriseOrders,
  getAllOrders,
  updateOrderStatus
};