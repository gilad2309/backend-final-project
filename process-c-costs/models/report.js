'use strict';

const mongoose = require('mongoose');

/**
 * Mongoose schema for the reports collection (Computed Design Pattern cache).
 * Stores pre-computed monthly reports for past months.
 * The compound unique index on { userid, year, month } guarantees only one
 * cached entry exists per user per calendar month - duplicate inserts
 * (e.g. from a race condition) will throw an error that is swallowed by .catch().
 * versionKey: false suppresses the __v field.
 * @type {mongoose.Schema}
 */
const reportSchema = new mongoose.Schema(
    {
        userid: { type: Number, required: true },
        year: { type: Number, required: true },
        month: { type: Number, required: true },
        costs: { type: Array, required: true },
        createdAt: { type: Date, default: Date.now }
    },
    { versionKey: false }
);

// Compound unique index: one cache entry per user per month per year
reportSchema.index({ userid: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Report', reportSchema);
