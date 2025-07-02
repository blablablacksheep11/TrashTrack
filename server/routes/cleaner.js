import express from 'express';
import database from '../services/mysql.js';

const router = express.Router();

router.get('/loadCleaner', async (req, res) => {
    try {
        const [cleaners] = await database.query("SELECT * FROM cleaner");
        res.json(cleaners);
    } catch (error) {
        console.log(error);
    }
})

router.post('/addCleaner', async (req, res) => {
    const { name, gender, ic, email } = req.body;
    try {
        const [insert] = await database.query("INSERT INTO cleaner (name, gender, IC, email) VALUES(?,?,?,?)", [name, gender, ic, email]);
        if (insert.warningStatus == 0) {
            res.json({ status: "success" });
        } else {
            res.json({ status: "failed" });
        }
    } catch (error) {
        console.log(error);
    }
})

router.post('/editCleaner', async (req, res) => {
    const { cleanerID, name, gender, ic, email } = req.body;
    try {
        const [update] = await database.query("UPDATE cleaner SET name = ?, gender = ?, IC = ?, email = ? WHERE ID = ?", [name, gender, ic, email, cleanerID]);
        if (update.warningStatus == 0) {
            res.json({ status: "success" });
        } else {
            res.json({ status: "failed" });
        }
    } catch (error) {
        console.log(error);
    }
})

router.get('/fetchCleaner/:cleanerID', async (req, res) => {
    const cleanerID = req.params.cleanerID;
    try {
        const [cleaner] = await database.query("SELECT * FROM cleaner WHERE ID = ?", [cleanerID]);
        res.json(cleaner);
    } catch (error) {
        console.log(error);
    }
})

router.get('/deleteCleaner/:cleanerID', async (req, res) => {
    const cleanerID = req.params.cleanerID;
    try {
        const [del] = await database.query("DELETE FROM cleaner WHERE ID = ?", [cleanerID]);
        if (del.warningStatus == 0) {
            res.json({ status: "success" });
        } else {
            res.json({ status: "failed" });
        }
    } catch (error) {
        console.log(error);
    }
})

router.get('/validateCleanerEmail/:cleanerEmail', async (req, res) => { // This is used when adding new cleaner
    const cleanerEmail = req.params.cleanerEmail;
    try {
        const [cleanerValidation] = await database.query("SELECT * FROM cleaner WHERE email = ?", [cleanerEmail]); // Check either email existed in cleaner table
        const [adminValidation] = await database.query("SELECT * FROM administrator WHERE email = ?", [cleanerEmail]); // Check either email existed in admin table
        if (cleanerValidation.length > 0 || adminValidation.length > 0) {
            res.json({ status: "existed" });
        } else {
            res.json({ status: "empty" });
        }
    } catch (error) {
        console.log(error);
    }
})

router.get('/validateCleanerIC/:cleanerIC', async (req, res) => { // This is used when adding new cleaner
    const cleanerIC = req.params.cleanerIC;
    try {
        const [validation] = await database.query("SELECT * FROM cleaner WHERE IC = ?", [cleanerIC]); // Check either IC existed in cleaner table
        if (validation.length > 0) {
            res.json({ status: "existed" });
        } else {
            res.json({ status: "empty" });
        }
    } catch (error) {
        console.log(error);
    }
})

router.get('/checkCleanerEmail/:cleanerID/:cleanerEmail', async (req, res) => { // This is used when editing existing cleaner
    const cleanerID = req.params.cleanerID;
    const cleanerEmail = req.params.cleanerEmail;

    try {
        // Critical to start from the admin table first
        const [adminChecking] = await database.query("SELECT * FROM administrator WHERE email = ?", [cleanerEmail]); // Check either email existed in admin table
        if (adminChecking.length > 0) {
            return res.json({ status: "existed" });
        }

        const [cleanerChecking] = await database.query("SELECT * FROM cleaner WHERE email = ?", [cleanerEmail]); // Check either email existed in cleaner table
        if (cleanerChecking.length > 0) {
            return res.json({ status: cleanerChecking[0].ID == cleanerID ? "empty" : "existed" });
        }

        res.json({ status: "empty" }); // Email is not found in both tables
    } catch (error) {
        console.log(error);
    }
})

router.get('/checkCleanerIC/:cleanerID/:cleanerIC', async (req, res) => { // This is used when editing existing cleaner
    const cleanerID = req.params.cleanerID;
    const cleanerIC = req.params.cleanerIC;

    try {
        const [check] = await database.query("SELECT * FROM cleaner WHERE IC = ?", [cleanerIC]); // Check either IC existed in cleaner table
        if (check.length > 0) {
            res.json({ status: check[0].ID == cleanerID ? "empty" : "existed" });
        } else {
            res.json({ status: "empty" });
        }
    } catch (error) {
        console.log(error);
    }
})

export default router;