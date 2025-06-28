import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import database from '../services/mysql';

const __filename = fileURLToPath(import.meta.url); // Get the url of the current file
const __dirname = path.dirname(__filename); // Get the directory of the current file

const router = express.Router();

router.get('/loadInfo/:email', async (req, res) => {
    const email = req.params.email;
    try {
        const [admin] = await database.query("SELECT * FROM administrator WHERE email = ?", [email]);
        console.log(admin);
        res.json(admin);
    } catch (error) {
        console.error(error);
    }
})

router.get('/validateProfileEmail/:id/:email', async (req, res) => {
    const adminID = req.params.id;
    const email = req.params.email;
    try {
        const [validation1] = await database.query("SELECT * FROM administrator WHERE email = ?", [email]);
        if (validation1.length > 0) {
            return res.json({ status: validation1[0].ID == adminID ? "empty" : "existed" });
        }

        const [validation2] = await database.query("SELECT * FROM cleaner WHERE email = ?", [email]);
        if (validation2.length > 0) {
            return res.json({ status: "existed" });
        }

        res.json({ status: "empty" }); // Email is not found in both tables
    } catch (error) {
        console.log(error);
    }
})

router.post('/updateProfile', async (req, res) => {
    const { adminemail, name, email, gender, phone } = req.body;
    try {
        const [edit] = await database.query("UPDATE administrator SET name = ?, email = ?, gender = ?, contact = ? WHERE email = ?", [name, email, gender, phone, adminemail]);
        console.log(edit);
        if (edit.warningStatus == 0) {
            res.json({ status: "success" });
        } else {
            res.json({ status: "failed" });
        }
    } catch (error) {
        console.log(error);
    }
})

router.post('/validatePassword', async (req, res) => {
    const { adminemail, oldpassword } = req.body;
    try {
        const [validate] = await database.query("SELECT * FROM administrator WHERE email = ? AND password = ?", [adminemail, oldpassword]);
        console.log(validate);
        if (validate.length > 0) {
            res.json({ status: "success" });
        } else {
            res.json({ status: "failed" });
        }
    } catch (error) {
        console.log(error);
    }
})

router.post('/changePassword', async (req, res) => {
    const { adminemail, newpassword } = req.body;
    try {
        const [update] = await database.query("UPDATE administrator SET password = ? WHERE email = ?", [newpassword, adminemail]);
        console.log(update);
        if (update.warningStatus == 0) {
            res.json({ status: "success" });
        } else {
            res.json({ status: "failed" });
        }
    } catch (error) {
        console.log(error);
    }
})

export default router;