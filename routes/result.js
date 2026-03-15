/**
 * Result Routes
 * Returns customer diagnosis data with GCS presigned URLs.
 */
const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const authCustomer = require('../middleware/authCustomer');
const { bucket, GCS_CONFIG } = require('../config/gcs');

/**
 * Extract GCS key from a presigned URL (has ?X-Goog- query params).
 * Returns null for non-presigned URLs.
 */
function extractGcsKey(url) {
    if (!url.includes('?X-Goog-')) return null;
    const match = url.match(/^https:\/\/storage\.googleapis\.com\/[^/]+\/(.+?)\?/);
    return match ? match[1] : null;
}

/**
 * Recursively walk an object and collect all GCS keys.
 * Also extracts keys from expired presigned URLs (legacy DB data).
 * Skips direct GCS URLs without query params (different buckets, may be public).
 */
function collectGcsKeys(obj, keys = []) {
    if (!obj || typeof obj !== 'object') return keys;

    for (const [key, val] of Object.entries(obj)) {
        if (typeof val === 'string' && val && val.includes('/')) {
            if (val.startsWith('data:') || val.startsWith('#')) {
                // skip
            } else if (val.startsWith('https://storage.googleapis.com/') && val.includes('?X-Goog-')) {
                const extracted = extractGcsKey(val);
                if (extracted) keys.push(extracted);
            } else if (!val.startsWith('http')) {
                keys.push(val);
            }
        } else if (Array.isArray(val)) {
            val.forEach(item => {
                if (typeof item === 'string' && item && item.includes('/')) {
                    if (item.startsWith('data:') || item.startsWith('#')) {
                        // skip
                    } else if (item.startsWith('https://storage.googleapis.com/') && item.includes('?X-Goog-')) {
                        const extracted = extractGcsKey(item);
                        if (extracted) keys.push(extracted);
                    } else if (!item.startsWith('http')) {
                        keys.push(item);
                    }
                } else if (typeof item === 'object') {
                    collectGcsKeys(item, keys);
                }
            });
        } else if (typeof val === 'object') {
            collectGcsKeys(val, keys);
        }
    }
    return keys;
}

/**
 * Convert GCS keys to presigned view URLs in batch.
 */
async function resolveGcsUrls(gcsKeys) {
    const urlMap = {};
    if (!gcsKeys.length) return urlMap;

    const uniqueKeys = [...new Set(gcsKeys)];
    const results = await Promise.allSettled(
        uniqueKeys.map(async (key) => {
            const file = bucket.file(key);
            const [url] = await file.getSignedUrl({
                version: 'v4',
                action: 'read',
                expires: Date.now() + GCS_CONFIG.viewExpires * 1000
            });
            return { key, url };
        })
    );

    results.forEach(result => {
        if (result.status === 'fulfilled') {
            urlMap[result.value.key] = result.value.url;
        }
    });

    return urlMap;
}

/**
 * GET /api/result/:customerId
 * Get full diagnosis result with resolved image URLs.
 */
router.get('/:customerId', authCustomer, async (req, res, next) => {
    try {
        const { customerId } = req.params;

        // Ensure the JWT customerId matches the requested customerId
        if (req.customerId !== customerId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied.'
            });
        }

        const customer = await Customer.findOne({ customerId }).select('-__v -aiDiagnosis.rawGeminiResponse').lean();

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found.'
            });
        }

        if (customer.meta.status !== 'completed') {
            return res.status(403).json({
                success: false,
                message: 'Diagnosis results are not yet available.'
            });
        }

        // Collect all GCS keys from customer data
        const gcsKeys = collectGcsKeys({
            customerPhotos: customer.customerPhotos,
            colorDiagnosis: customer.colorDiagnosis,
            faceAnalysis: customer.faceAnalysis,
            bodyAnalysis: customer.bodyAnalysis,
            styling: customer.styling
        });

        // Resolve GCS keys to presigned URLs
        const imageUrls = await resolveGcsUrls(gcsKeys);

        res.json({
            success: true,
            data: {
                customerInfo: {
                    name: customer.customerInfo.name,
                    gender: customer.customerInfo.gender
                },
                customerPhotos: customer.customerPhotos,
                colorDiagnosis: customer.colorDiagnosis,
                faceAnalysis: customer.faceAnalysis,
                bodyAnalysis: customer.bodyAnalysis,
                styling: customer.styling
            },
            imageUrls
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
