import { Resend } from "resend";
import { ENV } from "./env.js";
// Nếu không có RESEND_API_KEY thì dùng giá trị giả để tránh lỗi
const resendKey = ENV.RESEND_API_KEY || "re_test_123";
export const resendClient = new Resend(resendKey);
export const sender = {
email: ENV.EMAIL_FROM || "test@example.com",
name: ENV.EMAIL_FROM_NAME || "Chatify Dev",
};
console.log(" ✅  Resend client initialized with key:", resendKey ? "Loaded" : "Missing");