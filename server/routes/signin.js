import express from 'express';
import database from '../services/mysql.js';

const router = express.Router();

router.post('/signIn', async (req, res) => { // When user request for signin
    const { email, password } = req.body;
    try {
        const [admin] = await database.query("SELECT * FROM administrator WHERE email = ?", [email]);
        if (admin.length > 0) {
            if (admin[0].password == password) {
                res.json({ status: "success", admin: admin[0] });
            } else {
                res.json({ status: "failed" });
            }
        } else {
            res.json({ status: "empty" });
        }
    } catch (error) {
        console.log(error);
    }
})

export default router;