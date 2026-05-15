'use strict';

const mongoose = require('mongoose');

/**
 * Mongoose schema for the logs collection.
 * strict: false is required because Pino generates arbitrary fields
 * that cannot be enumerated in advance (level, time, pid, hostname, msg, etc.).
 * versionKey: false suppresses the __v field that Mongoose adds by default.
 * @type {mongoose.Schema}
 */
const logSchema = new mongoose.Schema({}, { strict: false, versionKey: false });

module.exports = mongoose.model('Log', logSchema);
