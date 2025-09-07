import { createTransport } from 'nodemailer';

const transporter = createTransport({
    host: process.env.MAILER_HOST || "sandbox.smtp.mailtrap.io",
    port: process.env.MAILER_PORT || 2525,
    auth: {
        user: process.env.MAILER_USER,
        pass: process.env.MAILER_PASS
    }
});

export default transporter;