const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const {
    createSignedBackendRequest,
    getAuthenticatedEmail
} = require('../src/shared/proxy-security');

test('authenticated principal email is normalized', () => {
    const principal = Buffer.from(JSON.stringify({
        userDetails: ' Student@Example.com '
    })).toString('base64');
    const request = {
        headers: new Headers({ 'x-ms-client-principal': principal })
    };
    const context = { log: { warn: () => {} } };

    assert.equal(
        getAuthenticatedEmail(request, context),
        'student@example.com');
});

test('backend request moves Function key to a header and signs identity', () => {
    const signingKey = Buffer.alloc(32, 7).toString('base64');
    process.env.GRADER_PROXY_SIGNING_KEY = signingKey;

    const result = createSignedBackendRequest(
        'https://example.azurewebsites.net/api/GameTaskFunction?code=secret',
        'GET',
        { game: 'azure-learning', npc: 'Stella' },
        'Student@Example.com',
        123456789);

    const url = new URL(result.url);
    assert.equal(url.searchParams.has('code'), false);
    assert.equal(result.headers['x-functions-key'], 'secret');
    assert.equal(result.headers['x-grader-email'], 'student@example.com');

    const canonical = [
        'GET',
        '/api/GameTaskFunction?game=azure-learning&npc=Stella',
        '123456789',
        'student@example.com'
    ].join('\n');
    const expected = crypto
        .createHmac('sha256', Buffer.from(signingKey, 'base64'))
        .update(canonical)
        .digest('hex');
    assert.equal(result.headers['x-grader-signature'], expected);
});
