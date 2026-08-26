const { app } = require('@azure/functions');
const {
    createSignedBackendRequest,
    getAuthenticatedEmail,
    isOperatorEmail
} = require('../shared/proxy-security');

const operations = {
    'cache-stats': {
        method: 'GET',
        setting: 'PreGeneratedMessageStatsFunctionUrl'
    },
    'cache-refresh': {
        method: 'POST',
        setting: 'RefreshPreGeneratedMessagesFunctionUrl'
    },
    'cache-reset': {
        method: 'POST',
        setting: 'ResetPreGeneratedMessageHitCountsFunctionUrl'
    },
    registration: {
        methods: ['GET', 'DELETE'],
        setting: 'StudentRegistrationAdminFunctionUrl'
    }
};

function errorResponse(status, error) {
    return {
        status,
        jsonBody: {
            success: false,
            error
        }
    };
}

async function proxyOperation(request, context, email, operation) {
    const configuration = operations[operation];
    if (!configuration) {
        return errorResponse(404, 'Unknown admin operation.');
    }

    const method = request.method.toUpperCase();
    const allowedMethods = configuration.methods || [configuration.method];
    if (!allowedMethods.includes(method)) {
        return errorResponse(405, 'Unsupported method for this admin operation.');
    }

    const configuredUrl = process.env[configuration.setting];
    if (!configuredUrl) {
        context.log.error(
            `Admin backend setting ${configuration.setting} is unavailable.`);
        return errorResponse(500, 'Admin backend is not configured.');
    }

    const parameters = {};
    if (operation === 'registration') {
        const studentEmail = request.query.get('email')?.trim();
        if (!studentEmail) {
            return errorResponse(400, 'A student email is required.');
        }
        parameters.email = studentEmail;
    }

    const backendRequest = createSignedBackendRequest(
        configuredUrl,
        method,
        parameters,
        email);
    let response;
    try {
        response = await fetch(backendRequest.url, {
            method,
            headers: backendRequest.headers,
            signal: AbortSignal.timeout(60000)
        });
    } catch (error) {
        context.log.error('Admin backend request failed.', error);
        return errorResponse(502, 'Admin backend request failed.');
    }

    const body = await response.text();
    return {
        status: response.status,
        headers: {
            'Content-Type':
                response.headers.get('content-type') || 'application/json'
        },
        body
    };
}

async function handleAdmin(request, context) {
    const email = getAuthenticatedEmail(request, context);
    if (!email) {
        return errorResponse(401, 'Authentication required.');
    }
    if (!isOperatorEmail(email)) {
        context.log.warn('A non-operator attempted to access the admin API.');
        return errorResponse(403, 'Operator access required.');
    }

    const operation = request.params.operation;
    if (operation === 'status') {
        if (request.method.toUpperCase() !== 'GET') {
            return errorResponse(405, 'Unsupported method for admin status.');
        }
        return {
            status: 200,
            jsonBody: {
                success: true,
                data: {
                    email,
                    features: [
                        'cache-statistics',
                        'cache-refresh',
                        'cache-counter-reset',
                        'registration-lookup',
                        'registration-release'
                    ]
                }
            }
        };
    }

    return proxyOperation(request, context, email, operation);
}

app.http('teacher-admin', {
    methods: ['GET', 'POST', 'DELETE'],
    authLevel: 'anonymous',
    route: 'teacher/{operation}',
    handler: handleAdmin
});

module.exports = { handleAdmin };
