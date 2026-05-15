'use strict';

const request = require('supertest');
const mongoose = require('mongoose');
// app.js is in the same folder - same node_modules/mongoose instance as the app
const app = require('./app');
// Models needed for test setup and cleanup
const Cost = require('./models/cost');
const User = require('./models/user');
const Report = require('./models/report');

/* Load environment variables from this process's .env file.
 * dotenv looks in process.cwd() by default, which is this folder
 * when npm test is run from inside it. */
beforeAll(async () => {
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI);
    // Ensure the seeded test user exists - costs tests require userid=123123
    const existing = await User.findOne({ id: 123123 });
    if (!existing) {
        await User.create({
            id: 123123,
            first_name: 'mosh',
            last_name: 'israeli',
            birthday: new Date('1980-01-01')
        });
    }
});

// Disconnect after all tests finish to release the connection
afterAll(async () => {
    await mongoose.disconnect();
});

describe('POST /api/add (cost)', () => {
    // Remove any costs inserted by this suite after each test
    afterEach(async () => {
        await Cost.deleteMany({ userid: 123123, description: 'test-item' });
    });

    test('returns 201 and the cost document on valid data', async () => {
        // Use a far-future date to avoid the past-date rejection
        const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        const res = await request(app)
            .post('/api/add')
            .send({ description: 'test-item', category: 'food', userid: 123123, sum: 10, date: futureDate });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('description', 'test-item');
        expect(res.body).toHaveProperty('category', 'food');
        expect(res.body).toHaveProperty('userid', 123123);
        expect(res.body).toHaveProperty('sum', 10);
        expect(res.body).toHaveProperty('date');
    });

    test('missing description returns 400 with {id, message}', async () => {
        const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        const res = await request(app)
            .post('/api/add')
            .send({ category: 'food', userid: 123123, sum: 10, date: futureDate });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('message');
    });

    test('missing category returns 400 with {id, message}', async () => {
        const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        const res = await request(app)
            .post('/api/add')
            .send({ description: 'test-item', userid: 123123, sum: 10, date: futureDate });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('message');
    });

    test('missing userid returns 400 with {id, message}', async () => {
        const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        const res = await request(app)
            .post('/api/add')
            .send({ description: 'test-item', category: 'food', sum: 10, date: futureDate });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('message');
    });

    test('missing sum returns 400 with {id, message}', async () => {
        const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        const res = await request(app)
            .post('/api/add')
            .send({ description: 'test-item', category: 'food', userid: 123123, date: futureDate });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('message');
    });

    test('invalid category returns 400 with {id: "invalid_category", message}', async () => {
        const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        const res = await request(app)
            .post('/api/add')
            .send({ description: 'test-item', category: 'invalid', userid: 123123, sum: 10, date: futureDate });
        expect(res.status).toBe(400);
        expect(res.body.id).toBe('invalid_category');
        expect(res.body).toHaveProperty('message');
    });

    test('non-existent userid returns 404 with {id: "user_not_found", message}', async () => {
        const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        const res = await request(app)
            .post('/api/add')
            .send({ description: 'test-item', category: 'food', userid: 999999999, sum: 10, date: futureDate });
        expect(res.status).toBe(404);
        expect(res.body.id).toBe('user_not_found');
        expect(res.body).toHaveProperty('message');
    });

    test('past date returns 400 with {id: "past_date", message}', async () => {
        const res = await request(app)
            .post('/api/add')
            .send({ description: 'test-item', category: 'food', userid: 123123, sum: 10, date: '2020-01-01' });
        expect(res.status).toBe(400);
        expect(res.body.id).toBe('past_date');
        expect(res.body).toHaveProperty('message');
    });
});

describe('GET /api/report', () => {
    test('returns 200 with valid params', async () => {
        const res = await request(app).get('/api/report?id=123123&year=2026&month=5');
        expect(res.status).toBe(200);
    });

    test('response has userid (Number), year (Number), month (Number), costs (Array)', async () => {
        const res = await request(app).get('/api/report?id=123123&year=2026&month=5');
        expect(typeof res.body.userid).toBe('number');
        expect(typeof res.body.year).toBe('number');
        expect(typeof res.body.month).toBe('number');
        expect(Array.isArray(res.body.costs)).toBe(true);
    });

    test('costs array has exactly 5 elements (one per category)', async () => {
        const res = await request(app).get('/api/report?id=123123&year=2026&month=5');
        expect(res.body.costs).toHaveLength(5);
    });

    test('all 5 categories present in order: food, education, health, housing, sports', async () => {
        const res = await request(app).get('/api/report?id=123123&year=2026&month=5');
        const cats = res.body.costs.map(obj => Object.keys(obj)[0]);
        expect(cats).toEqual(['food', 'education', 'health', 'housing', 'sports']);
    });

    test('each category value is an array', async () => {
        const res = await request(app).get('/api/report?id=123123&year=2026&month=5');
        res.body.costs.forEach(obj => {
            const value = Object.values(obj)[0];
            expect(Array.isArray(value)).toBe(true);
        });
    });

    test('empty months still show all 5 categories with empty arrays', async () => {
        // Use a month in the distant past with no costs
        const res = await request(app).get('/api/report?id=123123&year=2020&month=1');
        expect(res.body.costs).toHaveLength(5);
        res.body.costs.forEach(obj => {
            expect(Array.isArray(Object.values(obj)[0])).toBe(true);
        });
    });

    test('for past month: second request returns same cached result', async () => {
        // Delete any existing cache for this month first
        await Report.deleteMany({ userid: 123123, year: 2020, month: 1 });
        // First request - computes and caches
        const first = await request(app).get('/api/report?id=123123&year=2020&month=1');
        // Give the non-blocking cache write a moment to complete
        await new Promise(resolve => setTimeout(resolve, 200));
        // Second request - should return cached result
        const second = await request(app).get('/api/report?id=123123&year=2020&month=1');
        expect(second.status).toBe(200);
        expect(second.body.costs).toEqual(first.body.costs);
    });

    test('missing id param returns 400 with {id, message}', async () => {
        const res = await request(app).get('/api/report?year=2026&month=5');
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('message');
    });

    test('invalid month (13) returns 400 with {id: "invalid_month", message}', async () => {
        const res = await request(app).get('/api/report?id=123123&year=2026&month=13');
        expect(res.status).toBe(400);
        expect(res.body.id).toBe('invalid_month');
        expect(res.body).toHaveProperty('message');
    });

    test('non-existent user returns 404 with {id: "user_not_found", message}', async () => {
        const res = await request(app).get('/api/report?id=999999999&year=2026&month=5');
        expect(res.status).toBe(404);
        expect(res.body.id).toBe('user_not_found');
        expect(res.body).toHaveProperty('message');
    });
});
