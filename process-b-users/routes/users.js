'use strict';

const express = require('express');
const router = express.Router();
// User model - for all user CRUD operations
const User = require('../models/user');
// Cost model - needed to compute 'total' in GET /api/users/:id
const Cost = require('../models/cost');
// Shared logger (writes to MongoDB via Pino)
const logger = require('../logger');

/**
 * POST /api/add
 * Creates a new user in the users collection.
 * @param {number} req.body.id - Unique numeric user ID (custom field, not MongoDB _id).
 * @param {string} req.body.first_name - User's first name.
 * @param {string} req.body.last_name - User's last name.
 * @param {string} req.body.birthday - ISO date string for the user's birthday.
 * @returns {Object} 201 - The full saved user document.
 * @returns {Object} 400 - { id: string, message: string } on validation or duplicate error.
 * @returns {Object} 500 - { id: 'server_error', message: string } on DB error.
 */
router.post('/add', async (req, res) => {
    logger.info('POST /api/add (user) endpoint accessed');
    try {
        /* Guard: if Content-Type is not application/json, express.json()
         * will not parse the body and req.body will be undefined.
         * Destructuring undefined throws a TypeError → 500 instead of 400.
         * Detect it early and return a clear 400. */
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ id: 'invalid_body', message: 'Request body must be JSON' });
        }

        const { id, first_name, last_name, birthday } = req.body;

        // Validate all required fields are present before any type checks
        if (id === undefined || id === null) {
            return res.status(400).json({ id: 'missing_field', message: 'Field id is required' });
        }
        if (!first_name) {
            return res.status(400).json({ id: 'missing_field', message: 'Field first_name is required' });
        }
        if (!last_name) {
            return res.status(400).json({ id: 'missing_field', message: 'Field last_name is required' });
        }
        if (!birthday) {
            return res.status(400).json({ id: 'missing_field', message: 'Field birthday is required' });
        }

        // Validate id is a number - explicit typeof check with strict equality
        if (typeof id !== 'number') {
            return res.status(400).json({ id: 'invalid_type', message: 'Field id must be a number' });
        }

        // Validate birthday parses to a valid Date
        if (isNaN(new Date(birthday).getTime())) {
            return res.status(400).json({ id: 'invalid_date', message: 'Field birthday must be a valid date' });
        }

        // Create and save the new user document
        const newUser = new User({ id, first_name, last_name, birthday });
        const savedUser = await newUser.save();

        // Return the saved user as a plain object (toObject removes Mongoose wrapper)
        res.status(201).json(savedUser.toObject());
    } catch (err) {
        // Handle MongoDB duplicate key error for the unique 'id' field
        if (err.code === 11000) {
            return res.status(400).json({ id: 'duplicate_id', message: 'A user with this id already exists' });
        }
        logger.error({ err }, 'Error in POST /api/add (user)');
        res.status(500).json({ id: 'server_error', message: err.message });
    }
});

/**
 * GET /api/users
 * Returns all user documents from the users collection.
 * @returns {Array} 200 - Array of full user documents (all fields from the collection).
 * @returns {Object} 500 - { id: 'server_error', message: string }
 */
router.get('/users', async (req, res) => {
    logger.info('GET /api/users endpoint accessed');
    try {
        // Return all user documents - .lean() gives plain objects for performance
        const users = await User.find({}).lean();
        res.status(200).json(users);
    } catch (err) {
        logger.error({ err }, 'Error in GET /api/users');
        res.status(500).json({ id: 'server_error', message: err.message });
    }
});

/**
 * GET /api/users/:id
 * Returns a specific user with their total costs sum.
 * Response contains EXACTLY 4 fields: first_name, last_name, id, total.
 * @param {string} req.params.id - The numeric user id (converted with parseInt).
 * @returns {Object} 200 - { first_name, last_name, id, total }
 * @returns {Object} 400 - { id: 'invalid_id', message: string } if id is not a number.
 * @returns {Object} 404 - { id: 'user_not_found', message: string } if user does not exist.
 * @returns {Object} 500 - { id: 'server_error', message: string } on DB error.
 */
router.get('/users/:id', async (req, res) => {
    logger.info({ userId: req.params.id }, 'GET /api/users/:id endpoint accessed');
    try {
        // Convert the URL param string to a number using explicit radix
        const userId = parseInt(req.params.id, 10);

        // Reject non-numeric :id params immediately
        if (isNaN(userId)) {
            return res.status(400).json({ id: 'invalid_id', message: 'User id must be a number' });
        }

        // Find the user by the custom numeric 'id' field (not MongoDB's _id)
        const user = await User.findOne({ id: userId }).lean();

        // Return 404 if no user with this id exists
        if (!user) {
            return res.status(404).json({ id: 'user_not_found', message: `User with id ${userId} not found` });
        }

        // Compute total: aggregate sum of all cost 'sum' values for this user
        const aggregation = await Cost.aggregate([
            { $match: { userid: userId } },
            { $group: { _id: null, total: { $sum: '$sum' } } }
        ]);

        // If no costs found, total is 0 - never null or undefined
        const total = aggregation.length > 0 ? aggregation[0].total : 0;

        // Return ONLY the 4 required fields - never return birthday, _id, or __v
        res.status(200).json({
            first_name: user.first_name,
            last_name: user.last_name,
            id: user.id,
            total
        });
    } catch (err) {
        logger.error({ err }, 'Error in GET /api/users/:id');
        res.status(500).json({ id: 'server_error', message: err.message });
    }
});

module.exports = router;
