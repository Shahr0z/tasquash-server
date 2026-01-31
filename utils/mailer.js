import nodemailer from "nodemailer";

const EMAIL_HOST = process.env.EMAIL_HOST?.trim();
const EMAIL_USER = process.env.EMAIL_USER?.trim();
const EMAIL_PASS = process.env.EMAIL_PASS?.trim();
const EMAIL_PORT = Number(process.env.EMAIL_PORT) || 465;

const SECURE = EMAIL_PORT === 465;

if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
    console.warn("⚠️ Email environment variables are missing");
    console.warn("   EMAIL_HOST:", EMAIL_HOST ? "✓ Set" : "✗ Missing");
    console.warn("   EMAIL_USER:", EMAIL_USER ? "✓ Set" : "✗ Missing");
    console.warn("   EMAIL_PASS:", EMAIL_PASS ? "✓ Set" : "✗ Missing");
    console.warn("   EMAIL_PORT:", EMAIL_PORT);
}

export const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: SECURE,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
    },

    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
});

if (process.env.NODE_ENV !== "production") {
    transporter.verify()
        .then(() => console.log("✅ Mail server ready"))
        .catch(err => console.error("❌ Mail server error:", err));
}

export function getDefaultFrom() {
    const from = process.env.EMAIL_FROM?.trim();
    if (from) return from;
    if (EMAIL_USER) return `"TasQuash" <${EMAIL_USER}>`;
    return `"TasQuash" <no-reply@localhost>`;
}

// import dotenv from "dotenv";
// import nodemailer from "nodemailer";
// dotenv.config({ quiet: true });

// const emailHost = (process.env.EMAIL_HOST || "").trim();
// const emailUser = (process.env.EMAIL_USER || "").trim().replace(/^"|"$/g, "");
// const emailPass = (process.env.EMAIL_PASS || "").trim().replace(/^"|"$/g, "");

// const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
// const useSecure = port === 465;

// export const transporter = nodemailer.createTransport({
//     host: emailHost || undefined,
//     port: Number.isNaN(port) ? 587 : port,
//     secure: useSecure,
//     ...(port === 587 && { requireTLS: true }),
//     auth: {
//         user: emailUser || undefined,
//         pass: emailPass || undefined,
//     },
// });

// /** Use EMAIL_FROM or "TasQuash <EMAIL_USER>" so SMTP accepts the sender (no fake domains). */
// export function getDefaultFrom() {
//     const from = (process.env.EMAIL_FROM || "").trim().replace(/^"|"$/g, "");
//     if (from) return from;
//     if (emailUser) return `"TasQuash" <${emailUser}>`;
//     return '"TasQuash" <no-reply@localhost>';
// }