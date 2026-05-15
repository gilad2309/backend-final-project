'use strict';

const mongoose = require('mongoose');

/**
 * Mongoose schema for the users collection.
 * The 'id' field is a custom Number, completely separate from MongoDB's
 * auto-generated '_id' ObjectId. All lookups use { id: numericId },
 * never User.findById(). versionKey: false suppresses the __v field.
 * @type {mongoose.Schema}
 */
const userSchema = new mongoose.Schema(
    {
        id: { type: Number, required: true, unique: true },
        first_name: { type: String, required: true },
        last_name: { type: String, required: true },
        birthday: { type: Date, required: true }
    },
    { versionKey: false }
);

module.exports = mongoose.model('User', userSchema);
