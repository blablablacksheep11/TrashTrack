import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import database from '../services/mysql';

const __filename = fileURLToPath(import.meta.url); // Get the url of the current file
const __dirname = path.dirname(__filename); // Get the directory of the current file

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