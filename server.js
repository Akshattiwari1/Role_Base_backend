// backend/server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Import your route files (ensure these paths are correct)
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');

dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:3000', 'https://role-base-frountend.vercel.app'], // Removed trailing slash from Vercel URL, though it often doesn't matter much.
    credentials: true
}));

// Define API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

// Catch-all route for unmatched API requests
app.use((req, res, next) => {
    res.status(404).json({ message: `API endpoint not found: ${req.originalUrl}` });
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});