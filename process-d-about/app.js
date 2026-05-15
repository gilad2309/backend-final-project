'use strict';

// Must be the very first line (after 'use strict') so env vars are available immediately
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');

// Import the shared logger module (defined in logger.js - writes Pino logs to MongoDB)
const logger = require('./logger');

const app = express();

// Parse incoming JSON request bodies before any route handler runs
app.use(express.json());

// Log every incoming HTTP request - fires before any route handler
app.use((req, res, next) => {
    logger.info({ method: req.method, url: req.url }, 'HTTP request received');
    next();
});

// Mount the about router - handles GET /api/about
app.use('/api', require('./routes/about'));

/* Export the Express app so that unit tests (using supertest) can import
 * it directly without needing the server to be listening on a port.
 * The conditional below ensures mongoose.connect() + app.listen() only
 * run when this file is the entry point (node app.js), NOT when it is
 * required by a test file. */
module.exports = app;

// Only connect to MongoDB and start listening when run directly
if (require.main === module) {
    const port = process.env.PORT || 3004;
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => {
            logger.info('Connected to MongoDB');
            app.listen(port, () => {
                logger.info({ port }, 'Server is running');
            });
        })
        .catch(err => {
            logger.error({ err }, 'Failed to connect to MongoDB');
            process.exit(1);
        });
}
