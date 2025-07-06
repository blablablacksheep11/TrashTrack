import { createTransport } from 'nodemailer';

const transporter = createTransport({
    service: "gmail", // Use Gmail's SMTP service
    auth: {
        user: process.env.GOOGLE_SMTP_EMAIL_ADDRESS, // Your email address
        pass: process.env.GOOGLE_SMTP_API_KEY
    }
});

export default transporter;