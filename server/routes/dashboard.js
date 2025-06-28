import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import database from '../services/mysql';

const __filename = fileURLToPath(import.meta.url); // Get the url of the current file
const __dirname = path.dirname(__filename); // Get the directory of the current file

const router = express.Router();

router.get('/loadBinsCount', async (req, res) => {
    try {
        const [bins] = await database.query("SELECT * FROM bin");
        res.json(bins);
    } catch (error) {
        console.log(error);
    }
})

router.get('/loadCleanerCount', async (req, res) => {
    try {
        const [cleaners] = await database.query("SELECT * FROM cleaner");
        res.json(cleaners);
    } catch (error) {
        console.log(error);
    }
})

router.get('/loadFreeBinTable', async (req, res) => {
    try {
        const [freebins] = await database.query("SELECT * FROM bin WHERE status = 'available'");
        res.json(freebins);
    } catch (error) {
        console.log(error);
    }
})

router.get('/loadFulledBinTable', async (req, res) => {
    try {
        const [fulledbins] = await database.query("SELECT * FROM bin WHERE status = 'unavailable'");
        res.json(fulledbins);
    } catch (error) {
        console.log(error);
    }
})

router.get('/initializeChart&Graph', async (req, res) => {
    try {
        const [record] = await database.query("SELECT * FROM bin");
        res.json(record);
    } catch (error) {
        console.log(error);
    }
})

router.get('/fetchChart/:id', async (req, res) => {
    const binid = req.params.id;
    try {
        const [bin] = await database.query("SELECT * FROM bin WHERE ID = ?", [binid]);
        console.log(bin);
        res.json(bin);
    } catch (error) {
        console.log(error);
    }
})

router.get('/fetchGraph/:id', async (req, res) => {
    const binid = req.params.id;
    try {
        const [date] = await database.query("SELECT DISTINCT DATE(collection) AS date FROM bin_history WHERE binID = ?  ORDER BY date;", [binid]);
        res.json(date);
    } catch (error) {
        console.log(error);
    }
})

router.get('/getHistory/:id/:date', async (req, res) => {
    const binid = req.params.id;
    const date = req.params.date;

    try {
        const [history] = await database.query("SELECT COUNT(*) as sum FROM bin_history WHERE binID = ? AND DATE(collection) = CONVERT_TZ(?, '+00:00', '+08:00') AND collection IS NOT NULL", [binid, date]);
        console.log(history);
        res.json(history);
    } catch (error) {
        console.log(error);
    }
})

router.get('/getDisposalOverview', async (req, res) => {
    try {
        const [disposalOverview] = await database.query("SELECT garbage_type, COUNT(*) as count FROM disposal_records GROUP BY garbage_type");
        const overview = {
            paper: 0,
            plastic: 0,
            general: 0
        };

        disposalOverview.forEach(record => {
            if (record.garbage_type == "1") {
                overview.paper = record.count;
            } else if (record.garbage_type == "2") {
                overview.plastic = record.count;
            } else if (record.garbage_type == "4") {
                overview.general = record.count;
            }
        });

        res.json(overview);
    } catch (error) {
        console.log(error);
    }
})

export default router;