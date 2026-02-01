import nodemailer from "nodemailer";

/**
 * Nodemailer setup for production (Vercel/serverless).
 *
 * - Config is read at runtime (not at module load) so Vercel env vars are available.
 * - Callers must await sendMail() so the function stays alive until SMTP completes.
 * - Set in Vercel: EMAIL_HOST, EMAIL_USER, EMAIL_PASS; optional: EMAIL_PORT (465/587), EMAIL_FROM.
 * - Gmail: use App Password (not account password); EMAIL_HOST=smtp.gmail.com, port 465 or 587.
 */

/**
 * Get email config from env at runtime (not at module load).
 * Required for Vercel/serverless where env may be injected per-request.
 */
function getEmailConfig() {
    const host = process.env.EMAIL_HOST?.trim();
    const user = process.env.EMAIL_USER?.trim();
    const pass = process.env.EMAIL_PASS?.trim();
    const port = Number(process.env.EMAIL_PORT) || 465;
    return { host, user, pass, port };
}

/**
 * Create a transporter with current env. Use this lazily so production env vars are available.
 */
function createTransporter() {
    const { host, user, pass, port } = getEmailConfig();

    if (!host || !user || !pass) {
        const missing = [];
        if (!host) missing.push("EMAIL_HOST");
        if (!user) missing.push("EMAIL_USER");
        if (!pass) missing.push("EMAIL_PASS");
        throw new Error(
            `Email not configured: missing ${missing.join(", ")}. Set these in Vercel Project Settings → Environment Variables.`
        );
    }

    const secure = port === 465;
    const transportOptions = {
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
    };
    if (port === 587) {
        transportOptions.requireTLS = true;
    }

    return nodemailer.createTransport(transportOptions);
}

/** Cached transporter (created on first send when config is present). */
let _transporter = null;

function getTransporter() {
    if (!_transporter) {
        _transporter = createTransporter();
    }
    return _transporter;
}

/**
 * Check if email is configured (for optional features that skip email when not configured).
 */
export function isEmailConfigured() {
    const { host, user, pass } = getEmailConfig();
    return !!(host && user && pass);
}

/**
 * Send an email. Validates config, awaits send (required for serverless so the function stays alive),
 * and logs outcome. Throws on failure so callers can return 503.
 *
 * @param {object} options - Nodemailer sendMail options: { from, to, subject, html, ... }
 * @returns {Promise<object>} Nodemailer result
 */
export async function sendEmail(options) {
    const { to, subject } = options;
    const logCtx = { to, subject, env: process.env.NODE_ENV };

    try {
        const transporter = getTransporter();
        const result = await transporter.sendMail(options);
        console.log("[Email] Sent successfully", { ...logCtx, messageId: result.messageId });
        return result;
    } catch (err) {
        const code = err.code || err.responseCode;
        const message = err.message || String(err);
        console.error("[Email] Send failed", {
            ...logCtx,
            error: message,
            code,
            response: err.response,
        });
        throw err;
    }
}

/**
 * Legacy export: transporter for callers that need it.
 * Prefer sendEmail() which handles config validation and logging.
 */
export function getTransporterOrNull() {
    if (!isEmailConfigured()) return null;
    try {
        return getTransporter();
    } catch {
        return null;
    }
}

/** @deprecated Use sendEmail() instead. Kept for backwards compatibility. */
export const transporter = {
    sendMail(options) {
        return sendEmail(options);
    },
};

/**
 * FROM address for outgoing mail. Must match or be allowed by your SMTP provider.
 */
export function getDefaultFrom() {
    const from = process.env.EMAIL_FROM?.trim();
    if (from) return from;
    const { user } = getEmailConfig();
    if (user) return `"TasQuash" <${user}>`;
    return `"TasQuash" <no-reply@localhost>`;
}

// Log config status only in non-production to avoid noise (config is validated at send time)
if (process.env.NODE_ENV !== "production") {
    const config = getEmailConfig();
    if (!config.host || !config.user || !config.pass) {
        console.warn("⚠️ Email environment variables are missing. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS (and optionally EMAIL_PORT, EMAIL_FROM).");
    } else {
        getTransporter()
            .verify()
            .then(() => console.log("✅ Mail server ready"))
            .catch((err) => console.error("❌ Mail server verify failed:", err.message));
    }
}
