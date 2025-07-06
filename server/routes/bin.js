import express from 'express';
import database from '../services/mysql.js';

const router = express.Router();

router.get('/loadRegisteredBin', async (req, res) => {
    try {
        const [bins] = await database.query("SELECT * FROM bin");
        res.json(bins);
    } catch (error) {
        console.log(error);
    }
})

export default router;