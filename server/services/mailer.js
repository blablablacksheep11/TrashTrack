import { createTransport } from 'nodemailer';

const transporter = createTransport({
    service: "gmail", // Use Gmail's SMTP service
    auth: {
        user: "EMAIL_ADDRESS", // Your email address
        pass: "API_KEY"
    }
});

export default transporter;