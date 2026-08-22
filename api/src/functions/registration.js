const { app } = require('@azure/functions');
const {
    createSignedBackendRequest,
    getAuthenticatedEmail
} = require('../shared/proxy-security');

app.http('registration', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            context.log('HTTP POST /registration called');

            const email = getAuthenticatedEmail(request, context);

            context.log(`User email from authentication: ${email}`);

            // Don't proxy the call if email is unknown (user not authenticated)
            if (!email) {
                context.log.error('User not authenticated - email is unknown');
                return {
                    status: 401,
                    headers: {
                        'Content-Type': 'text/html'
                    },
                    body: `
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Required</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 100px; }
        .error { color: #d32f2f; }
    </style>
</head>
<body>
    <h1 class="error">Authentication Required</h1>
    <p>You must be logged in to register for Azure Isekai.</p>
    <p><a href="/login">Click here to login</a></p>
</body>
</html>`
                };
            }

            const studentRegistrationFunctionUrl = process.env.StudentRegistrationFunctionUrl;
            
            if (!studentRegistrationFunctionUrl) {
                context.log.error('StudentRegistrationFunctionUrl environment variable is not set.');
                return {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    jsonBody: {
                        status: 'ERROR',
                        message: 'StudentRegistrationFunctionUrl environment variable is not set.'
                    }
                };
            }

            // Handle POST request - proxy the form submission
            const formData = await request.formData();
            
            context.log('Processing POST registration request');

            const controller = new AbortController();
            const timeout = setTimeout(() => {
                controller.abort();
                context.log.error('POST request to StudentRegistrationFunctionUrl timed out.');
            }, 60000); // 60 seconds timeout for registration processing

            let response;
            try {
                const backendRequest = createSignedBackendRequest(
                    studentRegistrationFunctionUrl,
                    'POST',
                    {},
                    email);
                context.log('Calling StudentRegistrationFunction backend.');
                response = await fetch(backendRequest.url, {
                    method: 'POST',
                    headers: backendRequest.headers,
                    body: formData,
                    signal: controller.signal
                });
            } catch (err) {
                clearTimeout(timeout);
                context.log.error('Error calling StudentRegistrationFunctionUrl POST:', err);
                return {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    jsonBody: {
                        status: 'ERROR',
                        message: 'Failed to connect to registration service'
                    }
                };
            }
            clearTimeout(timeout);

            const result = await response.text();
            if (!response.ok) {
                context.log.error(`Failed to call StudentRegistrationFunctionUrl POST: ${response.statusText}`);
                return {
                    status: response.status,
                    headers: {
                        'Content-Type': 'text/plain'
                    },
                    body: result || `Registration failed: ${response.statusText}`
                };
            }

            context.log('Registration response:', result);

            // Return the result as HTML (since the original function returns HTML)
            return {
                status: 200,
                headers: {
                    'Content-Type': 'text/html'
                },
                body: result
            };

        } catch (error) {
            context.log.error('Unhandled error in registration function:', error);
            return {
                status: 500,
                headers: {
                    'Content-Type': 'application/json'
                },
                jsonBody: {
                    status: 'ERROR',
                    message: 'Internal server error occurred'
                }
            };
        }
    }
});
