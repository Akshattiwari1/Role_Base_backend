const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

// @desc    Place a new order
// @route   POST /api/orders
// @access  Private/Buyer
const placeOrder = async (req, res) => {
  const { items, totalAmount, enterpriseId } = req.body;
  const buyerId = req.user._id;

  if (!items || items.length === 0 || !totalAmount || !enterpriseId) {
    return res.status(400).json({ message: 'Order must contain items, total amount, and an enterprise ID.' });
  }

  try {
    const enterprise = await User.findById(enterpriseId);
    if (!enterprise || enterprise.role !== 'enterprise' || enterprise.enterpriseStatus !== 'approved') {
        return res.status(400).json({ message: 'Invalid or unapproved enterprise for this order.' });
    }

    for (const orderItem of items) {
      const product = await Product.findById(orderItem.productId);

      if (!product) {
        return res.status(404).json({ message: `Product not found: ${orderItem.name}` });
      }

      if (product.enterprise.toString() !== enterpriseId.toString()) {
          return res.status(400).json({ message: `Product ${product.name} does not belong to the selected enterprise.` });
      }

      const requestedQuantity = orderItem.quantity;
      const assignedWarehouseName = orderItem.assignedWarehouse;

      if (!assignedWarehouseName) {
          return res.status(400).json({ message: `No warehouse assigned for product: ${orderItem.name}` });
      }

      const warehouseIndex = product.warehouses.findIndex(wh => wh.warehouseName === assignedWarehouseName);

      if (warehouseIndex === -1 || product.warehouses[warehouseIndex].stockLevel < requestedQuantity) {
        return res.status(400).json({ message: `Insufficient stock for ${orderItem.name} in ${assignedWarehouseName}.` });
      }

      product.warehouses[warehouseIndex].stockLevel -= requestedQuantity;
      await product.save();
    }

    const order = await Order.create({
      buyer: buyerId,
      enterprise: enterpriseId,
      items: items,
      totalAmount,
      status: 'pending', // Orders placed by buyers start as 'pending' for enterprise approval
    });

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all orders for the authenticated buyer
// @route   GET /api/orders/my-orders
// @access  Private/Buyer
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user._id })
      .populate('items.productId', 'name price')
      .populate('enterprise', 'name');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all orders for the authenticated enterprise's products
// @route   GET /api/orders/enterprise-orders
// @access  Private/Enterprise
const getEnterpriseOrders = async (req, res) => {
  try {
    const orders = await Order.find({ enterprise: req.user._id })
      .populate('buyer', 'name email')
      .populate('items.productId', 'name price');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update order status (by Enterprise or Admin)
// @route   PUT /api/orders/:id/status
// @access  Private/Enterprise, Admin
const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status, items: updatedItems } = req.body;

  try {
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (req.user.role === 'enterprise' && order.enterprise.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }

    // Enterprise can only approve/reject, Admin can set other statuses
    if (req.user.role === 'enterprise' && !['approved', 'rejected'].includes(status)) {
        return res.status(403).json({ message: 'Enterprises can only approve or reject orders.' });
    }
    if (req.user.role === 'admin' && !['approved', 'rejected', 'shipped', 'delivered', 'cancelled'].includes(status)) {
        return res.status(403).json({ message: 'Invalid status for admin update.' });
    }


    if (status === 'approved' && req.user.role === 'enterprise') {
        if (!updatedItems || updatedItems.length === 0) {
            return res.status(400).json({ message: 'Approved orders must specify assigned warehouses for each item.' });
        }

        for (const updatedItem of updatedItems) {
            const orderItem = order.items.id(updatedItem._id);
            if (!orderItem) {
                return res.status(404).json({ message: `Item with ID ${updatedItem._id} not found in order.` });
            }
            if (!updatedItem.assignedWarehouse) {
                return res.status(400).json({ message: `Warehouse not assigned for item: ${orderItem.name}` });
            }
            orderItem.assignedWarehouse = updatedItem.assignedWarehouse;
        }
    } else if (status === 'rejected' && order.status === 'pending') {
        // If order was pending and now rejected, revert stock (already deducted when buyer placed)
        // This logic is tricky. If stock is deducted on `placeOrder`, it means it's "reserved".
        // If enterprise rejects, that stock needs to go back.
        // Let's assume stock is deducted on `placeOrder` and put back on `reject`.
        for (const orderItem of order.items) {
            const product = await Product.findById(orderItem.productId);
            if (product) {
                const warehouseIndex = product.warehouses.findIndex(wh => wh.warehouseName === orderItem.assignedWarehouse);
                if (warehouseIndex !== -1) {
                    product.warehouses[warehouseIndex].stockLevel += orderItem.quantity;
                    await product.save();
                }
            }
        }
    }


    order.status = status;
    await order.save();

    res.json({ message: `Order status updated to ${status}`, order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all orders (Admin view)
// @route   GET /api/orders/all
// @access  Private/Admin
const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate('buyer', 'name email')
      .populate('enterprise', 'name email')
      .populate('items.productId', 'name price');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  placeOrder,
  getMyOrders,
  getEnterpriseOrders,
  updateOrderStatus,
  getAllOrders,
};