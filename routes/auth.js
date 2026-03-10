/**
 * Customer Authentication Routes
 * Verifies customer identity using customerId + phone last 4 digits.
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');

/**
 * POST /api/auth/verify
 * Authenticate customer with customerId + phone last 4 digits
 */
router.post('/verify', async (req, res, next) => {
    try {
        const { customerId, phoneLast4 } = req.body;

        if (!customerId || !phoneLast4) {
            return res.status(400).json({
                success: false,
                message: 'Customer ID and phone last 4 digits are required.'
            });
        }

        if (!/^\d{4}$/.test(phoneLast4)) {
            return res.status(400).json({
                success: false,
                message: 'Phone last 4 digits must be exactly 4 numbers.'
            });
        }

        const customer = await Customer.findOne({ customerId });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found.'
            });
        }

        // Check if diagnosis is published
        if (customer.meta.status !== 'completed') {
            return res.status(403).json({
                success: false,
                message: 'Diagnosis results are not yet available.'
            });
        }

        // Extract last 4 digits from stored phone (strip non-digits)
        const storedDigits = customer.customerInfo.phone.replace(/\D/g, '');
        const storedLast4 = storedDigits.slice(-4);

        if (phoneLast4 !== storedLast4) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials.'
            });
        }

        // Issue JWT
        const token = jwt.sign(
            { customerId: customer.customerId },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.json({
            success: true,
            token,
            customer: {
                name: customer.customerInfo.name,
                customerId: customer.customerId
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
