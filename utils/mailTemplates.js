export const authOTPTemplate = (otp, context = "verification") => {
    return {
        subject: "TasQuash Verification Code",
        html: `
      <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 24px;">
        <div style="max-width: 500px; margin: auto; background: #ffffff; padding: 24px; border-radius: 8px;">
          <h2 style="color: #111827; margin-bottom: 16px;">TasQuash Verification Code</h2>
          <p style="color: #374151; font-size: 14px;">
            Use this code to ${context === "register" ? "complete your registration" : "sign in to your account"}.
          </p>
          <p style="color: #374151; font-size: 14px; margin-top: 16px;">Your One Time Password (OTP):</p>
          <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #111827; margin: 16px 0;">
            ${otp}
          </div>
          <p style="color: #6b7280; font-size: 13px;">
            This code is valid for 10 minutes. Do not share this code with anyone.
          </p>
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
          <p style="color: #9ca3af; font-size: 12px;">
            © ${new Date().getFullYear()} TasQuash. All rights reserved.
          </p>
        </div>
      </div>
    `,
    };
};

export const forgotPasswordOTPTemplate = (otp) => {
  return {
    subject: "TasQuash Password Reset Code",

    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 24px;">
        <div style="max-width: 500px; margin: auto; background: #ffffff; padding: 24px; border-radius: 8px;">
          <h2 style="color: #111827; margin-bottom: 16px;">TasQuash Password Reset</h2>

          <p style="color: #374151; font-size: 14px;">
            We received a request to reset your TasQuash account password.
          </p>

          <p style="color: #374151; font-size: 14px; margin-top: 16px;">
            Your One Time Password (OTP):
          </p>

          <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #111827; margin: 16px 0;">
            ${otp}
          </div>

          <p style="color: #6b7280; font-size: 13px;">
            This code is valid for 10 minutes. Do not share this code with anyone.
          </p>

          <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">
            If you did not request this, you can safely ignore this email.
          </p>

          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />

          <p style="color: #9ca3af; font-size: 12px;">
            © ${new Date().getFullYear()} TasQuash. All rights reserved.
          </p>
        </div>
      </div>
    `,
  };
};

export const welcomeEmailTemplate = (fullName) => {
  return {
    subject: "Welcome to TasQuash 🎉",

    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 24px;">
        <div style="max-width: 500px; margin: auto; background: #ffffff; padding: 24px; border-radius: 8px;">
          <h2 style="color: #111827; margin-bottom: 16px;">
            Welcome to TasQuash
          </h2>

          <p style="color: #374151; font-size: 14px;">
            Hi ${fullName},
          </p>

          <p style="color: #374151; font-size: 14px; margin-top: 12px;">
            We are excited to have you on board. Your TasQuash account has been successfully created.
          </p>

          <p style="color: #374151; font-size: 14px; margin-top: 12px;">
            You can now explore the platform, manage your tasks, and make the most out of TasQuash.
          </p>

    

          <p style="color: #6b7280; font-size: 13px;">
            If you have any questions or need help, feel free to reach out to our support team.
          </p>

          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />

          <p style="color: #9ca3af; font-size: 12px;">
            © ${new Date().getFullYear()} TasQuash. All rights reserved.
          </p>
        </div>
      </div>
    `,
  };
};


