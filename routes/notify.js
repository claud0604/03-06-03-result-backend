/**
 * Notification Routes
 * Send result page link to customer via email.
 */
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const Customer = require('../models/Customer');

// Create reusable transporter
let transporter = null;
function getTransporter() {
    if (!transporter && process.env.SMTP_USER && process.env.SMTP_PASS) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }
    return transporter;
}

/**
 * POST /api/notify/send
 * Send notification to customer with result page link.
 */
router.post('/send', async (req, res, next) => {
    try {
        const { customerId, channel } = req.body;

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: 'Customer ID is required.'
            });
        }

        const customer = await Customer.findOne({ customerId });
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found.'
            });
        }

        if (customer.meta.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot send notification: diagnosis is not published yet.'
            });
        }

        const resultUrl = `${process.env.RESULT_PAGE_URL || 'https://result-030603.apls.kr'}/?id=${customerId}`;
        const customerName = customer.customerInfo.name;
        const email = customer.customerInfo.email;

        // Email notification
        if (channel === 'email') {
            if (!email || email === '-') {
                return res.status(400).json({
                    success: false,
                    message: 'Customer does not have an email address.'
                });
            }

            const mailer = getTransporter();
            if (!mailer) {
                return res.status(503).json({
                    success: false,
                    message: 'Email service is not configured.'
                });
            }

            await mailer.sendMail({
                from: process.env.SMTP_FROM || 'APL COLOR <noreply@aplcolor.com>',
                to: email,
                subject: 'Your Personal Color Diagnosis Results are Ready!',
                html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                        <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">APL COLOR</h1>
                        <p style="color: #666; font-size: 14px; margin-bottom: 32px;">Personal Color & Style Diagnosis</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin-bottom: 32px;">
                        <p style="color: #333; font-size: 16px; line-height: 1.6;">
                            Hello <strong>${customerName}</strong>,
                        </p>
                        <p style="color: #333; font-size: 16px; line-height: 1.6;">
                            Your personal color and style diagnosis results are now ready!
                            Click the button below to view your results.
                        </p>
                        <div style="text-align: center; margin: 40px 0;">
                            <a href="${resultUrl}" style="background: #1a1a1a; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; display: inline-block;">
                                View My Results
                            </a>
                        </div>
                        <p style="color: #999; font-size: 13px; line-height: 1.6;">
                            You will need to verify your identity using the last 4 digits of your phone number.
                        </p>
                        <hr style="border: none; border-top: 1px solid #eee; margin-top: 32px;">
                        <p style="color: #bbb; font-size: 12px; text-align: center; margin-top: 16px;">
                            &copy; APL COLOR. All rights reserved.
                        </p>
                    </div>
                `
            });

            return res.json({
                success: true,
                message: `Email sent to ${email}.`
            });
        }

        // Generate link only (for copy/share)
        return res.json({
            success: true,
            resultUrl,
            message: 'Result link generated.'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
