'use strict';

const pino = require('pino');
const Log = require('./models/log');

/* Custom Pino destination stream that writes log entries to MongoDB.
 * Pino calls write() with a JSON string for each log event.
 * Using a custom stream avoids writing logs to stdout and persists
 * all log data directly into the logs collection for retrieval via
 * GET /api/logs. Do NOT require('./logger') inside models/log.js -
 * that would create a circular dependency. */
const stream = {
    /**
     * Receives a single serialised log line from Pino and persists it.
     * @param {string} msg - JSON string produced by Pino for one log event.
     * @returns {void}
     */
    write(msg) {
        // Parse the JSON string Pino produces into a plain object
        const logObject = JSON.parse(msg);
        // Insert the log object into the logs collection
        Log.create(logObject).catch(err => {
            // Write to stderr only if DB insert fails - avoids infinite logging loop
            process.stderr.write(`Log write failed: ${err.message}\n`);
        });
    }
};

// Create the shared logger instance with minimum level 'info'
const logger = pino({ level: 'info' }, stream);

module.exports = logger;
