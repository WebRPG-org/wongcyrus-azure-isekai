const assert = require('node:assert/strict');
const test = require('node:test');
const { handleHealth } = require('../src/functions/health');

test('health reports the managed API identity', () => {
    const result = handleHealth();

    assert.equal(result.status, 200);
    assert.deepEqual(result.jsonBody, {
        status: 'ok',
        service: 'azure-isekai-api'
    });
});
