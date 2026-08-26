const assert = require('node:assert/strict');
const test = require('node:test');
const { handleAdmin } = require('../src/functions/admin');

function createRequest(operation, method = 'GET', email = 'operator@example.com') {
    const principal = Buffer.from(JSON.stringify({
        userDetails: email
    })).toString('base64');
    return {
        method,
        headers: new Headers({ 'x-ms-client-principal': principal }),
        params: { operation },
        query: new URLSearchParams()
    };
}

function createContext() {
    return {
        log: {
            error: () => {},
            warn: () => {}
        }
    };
}

test.beforeEach(() => {
    process.env.ADMIN_EMAILS = 'operator@example.com';
    process.env.GRADER_PROXY_SIGNING_KEY =
        Buffer.alloc(32, 3).toString('base64');
});

test('admin status returns the operator identity', async () => {
    const result = await handleAdmin(
        createRequest('status'),
        createContext());

    assert.equal(result.status, 200);
    assert.equal(result.jsonBody.data.email, 'operator@example.com');
});

test('signed student is forbidden before backend calls', async () => {
    const originalFetch = global.fetch;
    let called = false;
    global.fetch = async () => {
        called = true;
        return new Response();
    };
    try {
        const result = await handleAdmin(
            createRequest('cache-stats', 'GET', 'student@example.com'),
            createContext());

        assert.equal(result.status, 403);
        assert.equal(called, false);
    } finally {
        global.fetch = originalFetch;
    }
});

test('cache statistics are proxied with signed operator identity', async () => {
    process.env.PreGeneratedMessageStatsFunctionUrl =
        'https://example.test/api/pregeneratedmessagestats?code=function-key';
    const originalFetch = global.fetch;
    let backendRequest;
    global.fetch = async (url, options) => {
        backendRequest = { url, options };
        return new Response('{"statistics":{"total":{"messages":1}}}', {
            status: 200,
            headers: { 'content-type': 'application/json' }
        });
    };
    try {
        const result = await handleAdmin(
            createRequest('cache-stats'),
            createContext());

        assert.equal(result.status, 200);
        assert.equal(
            new URL(backendRequest.url).searchParams.has('code'),
            false);
        assert.equal(
            backendRequest.options.headers['x-functions-key'],
            'function-key');
        assert.equal(
            backendRequest.options.headers['x-grader-email'],
            'operator@example.com');
    } finally {
        global.fetch = originalFetch;
    }
});

test('registration release forwards exact student email', async () => {
    process.env.StudentRegistrationAdminFunctionUrl =
        'https://example.test/api/operator/subscription-registration?code=admin-key';
    const request = createRequest('registration', 'DELETE');
    request.query.set('email', ' Student@Example.com ');
    const originalFetch = global.fetch;
    let backendRequest;
    global.fetch = async (url, options) => {
        backendRequest = { url, options };
        return new Response('{"success":true}', {
            status: 200,
            headers: { 'content-type': 'application/json' }
        });
    };
    try {
        const result = await handleAdmin(request, createContext());

        assert.equal(result.status, 200);
        assert.equal(backendRequest.options.method, 'DELETE');
        assert.equal(
            new URL(backendRequest.url).searchParams.get('email'),
            'Student@Example.com');
    } finally {
        global.fetch = originalFetch;
    }
});

test('unknown operation returns not found', async () => {
    const result = await handleAdmin(
        createRequest('unknown'),
        createContext());

    assert.equal(result.status, 404);
});
