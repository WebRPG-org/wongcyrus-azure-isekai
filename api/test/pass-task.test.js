const assert = require('node:assert/strict');
const test = require('node:test');
const { handlePassTask } = require('../src/functions/pass-task');

function createContext() {
    const log = () => {};
    log.error = () => {};
    log.warn = () => {};
    return { log };
}

function createRequest(method, email = 'student@example.com') {
    const principal = Buffer.from(JSON.stringify({
        userDetails: email
    })).toString('base64');
    return {
        method,
        headers: new Headers({ 'x-ms-client-principal': principal })
    };
}

test('POST signs and forwards the authenticated reset request', async (t) => {
    const previousUrl = process.env.PassTaskFunctionUrl;
    const previousKey = process.env.GRADER_PROXY_SIGNING_KEY;
    const previousFetch = global.fetch;
    t.after(() => {
        process.env.PassTaskFunctionUrl = previousUrl;
        process.env.GRADER_PROXY_SIGNING_KEY = previousKey;
        global.fetch = previousFetch;
    });

    process.env.PassTaskFunctionUrl =
        'https://example.azurewebsites.net/api/PassTaskFunction?code=function-key';
    process.env.GRADER_PROXY_SIGNING_KEY =
        Buffer.alloc(32, 3).toString('base64');

    let forwardedUrl;
    let forwardedOptions;
    global.fetch = async (url, options) => {
        forwardedUrl = new URL(url);
        forwardedOptions = options;
        return new Response(JSON.stringify({
            success: true,
            data: { removedGameStates: 2 }
        }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
        });
    };

    const result = await handlePassTask(
        createRequest('POST'),
        createContext());

    assert.equal(result.status, 200);
    assert.equal(forwardedOptions.method, 'POST');
    assert.equal(forwardedUrl.searchParams.get('action'), 'reset');
    assert.equal(forwardedUrl.searchParams.has('code'), false);
    assert.equal(
        forwardedOptions.headers['x-grader-email'],
        'student@example.com');
});

test('request without an authenticated principal is rejected', async () => {
    const request = {
        method: 'GET',
        headers: new Headers()
    };

    const result = await handlePassTask(request, createContext());

    assert.equal(result.status, 401);
    assert.equal(result.jsonBody.success, false);
});
