// backend/server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors'); // Import cors middleware
const connectDB = require('./config/db'); // Your database connection file
const { errorHandler } = require('./middleware/errorMiddleware'); // Your error handling middleware

// Import your route files
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');

// Load environment variables from .env file
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware to parse JSON bodies from incoming requests
app.use(express.json());

// CORS configuration
// Allow requests from your frontend development server and Render deployment
// IMPORTANT: Replace 'https://your-frontend-render-url.onrender.com' with your actual deployed frontend URL on Render.
app.use(cors({
    origin: ['http://localhost:3000', 'https://your-frontend-render-url.onrender.com'],
    credentials: true // Allow sending cookies/auth headers
}));

// Define API routes
// Each route file handles a specific set of API endpoints
app.use('/api/auth', authRoutes);         // Handles registration, login, profile
app.use('/api/admin', adminRoutes);       // Handles admin-specific tasks like user management, dashboard stats
app.use('/api/products', productRoutes);  // Handles product creation, retrieval, updates, deletion
app.use('/api/orders', orderRoutes);      // Handles order placement, viewing, status updates

// Catch-all route for unmatched API requests (optional, but good for clarity)
app.use((req, res, next) => {
    res.status(404).json({ message: `API endpoint not found: ${req.originalUrl}` });
});

// Error handling middleware (should be placed after all routes)
// This will catch any errors thrown by your routes/middleware and send a formatted response
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});