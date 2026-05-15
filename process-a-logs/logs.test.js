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

describe('GET /api/logs', () => {
    test('returns HTTP 200', async () => {
        const res = await request(app).get('/api/logs');
        expect(res.status).toBe(200);
    });

    test('response is an array', async () => {
        const res = await request(app).get('/api/logs');
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('each element has at minimum a msg field (verifies Pino log structure)', async () => {
        const res = await request(app).get('/api/logs');
        // Only check if there are logs - collection may be empty at test time
        if (res.body.length > 0) {
            res.body.forEach(log => {
                expect(log).toHaveProperty('msg');
            });
        }
    });
});
