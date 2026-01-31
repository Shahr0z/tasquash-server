import twilio from "twilio";


function cleanEnv(value) {
    if (value == null || typeof value !== "string") return "";
    return value.trim().replace(/^"|"$/g, "");
}

const accountSidRaw = cleanEnv(process.env.TWILIO_ACCOUNT_SID);
const authToken = cleanEnv(process.env.TWILIO_AUTH_TOKEN);
const verifyServiceSid = cleanEnv(process.env.TWILIO_VERIFY_SERVICE_SID);
/** When using API Key (SK), set this to your main Account SID (starts with AC). */
const mainAccountSid = cleanEnv(process.env.TWILIO_MAIN_ACCOUNT_SID);
const twilioPhoneNumber = cleanEnv(process.env.TWILIO_PHONE_NUMBER);

let twilioClient = null;

const getTwilioClient = () => {
    if (!twilioClient) {
        if (!accountSidRaw || !authToken) {
            throw new Error("Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
        }
        if (accountSidRaw.startsWith("AC")) {
            twilioClient = twilio(accountSidRaw, authToken);
        } else if (accountSidRaw.startsWith("SK")) {
            if (!mainAccountSid || !mainAccountSid.startsWith("AC")) {
                throw new Error(
                    "You are using an API Key (SK) for TWILIO_ACCOUNT_SID. Add to .env: TWILIO_MAIN_ACCOUNT_SID=AC... (get AC from Twilio Console dashboard or Account → API keys & tokens). Or use Account SID in TWILIO_ACCOUNT_SID and primary Auth Token in TWILIO_AUTH_TOKEN instead of the API Key."
                );
            }
            twilioClient = twilio(accountSidRaw, authToken, { accountSid: mainAccountSid });
        } else {
            throw new Error(
                "TWILIO_ACCOUNT_SID must start with AC (Account SID) or SK (API Key). " +
                "Get your Account SID from Twilio Console → Account → API keys & tokens."
            );
        }
    }
    return twilioClient;
};

/**
 * Send OTP via Twilio Verify Service
 * @param {string} phoneNumber - Phone number with country code (e.g., +1234567890)
 * @param {string} channel - 'sms' or 'call'
 * @returns {Promise<object>} Verification object
 */
export const sendOTP = async (phoneNumber, channel = "sms") => {
    if (!verifyServiceSid) {
        const msg = "TWILIO_VERIFY_SERVICE_SID is not set. Twilio Console → Verify → Services → Create new → copy the SID (starts with VA). Add to .env: TWILIO_VERIFY_SERVICE_SID=VA... (see https://www.twilio.com/docs/verify/api)";
        console.error("Twilio Send OTP:", msg);
        throw new Error(msg);
    }
    if (!verifyServiceSid.startsWith("VA")) {
        const hint = verifyServiceSid ? ` You have "${verifyServiceSid.slice(0, 2)}..." (need VA...).` : " It is empty or missing.";
        const msg = "TWILIO_VERIFY_SERVICE_SID must be a Verify Service SID starting with VA." + hint + " Twilio Console → Verify → Services → your service → copy SID.";
        console.error("Twilio Send OTP:", msg);
        throw new Error(msg);
    }
    try {
        const client = getTwilioClient();

        const verification = await client.verify.v2
            .services(verifyServiceSid)
            .verifications.create({
                to: phoneNumber,
                channel: channel,
            });

        return {
            success: true,
            status: verification.status,
            sid: verification.sid,
        };
    } catch (error) {
        const code = error?.code;
        const message = error?.message || "Failed to send OTP";
        const moreInfo = error?.moreInfo;
        console.error("Twilio Send OTP Error:", { code, message, moreInfo, phone: phoneNumber });

        if (code === 21608) {
            throw new Error(
                "Trial account: this phone number must be verified in Twilio first. " +
                "Go to https://www.twilio.com/console/phone-numbers/verified and add " + phoneNumber + ", " +
                "or upgrade your Twilio account to send to any number."
            );
        }
        throw new Error(message);
    }
};

/**
 * Verify OTP using Twilio Verify Service
 * @param {string} phoneNumber - Phone number with country code
 * @param {string} code - OTP code entered by user
 * @returns {Promise<object>} Verification check object
 */
export const verifyOTP = async (phoneNumber, code) => {
    if (!verifyServiceSid || !verifyServiceSid.startsWith("VA")) {
        const hint = verifyServiceSid ? ` (current value starts with "${verifyServiceSid.slice(0, 2)}")` : " (not set)";
        const msg = "TWILIO_VERIFY_SERVICE_SID must be a Verify Service SID starting with VA. Twilio Console → Verify → Services → copy SID." + hint;
        console.error("Twilio Verify OTP:", msg);
        throw new Error(msg);
    }
    try {
        const client = getTwilioClient();

        const verificationCheck = await client.verify.v2
            .services(verifyServiceSid)
            .verificationChecks.create({
                to: phoneNumber,
                code: String(code).trim(),
            });

        return {
            success: verificationCheck.status === "approved",
            status: verificationCheck.status,
            valid: verificationCheck.valid,
        };
    } catch (error) {
        const code = error?.code;
        const message = error?.message || "Failed to verify OTP";
        const moreInfo = error?.moreInfo;
        console.error("Twilio Verify OTP Error:", { code, message, moreInfo, phone: phoneNumber });
        throw new Error(message);
    }
};

/**
 * Send SMS directly (for custom messages)
 * @param {string} to - Phone number with country code
 * @param {string} message - Message body
 * @returns {Promise<object>} Message object
 */
export const sendSMS = async (to, message) => {
    if (!twilioPhoneNumber) {
        throw new Error("TWILIO_PHONE_NUMBER is not set. Get a number from Twilio Console → Phone Numbers (see https://www.twilio.com/docs/messaging/quickstart)");
    }
    try {
        const client = getTwilioClient();

        const sms = await client.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: to,
        });

        return {
            success: true,
            sid: sms.sid,
            status: sms.status,
        };
    } catch (error) {
        console.error("Twilio Send SMS Error:", error);
        throw new Error(error.message || "Failed to send SMS");
    }
};

export default {
    sendOTP,
    verifyOTP,
    sendSMS,
};
