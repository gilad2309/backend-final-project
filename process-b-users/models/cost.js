'use strict';

const mongoose = require('mongoose');

/**
 * Mongoose schema for the costs collection.
 * The 'date' field defaults to Date.now if the client does not provide one.
 * Past dates are rejected at the application level (in process-c-costs) before saving.
 * 'sum' is stored as MongoDB Double (64-bit float) - Mongoose Number maps to Double.
 * versionKey: false suppresses the __v field.
 * @type {mongoose.Schema}
 */
const costSchema = new mongoose.Schema(
    {
        description: { type: String, required: true },
        category: { type: String, required: true },
        userid: { type: Number, required: true },
        sum: { type: Number, required: true },
        date: { type: Date, default: Date.now }
    },
    { versionKey: false }
);

module.exports = mongoose.model('Cost', costSchema);
