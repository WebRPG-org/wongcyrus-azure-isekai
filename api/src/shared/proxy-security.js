const crypto = require('node:crypto');

function getAuthenticatedEmail(request, context) {
    const header = request.headers.get('x-ms-client-principal');
    if (!header) {
        return null;
    }

    try {
        const principal = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
        const email = principal?.userDetails;
        return typeof email === 'string' && email.trim()
            ? email.trim().toLowerCase()
            : null;
    } catch (error) {
        context.log.warn('Failed to parse authenticated principal.', error);
        return null;
    }
}

function isOperatorEmail(email) {
    const configuredEmails = process.env.ADMIN_EMAILS || '';
    const operatorEmails = configuredEmails
        .split(/[,;\r\n]/)
        .map(value => value.trim().toLowerCase())
        .filter(Boolean);
    return operatorEmails.includes(email.trim().toLowerCase());
}

function createSignedBackendRequest(
    configuredUrl,
    method,
    parameters,
    email,
    timestampMilliseconds = Date.now()) {
    const signingKey = process.env.GRADER_PROXY_SIGNING_KEY;
    if (!configuredUrl || !signingKey) {
        throw new Error('Backend URL or proxy signing key is not configured.');
    }

    const url = new URL(configuredUrl);
    const functionKey = url.searchParams.get('code');
    if (!functionKey) {
        throw new Error('Backend Function key is not configured.');
    }

    url.searchParams.delete('code');
    for (const [name, value] of Object.entries(parameters)) {
        url.searchParams.set(name, value);
    }

    const timestamp = timestampMilliseconds.toString();
    const normalizedEmail = email.trim().toLowerCase();
    const canonicalRequest = [
        method.toUpperCase(),
        `${url.pathname}${url.search}`,
        timestamp,
        normalizedEmail
    ].join('\n');
    const signature = crypto
        .createHmac('sha256', Buffer.from(signingKey, 'base64'))
        .update(canonicalRequest, 'utf8')
        .digest('hex');

    return {
        url: url.toString(),
        headers: {
            'x-functions-key': functionKey,
            'x-grader-email': normalizedEmail,
            'x-grader-timestamp': timestamp,
            'x-grader-signature': signature
        }
    };
}

module.exports = {
    createSignedBackendRequest,
    getAuthenticatedEmail,
    isOperatorEmail
};
