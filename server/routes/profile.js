import express from 'express';
import database from '../services/mysql.js';

const router = express.Router();

router.get('/loadInfo/:adminEmail', async (req, res) => {
    const adminEmail = req.params.adminEmail;
    try {
        const [admin] = await database.query("SELECT * FROM administrator WHERE email = ?", [adminEmail]);
        res.json(admin);
    } catch (error) {
        console.error(error);
    }
})

router.get('/validateProfileEmail/:adminID/:adminEmail', async (req, res) => {
    const adminID = req.params.adminID;
    const adminEmail = req.params.adminEmail;
    try {
        const [cleanerValidation] = await database.query("SELECT * FROM cleaner WHERE email = ?", [adminEmail]);
        if (cleanerValidation.length > 0) {
            return res.json({ status: "existed" });
        }

        const [adminValidation] = await database.query("SELECT * FROM administrator WHERE email = ?", [adminEmail]);
        if (adminValidation.length > 0) {
            return res.json({ status: adminValidation[0].ID == adminID ? "empty" : "existed" });
        }

        res.json({ status: "empty" }); // Email is not found in both tables
    } catch (error) {
        console.log(error);
    }
})

router.post('/updateProfile', async (req, res) => {
    const { adminemail, name, email, gender, phone } = req.body;
    try {
        const [update] = await database.query("UPDATE administrator SET name = ?, email = ?, gender = ?, contact = ? WHERE email = ?", [name, email, gender, phone, adminemail]);
        if (update.warningStatus == 0) {
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