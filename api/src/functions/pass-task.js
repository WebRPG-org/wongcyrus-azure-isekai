const { app } = require('@azure/functions');
const {
    createSignedBackendRequest,
    getAuthenticatedEmail
} = require('../shared/proxy-security');

async function handlePassTask(request, context) {
    try {
        const email = getAuthenticatedEmail(request, context);
        const method = request.method.toUpperCase();

        context.log(`HTTP ${method} /pass-task called.`);

        if (!email) {
            context.log.error('User not authenticated - email is unknown');
            return {
                status: 401,
                jsonBody: {
                    success: false,
                    error: 'Authentication required. Please login to access the pass task service.'
                }
            };
        }

        const passTaskFunctionUrl = process.env.PassTaskFunctionUrl;

        if (!passTaskFunctionUrl) {
            context.log.error('PassTaskFunctionUrl environment variable is not set.');
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    error: 'PassTaskFunctionUrl environment variable is not set.'
                }
            };
        }

        const parameters = method === 'POST' ? { action: 'reset' } : {};
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
            context.log.error('Fetch request to PassTaskFunctionUrl timed out.');
        }, 30000);

        let response;
        try {
            const backendRequest = createSignedBackendRequest(
                passTaskFunctionUrl,
                method,
                parameters,
                email);
            context.log('Calling PassTaskFunction backend.');
            response = await fetch(backendRequest.url, {
                method,
                headers: backendRequest.headers,
                signal: controller.signal
            });
        } catch (err) {
            clearTimeout(timeout);
            context.log.error('Error calling PassTaskFunctionUrl:', err);
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    error: 'Failed to connect to pass task service'
                }
            };
        }
        clearTimeout(timeout);

        let data;
        try {
            data = await response.json();
        } catch (error) {
            context.log.error('PassTaskFunction returned invalid JSON.', error);
            return {
                status: 502,
                jsonBody: {
                    success: false,
                    error: 'Pass task service returned an invalid response.'
                }
            };
        }

        if (!response.ok) {
            context.log.error(`PassTaskFunction failed with status ${response.status}.`);
        }

        return {
            status: response.status,
            jsonBody: data
        };
    } catch (error) {
        context.log.error('Unhandled error in pass-task function:', error);
        return {
            status: 500,
            jsonBody: {
                success: false,
                error: 'Internal server error occurred'
            }
        };
    }
}

app.http('pass-task', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: handlePassTask
});

module.exports = { handlePassTask };
