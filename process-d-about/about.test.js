'use strict';

const request = require('supertest');
const mongoose = require('mongoose');
// app.js is in the same folder - same node_modules/mongoose instance as the app
const app = require('./app');

/* Load environment variables from this process's .env file.
 * dotenv looks in process.cwd() by default, which is this folder
 * when npm test is run from inside it. */
beforeAll(async () => {
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI);
});

// Disconnect after all tests finish to release the connection
afterAll(async () => {
    await mongoose.disconnect();
});

describe('GET /api/about', () => {
    test('returns HTTP 200', async () => {
        const res = await request(app).get('/api/about');
        expect(res.status).toBe(200);
    });

    test('response is an array', async () => {
        const res = await request(app).get('/api/about');
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('each element has exactly first_name and last_name keys', async () => {
        const res = await request(app).get('/api/about');
        res.body.forEach(member => {
            // Must have both required keys
            expect(member).toHaveProperty('first_name');
            expect(member).toHaveProperty('last_name');
        });
    });

    test('no extra keys in any element (no id, no birthday, no _id)', async () => {
        const res = await request(app).get('/api/about');
        res.body.forEach(member => {
            const keys = Object.keys(member);
            // Exactly 2 keys - first_name and last_name only
            expect(keys).toHaveLength(2);
            expect(keys).toContain('first_name');
            expect(keys).toContain('last_name');
        });
    });

    test('first_name and last_name are strings', async () => {
        const res = await request(app).get('/api/about');
        res.body.forEach(member => {
            expect(typeof member.first_name).toBe('string');
            expect(typeof member.last_name).toBe('string');
        });
    });
});
