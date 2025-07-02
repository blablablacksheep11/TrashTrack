import express from 'express';
import database from '../services/mysql.js';

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
        const [cleaners] = await database.query("SELECT COUNT(*) as total FROM cleaner");
        res.json(cleaners);
    } catch (error) {
        console.log(error);
    }
})

router.get('/loadFreeBinTable', async (req, res) => {
    try {
        const [freeBins] = await database.query("SELECT * FROM bin WHERE status = 'available'");
        res.json(freeBins);
    } catch (error) {
        console.log(error);
    }
})

router.get('/loadFulledBinTable', async (req, res) => {
    try {
        const [fulledBins] = await database.query("SELECT * FROM bin WHERE status = 'unavailable'");
        res.json(fulledBins);
    } catch (error) {
        console.log(error);
    }
})

router.get('/initializeChart&Graph', async (req, res) => {
    try {
        const [bins] = await database.query("SELECT * FROM bin");
        res.json(bins);
    } catch (error) {
        console.log(error);
    }
})

router.get('/fetchChart/:binID', async (req, res) => {
    const binID = req.params.binID;
    try {
        const [bin] = await database.query("SELECT * FROM bin WHERE ID = ?", [binID]);
        res.json(bin);
    } catch (error) {
        console.log(error);
    }
})

router.get('/fetchGraph/:binID', async (req, res) => {
    const binID = req.params.binID;
    try {
        const [date] = await database.query("SELECT DISTINCT DATE(collection) AS date FROM bin_history WHERE binID = ?  ORDER BY date;", [binID]);
        res.json(date);
    } catch (error) {
        console.log(error);
    }
})

router.get('/getHistory/:binID/:collectionDate', async (req, res) => {
    const binID = req.params.binID;
    const collectionDate = req.params.collectionDate;

    try {
        const [history] = await database.query("SELECT COUNT(*) as sum FROM bin_history WHERE binID = ? AND DATE(collection) = CONVERT_TZ(?, '+00:00', '+08:00') AND collection IS NOT NULL", [binID, collectionDate]);
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