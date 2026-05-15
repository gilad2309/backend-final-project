'use strict';

const request = require('supertest');
const mongoose = require('mongoose');
// app.js is in the same folder - same node_modules/mongoose instance as the app
const app = require('./app');
// User model - needed to clean up test documents after each test
const User = require('./models/user');

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

describe('POST /api/add (user)', () => {
    // Remove any test user inserted by this suite after each test
    afterEach(async () => {
        await User.deleteMany({ id: { $gte: 900000 } });
    });

    test('returns 201 and the user document on valid data', async () => {
        const res = await request(app)
            .post('/api/add')
            .send({ id: 900001, first_name: 'Test', last_name: 'User', birthday: '1990-01-01' });
        // Must return 201 Created
        expect(res.status).toBe(201);
        // Must return id, first_name, last_name, birthday
        expect(res.body).toHaveProperty('id', 900001);
        expect(res.body).toHaveProperty('first_name', 'Test');
        expect(res.body).toHaveProperty('last_name', 'User');
        expect(res.body).toHaveProperty('birthday');
    });

    test('response includes _id (MongoDB auto-generated)', async () => {
        const res = await request(app)
            .post('/api/add')
            .send({ id: 900002, first_name: 'Test', last_name: 'User', birthday: '1990-01-01' });
        expect(res.body).toHaveProperty('_id');
    });

    test('missing id returns 400 with {id, message}', async () => {
        const res = await request(app)
            .post('/api/add')
            .send({ first_name: 'Test', last_name: 'User', birthday: '1990-01-01' });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('message');
    });

    test('missing first_name returns 400 with {id, message}', async () => {
        const res = await request(app)
            .post('/api/add')
            .send({ id: 900003, last_name: 'User', birthday: '1990-01-01' });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('message');
    });

    test('missing last_name returns 400 with {id, message}', async () => {
        const res = await request(app)
            .post('/api/add')
            .send({ id: 900004, first_name: 'Test', birthday: '1990-01-01' });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('message');
    });

    test('missing birthday returns 400 with {id, message}', async () => {
        const res = await request(app)
            .post('/api/add')
            .send({ id: 900005, first_name: 'Test', last_name: 'User' });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('message');
    });

    test('duplicate id returns 400 with {id: "duplicate_id", message}', async () => {
        // Insert first user
        await request(app)
            .post('/api/add')
            .send({ id: 900006, first_name: 'Test', last_name: 'User', birthday: '1990-01-01' });
        // Second insert with same id must fail
        const res = await request(app)
            .post('/api/add')
            .send({ id: 900006, first_name: 'Other', last_name: 'Person', birthday: '1991-01-01' });
        expect(res.status).toBe(400);
        expect(res.body.id).toBe('duplicate_id');
        expect(res.body).toHaveProperty('message');
    });
});

describe('GET /api/users', () => {
    test('returns 200 and an array', async () => {
        const res = await request(app).get('/api/users');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

describe('GET /api/users/:id', () => {
    // Insert and clean up a test user around these tests
    beforeAll(async () => {
        await User.deleteMany({ id: 900010 });
        await User.create({ id: 900010, first_name: 'Jane', last_name: 'Doe', birthday: '1985-05-15' });
    });

    afterAll(async () => {
        await User.deleteMany({ id: 900010 });
    });

    test('returns 200 with exactly {first_name, last_name, id, total}', async () => {
        const res = await request(app).get('/api/users/900010');
        expect(res.status).toBe(200);
        // Must have all 4 required fields
        expect(res.body).toHaveProperty('first_name');
        expect(res.body).toHaveProperty('last_name');
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('total');
    });

    test('response has ONLY 4 keys (no _id, no birthday)', async () => {
        const res = await request(app).get('/api/users/900010');
        const keys = Object.keys(res.body);
        expect(keys).toHaveLength(4);
    });

    test('total is 0 when user has no costs', async () => {
        const res = await request(app).get('/api/users/900010');
        expect(res.body.total).toBe(0);
    });

    test('returns 404 when user does not exist', async () => {
        const res = await request(app).get('/api/users/999999999');
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('id', 'user_not_found');
        expect(res.body).toHaveProperty('message');
    });

    test('error responses always have both id and message fields', async () => {
        const res = await request(app).get('/api/users/notanumber');
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('message');
    });
});
