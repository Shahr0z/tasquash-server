export function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export function parseEmailOrPhone(value) {
    if (!value || typeof value !== "string") {
        return { type: null };
    }
    const trimmed = value.trim();
    const hasAt = trimmed.includes("@");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (hasAt && emailRegex.test(trimmed)) {
        return { type: "email", email: trimmed.toLowerCase() };
    }
    const digitsOnly = trimmed.replace(/\D/g, "");
    if (digitsOnly.length >= 10) {
        const phone = digitsOnly.replace(/^0+/, "") || digitsOnly;
        return { type: "phone", phone };
    }
    return { type: null };
}
