'use strict';

const express = require('express');
const router = express.Router();
// Shared logger (writes to MongoDB via Pino)
const logger = require('../logger');

// No direct model imports needed - this handler does not query any collection itself.
// The logger (imported above) writes to the logs collection on every request via Pino.

/**
 * GET /api/about
 * Returns the team members' names as a JSON array.
 * Each object contains EXACTLY two fields: first_name and last_name.
 * Names are loaded from environment variables (set in .env) - NOT stored in the database.
 * @returns {Array} 200 - Array of { first_name, last_name } objects.
 * @returns {Object} 500 - { id: 'server_error', message: string }
 */
router.get('/about', (req, res) => {
    logger.info('GET /api/about endpoint accessed');
    try {
        /* Team member names - loaded from .env (MEMBER1_FIRST_NAME, etc.).
         * Must return ONLY first_name and last_name per object - nothing else.
         * Not stored in the database to keep the DB empty at submission time. */
        const team = [
            {
                first_name: process.env.MEMBER1_FIRST_NAME,
                last_name: process.env.MEMBER1_LAST_NAME
            },
            {
                first_name: process.env.MEMBER2_FIRST_NAME,
                last_name: process.env.MEMBER2_LAST_NAME
            }
        ];

        // Return only first_name and last_name - no other fields
        res.status(200).json(team);
    } catch (err) {
        logger.error({ err }, 'Error in GET /api/about');
        res.status(500).json({ id: 'server_error', message: err.message });
    }
});

module.exports = router;
