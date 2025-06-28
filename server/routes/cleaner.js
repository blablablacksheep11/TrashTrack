import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import database from '../services/mysql';

const __filename = fileURLToPath(import.meta.url); // Get the url of the current file
const __dirname = path.dirname(__filename); // Get the directory of the current file

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
        const [add] = await database.query("INSERT INTO cleaner (name, gender, IC, email) VALUES(?,?,?,?)", [name, gender, ic, email]);
        if (add.warningStatus == 0) {
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
    console.log(name);
    console.log(gender);
    console.log(ic);
    console.log(email);
    try {
        const [edit] = await database.query("UPDATE cleaner SET name = ?, gender = ?, IC = ?, email = ? WHERE ID = ?", [name, gender, ic, email, cleanerID]);
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

router.get('/fetchCleaner/:id', async (req, res) => {
    const cleanerID = req.params.id;
    try {
        const [fetch] = await database.query("SELECT * FROM cleaner WHERE ID = ?", [cleanerID]);
        console.log(fetch);
        res.json(fetch);
    } catch (error) {
        console.log(error);
    }
})

router.get('/deleteCleaner/:id', async (req, res) => {
    const cleanerID = req.params.id;
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

router.get('/validateCleanerEmail/:email', async (req, res) => { // This is used when adding new cleaner
    const email = req.params.email;
    try {
        const [validate1] = await database.query("SELECT * FROM cleaner WHERE email = ?", [email]);
        const [validate2] = await database.query("SELECT * FROM administrator WHERE email = ?", [email]);
        if (validate1.length > 0 || validate2.length > 0) {
            res.json({ status: "existed" });
        } else {
            res.json({ status: "empty" });
        }
    } catch (error) {
        console.log(error);
    }
})

router.get('/validateCleanerIC/:ic', async (req, res) => { // This is used when adding new cleaner
    const ic = req.params.ic;
    try {
        const [validate] = await database.query("SELECT * FROM cleaner WHERE IC = ?", [ic]);
        if (validate.length > 0) {
            res.json({ status: "existed" });
        } else {
            res.json({ status: "empty" });
        }
    } catch (error) {
        console.log(error);
    }
})

router.get('/checkCleanerEmail/:id/:email', async (req, res) => { // This is used when editing existing cleaner
    const cleanerID = req.params.id;
    const email = req.params.email;

    try {
        const [validation1] = await database.query("SELECT * FROM cleaner WHERE email = ?", [email]);
        if (validation1.length > 0) {
            return res.json({ status: validation1[0].ID == cleanerID ? "empty" : "existed" });
        }

        const [validation2] = await database.query("SELECT * FROM administrator WHERE email = ?", [email]);
        if (validation2.length > 0) {
            return res.json({ status: "existed" });
        }

        res.json({ status: "empty" }); // Email is not found in both tables
    } catch (error) {
        console.log(error);
    }
})

router.get('/checkCleanerIC/:id/:IC', async (req, res) => { // This is used when editing existing cleaner
    const cleanerID = req.params.id;
    const IC = req.params.IC;

    try {
        const [check] = await database.query("SELECT * FROM cleaner WHERE IC = ?", [IC]);
        if (check.length > 0) {
            if (check[0].ID == cleanerID) {
                res.json({ status: "empty" });
            } else {
                res.json({ status: "existed" });
            }
        } else {
            res.json({ status: "empty" });
        }
    } catch (error) {
        console.log(error);
    }
})

export default router;