'use strict';

const express = require('express');
const router = express.Router();
// Cost model - for adding and querying cost items
const Cost = require('../models/cost');
// User model - needed to validate userid on POST /api/add
const User = require('../models/user');
// Report model - for Computed Design Pattern cache (GET /api/report)
const Report = require('../models/report');
// Shared logger (writes to MongoDB via Pino)
const logger = require('../logger');

/* The 5 supported cost categories as specified by the project requirements.
 * Used both for validating incoming category values (POST /api/add)
 * and for building the report structure (GET /api/report).
 * One constant serves both purposes - do not duplicate it. */
const CATEGORIES = ['food', 'education', 'health', 'housing', 'sports'];

/**
 * Determines whether the given year/month combination is in the past.
 * Returns true if the requested month is strictly before the current calendar month.
 * Current month and future months both return false.
 * @param {number} year - Full 4-digit year (e.g. 2026).
 * @param {number} month - 1-indexed month number (1 = January, 12 = December).
 * @returns {boolean} True if the month has already passed; false for current or future months.
 */
function isPastMonth(year, month) {
    const now = new Date();
    // Use UTC methods for consistency with Date.UTC() boundary queries and MongoDB's UTC storage
    const currentYear = now.getUTCFullYear();
    // getUTCMonth() is 0-indexed; add 1 to convert to 1-indexed
    const currentMonth = now.getUTCMonth() + 1;
    // Past means: year is earlier, or same year but month number is smaller
    return year < currentYear || (year === currentYear && month < currentMonth);
}

/**
 * POST /api/add
 * Adds a new cost item to the costs collection.
 * @param {string} req.body.description - Description of the cost item.
 * @param {string} req.body.category - One of: food, education, health, housing, sports.
 * @param {number} req.body.userid - Must match an existing user's id field.
 * @param {number} req.body.sum - Cost amount (stored as MongoDB Double).
 * @param {string} [req.body.date] - Optional ISO date string; defaults to current moment.
 * @returns {Object} 201 - The full saved cost document.
 * @returns {Object} 400 - { id: string, message: string } on validation error.
 * @returns {Object} 404 - { id: 'user_not_found', message: string } if user does not exist.
 * @returns {Object} 500 - { id: 'server_error', message: string } on DB error.
 */
router.post('/add', async (req, res) => {
    logger.info('POST /api/add (cost) endpoint accessed');
    try {
        /* Guard: if Content-Type is not application/json, express.json()
         * will not parse the body and req.body will be undefined.
         * Destructuring undefined throws a TypeError, which the catch block
         * would turn into a 500. Detect it early and return a clear 400. */
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ id: 'invalid_body', message: 'Request body must be JSON' });
        }

        const { description, category, userid, sum, date } = req.body;

        // Validate presence of all required fields before any type or DB checks
        if (!description) {
            return res.status(400).json({ id: 'missing_field', message: 'Field description is required' });
        }
        if (!category) {
            return res.status(400).json({ id: 'missing_field', message: 'Field category is required' });
        }
        // Use explicit null/undefined check for numeric fields - !0 would incorrectly reject 0
        if (userid === undefined || userid === null) {
            return res.status(400).json({ id: 'missing_field', message: 'Field userid is required' });
        }
        if (sum === undefined || sum === null) {
            return res.status(400).json({ id: 'missing_field', message: 'Field sum is required' });
        }

        // Validate category is one of the 5 allowed values
        if (!CATEGORIES.includes(category)) {
            return res.status(400).json({
                id: 'invalid_category',
                message: `Category must be one of: ${CATEGORIES.join(', ')}`
            });
        }

        // Type checks - use typeof with strict equality
        if (typeof userid !== 'number') {
            return res.status(400).json({ id: 'invalid_type', message: 'Field userid must be a number' });
        }
        if (typeof sum !== 'number') {
            return res.status(400).json({ id: 'invalid_type', message: 'Field sum must be a number' });
        }

        // Determine and validate the cost date
        const costDate = date ? new Date(date) : new Date();

        // Reject if the client provided a date string that cannot be parsed
        if (date && isNaN(costDate.getTime())) {
            return res.status(400).json({
                id: 'invalid_date',
                message: 'Field date must be a valid date string'
            });
        }

        // Reject past dates - enforces immutability required by the Computed Design Pattern
        if (date && costDate < new Date()) {
            return res.status(400).json({
                id: 'past_date',
                message: 'Cannot add cost items with a date in the past'
            });
        }

        // Verify the referenced user exists - DB call kept last to minimise unnecessary queries
        const userExists = await User.findOne({ id: userid });
        if (!userExists) {
            return res.status(404).json({
                id: 'user_not_found',
                message: `User with id ${userid} does not exist`
            });
        }

        // Save the new cost document to the costs collection
        const newCost = new Cost({ description, category, userid, sum, date: costDate });
        const savedCost = await newCost.save();

        // Return the full saved document - field names match the costs collection
        res.status(201).json(savedCost.toObject());
    } catch (err) {
        logger.error({ err }, 'Error in POST /api/add (cost)');
        res.status(500).json({ id: 'server_error', message: err.message });
    }
});

