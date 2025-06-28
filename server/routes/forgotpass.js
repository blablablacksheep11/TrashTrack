import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import speakeasy from 'speakeasy';
import {redis} from '../services/redis'
import database from '../services/mysql';
import transporter from '../services/mailer.js';

const __filename = fileURLToPath(import.meta.url); // Get the url of the current file
const __dirname = path.dirname(__filename); // Get the directory of the current file

const router = express.Router();

async function send(email, name, otp) {
    try {
        const info = await transporter.sendMail({
            from: '"SmartBin Manager" <smartbinmanager@gmail.com>', // sender address
            to: email, // list of receivers
            subject: "OTP for password reset", // Subject line
            text: `Dear ${name},\nYou have requested to reset your password. Please use the following One-Time Password (OTP) to proceed:\nOTP Code: ${otp}\n This OTP is valid for 2 minutes. Do not share this code with anyone for security reasons.`, // plain text body
            html: `
            <p>Dear ${name},</p>
            <br>
            <p>You have requested to reset your password. Please use the following <b>One-Time Password (OTP)</b> to proceed:</p>
            <br>
            <b>OTP Code: </b>${otp}
            <br>
            <b>This OTP is valid for 2 minutes.</b>Do not share this code with anyone for security reasons.
            `, // HTML body
        });

        console.log("Message sent");
    } catch (error) {
        console.log(error);
    }
}

router.post('/forgotpassword', async (req, res) => { // When user request for password reset
    const { email } = req.body;
    try {
        const [account] = await database.query("SELECT * FROM administrator WHERE email = ?", [email]);
        console.log(account);
        if (account.length > 0) { // If the email exists in the database
            var secret = speakeasy.generateSecret({ length: 20 });  // Generate a secret code

            const otp = speakeasy.totp({ // Convert the secret code to a one-time password
                secret: secret.base32,
                encoding: "base32",
            });

            const pin = `pin:${email}`;
            const otpPin = secret.base32.toString();

            async function store(pin, secret) {
                try {
                    const pinExists = await redis.exists(pin); // Check if OTP exists

                    if (pinExists == 0) {
                        await redis.setEx(pin, 120, secret);
                    } else if (pinExists == 1) {
                        await redis.del(pin); // Ensure deletion completes before setting new value
                        await redis.setEx(pin, 120, secret);
                    }

                    console.log("Redis storage updated successfully.");
                } catch (error) {
                    console.error("Redis error:", error);
                }
            }

            store(pin, otpPin);
            send(account[0].email, account[0].name, otp).catch(console.error);
            res.json({ status: "success", admin: account[0], otp: otp });
        } else { // If the email does not exist in the database
            res.json({ status: "empty" });
        }
    } catch (error) {
        console.log(error);
    }
})

router.post('/verification', async (req, res) => {
    const { otp, email } = req.body;
    const pin = `pin:${email}`;

    async function fetch(pin, secret) {
        try {
            const pinExists = await redis.exists(pin); // Check if OTP exists

            if (pinExists == 0) {
                res.json({ status: "expired" });
            } else if (pinExists == 1) {
                const originalpin = await redis.get(pin);

                const verification = speakeasy.totp.verify({ // Verify the one-time password
                    secret: originalpin, // The correct otp (raw)
                    encoding: "base32",
                    token: secret, // The user input
                    window: 4
                });

                if (verification) {
                    res.json({ status: "success" });
                } else {
                    res.json({ status: "invalid" });
                }
                console.log(verification);
            }
        } catch (error) {
            console.error("Redis error:", error);
            res.json({ status: "failed" });
        }
    }

    fetch(pin, otp);
})

router.post('/resend', async (req, res) => {
    const { email } = req.body;
    const [account] = await database.query("SELECT * FROM administrator WHERE email = ?", [email]);

    try {
        var secret = speakeasy.generateSecret({ length: 20 });  // Generate a secret code

        const otp = speakeasy.totp({ // Convert the secret code to a one-time password
            secret: secret.base32,
            encoding: "base32",
        });

        const pin = `pin:${email}`;
        const otpPin = secret.base32.toString();

        async function store(pin, secret) {
            try {
                const pinExists = await redis.exists(pin); // Check if OTP exists

                if (pinExists == 0) {
                    await redis.setEx(pin, 120, secret);
                } else if (pinExists == 1) {
                    await redis.del(pin); // Ensure deletion completes before setting new value
                    await redis.setEx(pin, 120, secret);
                }

                console.log("Redis storage updated successfully.");
            } catch (error) {
                console.error("Redis error:", error);
            }
        }

        store(pin, otpPin);
        send(account[0].email, account[0].name, otp).catch(console.error);
        res.json({ status: "success", admin: account[0], otp: otp });
    } catch (error) {
        console.log(error);
        res.json({ status: "failed" });
    }
})

router.post('/resetpassword', async (req, res) => {
    const { email, password, confirmpassword } = req.body;
    const pin = `pin:${email}`;

    try {
        const [reset] = await database.query("UPDATE administrator SET password = ? WHERE email = ?", [password, email]);
        if (reset.warningStatus == 0) {
            res.json({ status: "success" });
        } else {
            res.json({ status: "failed" });
        }
    } catch (error) {
        console.error("Database error:", error);
    }
})

export default router;