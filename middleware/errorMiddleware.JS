// backend/middleware/errorMiddleware.js

const errorHandler = (err, req, res, next) => {
    // Determine the status code: if it's 200 (OK), it means an error occurred
    // but the status wasn't explicitly set, so default to 500 (Internal Server Error).
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);

    // Send a JSON response with the error message.
    // In production, we typically don't send the full stack trace for security reasons.
    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = {
    errorHandler, // Export the errorHandler function as a named export
};