/**
 * GET /api/report
 * Returns a monthly cost report for a given user, year, and month.
 * Implements the Computed Design Pattern: past months are cached in the reports
 * collection and returned directly on subsequent requests without re-querying costs.
 * @param {string} req.query.id - Numeric user id (converted with parseInt).
 * @param {string} req.query.year - Full 4-digit year (converted with parseInt).
 * @param {string} req.query.month - Month number 1-12 (converted with parseInt).
 * @returns {Object} 200 - { userid, year, month, costs } - see Section 16 for exact shape.
 * @returns {Object} 400 - { id: string, message: string } on missing or invalid params.
 * @returns {Object} 404 - { id: 'user_not_found', message: string } if user does not exist.
 * @returns {Object} 500 - { id: 'server_error', message: string } on DB error.
 */
router.get('/report', async (req, res) => {
    logger.info({ query: req.query }, 'GET /api/report endpoint accessed');
    try {
        // Extract and convert query params from strings to numbers using explicit radix
        const userid = parseInt(req.query.id, 10);
        const year = parseInt(req.query.year, 10);
        const month = parseInt(req.query.month, 10);

        // Validate all three params are present and parse to valid numbers
        if (isNaN(userid) || isNaN(year) || isNaN(month)) {
            return res.status(400).json({
                id: 'missing_params',
                message: 'Query params id, year, and month are required and must be numbers'
            });
        }

        // Validate month is within the valid calendar range
        if (month < 1 || month > 12) {
            return res.status(400).json({ id: 'invalid_month', message: 'Month must be between 1 and 12' });
        }

        // Validate that the user exists before building any report
        const userExists = await User.findOne({ id: userid });
        if (!userExists) {
            return res.status(404).json({
                id: 'user_not_found',
                message: `User with id ${userid} does not exist`
            });
        }

        /*
         * Computed Design Pattern:
         * For months that have already passed, the report is computed once
         * from the costs collection and saved to the reports collection.
         * On subsequent requests for the same past month, the stored result
         * is returned directly without re-querying the costs collection.
         * This is safe because the server rejects cost items with past dates,
         * guaranteeing that past monthly data in the costs collection is immutable.
         * Current and future months are always computed fresh on every request.
         */
        if (isPastMonth(year, month)) {
            // Check for an existing cached report for this user, year, and month
            const cachedReport = await Report.findOne({ userid, year, month }).lean();

            // Return the cached report immediately if it exists - no costs query needed
            if (cachedReport) {
                return res.status(200).json({
                    userid,
                    year,
                    month,
                    costs: cachedReport.costs
                });
            }
        }

        /* Build the date range for querying costs in the requested month.
         * Date.UTC() constructs midnight UTC boundaries, matching how MongoDB
         * stores dates (always in UTC). Using new Date(year, month-1, 1) would
         * produce a LOCAL-timezone midnight, which on non-UTC servers causes
         * off-by-one month boundary errors. Date.UTC avoids this entirely. */
        const startDate = new Date(Date.UTC(year, month - 1, 1));
        const endDate = new Date(Date.UTC(year, month, 1));

        // Query all costs for this user within the requested month
        const costs = await Cost.find({
            userid,
            date: { $gte: startDate, $lt: endDate }
        }).lean();

        // Build the costs array: one object per category, always all 5 categories
        const costsArray = CATEGORIES.map(cat => {
            // Filter costs for this category and extract the 3 required fields
            const items = costs
                .filter(c => c.category === cat)
                .map(c => ({
                    sum: c.sum,
                    description: c.description,
                    /* Extract day of month using getUTCDate() - NOT getDate().
                     * getDate() returns the local-timezone day, which can differ
                     * from the UTC day when a cost was saved near midnight.
                     * Since MongoDB stores dates in UTC, getUTCDate() is correct. */
                    day: new Date(c.date).getUTCDate()
                }));
            // Each element is a single-key object: { "food": [...] }
            return { [cat]: items };
        });

        // Save this report to the cache if the requested month is in the past
        if (isPastMonth(year, month)) {
            // Non-blocking cache write - intentional, do NOT await this
            Report.create({ userid, year, month, costs: costsArray }).catch(err => {
                // If save fails (e.g., race condition duplicate), log and continue
                logger.warn({ err }, 'Failed to cache report - may already exist');
            });
        }

        // Return the full report immediately without waiting for the cache write
        res.status(200).json({ userid, year, month, costs: costsArray });
    } catch (err) {
        logger.error({ err }, 'Error in GET /api/report');
        res.status(500).json({ id: 'server_error', message: err.message });
    }
});

module.exports = router;
