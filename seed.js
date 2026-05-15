'use strict';

// Load .env from process-b-users - that's where the MongoDB URI lives for user operations
require('dotenv').config({ path: './process-b-users/.env' });
const mongoose = require('mongoose');

/* Seed script: inserts the single required imaginary user into the database.
 * Run with: node seed.js (from the Final_Project/ root directory).
 * Drops all 4 collections first to ensure a completely clean state before insertion.
 * Must be run immediately before final submission. */

/**
 * Mongoose schema for the users collection - defined inline for the seed script.
 * Matches the schema in process-b-users/models/user.js exactly.
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

// Register the User model for the seed operation
const User = mongoose.model('User', userSchema);

/**
 * Seeds the database with the single required imaginary user.
 * Drops all 4 collections first to ensure a clean state.
 * Must be run from the Final_Project/ root directory.
 * @returns {Promise<void>}
 */
async function seed() {
    // Connect to MongoDB using the URI from process-b-users/.env
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Drop all 4 collections before seeding - ensures no leftover test data
    await mongoose.connection.db.dropCollection('users').catch(() => {});
    await mongoose.connection.db.dropCollection('costs').catch(() => {});
    await mongoose.connection.db.dropCollection('reports').catch(() => {});
    await mongoose.connection.db.dropCollection('logs').catch(() => {});
    console.log('All collections cleared');

    // Insert the single required imaginary user
    await User.create({
        id: 123123,
        first_name: 'mosh',
        last_name: 'israeli',
        birthday: new Date('1980-01-01')
    });
    console.log('Imaginary user seeded: id=123123, first_name=mosh, last_name=israeli');

    // Disconnect cleanly after seeding
    await mongoose.disconnect();
    console.log('Done. Database is ready for submission.');
}

seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
