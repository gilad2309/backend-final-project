'use strict';

const express = require('express');
const router = express.Router();
// Log model - needed to query all log documents
const Log = require('../models/log');
// Import the shared logger (defined in logger.js at the process root)
const logger = require('../logger');

/**
 * GET /api/logs
 * Returns all documents from the logs collection as a JSON array.
 * Uses .lean() to return plain JavaScript objects (faster, no Mongoose prototype methods).
 * @returns {Array} 200 - Array of all log documents stored by Pino.
 * @returns {Object} 500 - { id: 'server_error', message: string }
 */
router.get('/logs', async (req, res) => {
    // Log that this specific endpoint was accessed
    logger.info('GET /api/logs endpoint accessed');
    try {
        // Retrieve all log documents from the logs collection
        const logs = await Log.find({}).lean();
        // Return the full array - field names match exactly what Pino stored
        res.status(200).json(logs);
    } catch (err) {
        logger.error({ err }, 'Error in GET /api/logs');
        res.status(500).json({ id: 'server_error', message: err.message });
    }
});

module.exports = router;
