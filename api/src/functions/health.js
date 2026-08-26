const { app } = require('@azure/functions');

function handleHealth() {
    return {
        status: 200,
        jsonBody: {
            status: 'ok',
            service: 'azure-isekai-api'
        }
    };
}

app.http('health', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: handleHealth
});

module.exports = { handleHealth };
