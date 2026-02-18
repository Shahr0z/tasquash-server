import nodemailer from "nodemailer";

function getEmailConfig() {
    const host = process.env.EMAIL_HOST?.trim();
    const user = process.env.EMAIL_USER?.trim();
    const pass = process.env.EMAIL_PASS?.trim();
    const port = Number(process.env.EMAIL_PORT) || 465;
    return { host, user, pass, port };
}


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

    const isVercel = !!process.env.VERCEL;
    const timeoutMs = isVercel ? 8000 : 15000;

    const secure = port === 465;
    const transportOptions = {
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: timeoutMs,
        greetingTimeout: timeoutMs,
        socketTimeout: timeoutMs,
    };
    if (port === 587) {
        transportOptions.requireTLS = true;
    }

    return nodemailer.createTransport(transportOptions);
}


let _transporter = null;

function getTransporter() {
    if (process.env.VERCEL) {
        return createTransporter();
    }
    if (!_transporter) {
        _transporter = createTransporter();
    }
    return _transporter;
}

export function isEmailConfigured() {
    const { host, user, pass } = getEmailConfig();
    return !!(host && user && pass);
}


export async function sendEmail(options) {
    const { to, subject } = options;
    const logCtx = { to, subject, env: process.env.NODE_ENV, vercel: !!process.env.VERCEL };
    const isVercel = !!process.env.VERCEL;
    const sendTimeoutMs = isVercel ? 6000 : 12000;

    const transporter = getTransporter();
    const sendPromise = transporter.sendMail(options);

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Email send timeout after ${sendTimeoutMs}ms`)), sendTimeoutMs);
    });

    try {
        const result = await Promise.race([sendPromise, timeoutPromise]);
        console.log("[Email] Sent successfully", { ...logCtx, messageId: result.messageId });
        return result;
    } catch (err) {
        const code = err.code || err.responseCode;
        const message = err.message || String(err);
        const response = err.response || err.responseCode;
        console.error("[Email] Send failed", {
            ...logCtx,
            error: message,
            code,
            response: typeof response === "string" ? response.slice(0, 200) : response,
            command: err.command,
        });
        throw err;
    }
}

export function getTransporterOrNull() {
    if (!isEmailConfigured()) return null;
    try {
        return getTransporter();
    } catch {
        return null;
    }
}

export const transporter = {
    sendMail(options) {
        return sendEmail(options);
    },
};

export function getDefaultFrom() {
    const from = process.env.EMAIL_FROM?.trim();
    if (from) return from;
    const { user } = getEmailConfig();
    if (user) return `"TasQuash" <${user}>`;
    return `"TasQuash" <no-reply@localhost>`;
}

if (process.env.NODE_ENV !== "production") {
    const config = getEmailConfig();
    if (!config.host || !config.user || !config.pass) {
        console.warn("Email environment variables are missing. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS (and optionally EMAIL_PORT, EMAIL_FROM).");
    } else {
        getTransporter()
            .verify()
            .then(() => console.log("✅ Mail server ready"))
            .catch((err) => console.error("Mail server verify failed:", err.message));
    }
}
