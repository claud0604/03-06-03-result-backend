/**
 * APL IMAGE - Result Page Backend Server
 * Port: 3063
 * Shares MongoDB (01-custinfo) with cust-info and expert backends.
 * Uses Google Cloud Storage for presigned view URLs.
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const { bucket, GCS_CONFIG } = require('./config/gcs');
const errorHandler = require('./middleware/errorHandler');

const authRouter = require('./routes/auth');
const resultRouter = require('./routes/result');
const notifyRouter = require('./routes/notify');

const app = express();
const PORT = process.env.PORT || 3063;

// MongoDB connection
connectDB();

// GCS connection check
const checkGCSConnection = async () => {
    try {
        const [exists] = await bucket.exists();
        if (exists) {
            console.log(`GCS connected: ${GCS_CONFIG.bucket}`);
        } else {
            console.error(`GCS bucket not found: ${GCS_CONFIG.bucket}`);
        }
    } catch (error) {
        console.error('GCS connection failed:', error.message);
    }
};
checkGCSConnection();

// CORS
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (origin.includes('localhost')) return callback(null, true);
        if (origin.endsWith('.pages.dev')) return callback(null, true);
        if (origin.endsWith('.apls.kr')) return callback(null, true);
        callback(new Error('Blocked by CORS policy.'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// Request logging (development)
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
        next();
    });
}

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'result-backend',
        timestamp: new Date().toISOString()
    });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/result', resultRouter);
app.use('/api/notify', notifyRouter);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Resource not found.'
    });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    console.log(`Result backend running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
