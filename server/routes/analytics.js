import express from 'express';
import database from '../services/mysql.js';
import dayjs from 'dayjs';

const router = express.Router();

// To load the column chart in analytic.html
router.get('/getGarbageType/:categoryID', async (req, res) => {
    try {
        const categoryID = req.params.categoryID;
        let [garbageDisposal] = await database.query(`SELECT
                                                        STR_TO_DATE(CONCAT(YEARWEEK(disposal_datetime, 0), ' Sunday'), '%X%V %W') AS week_start,
                                                        COUNT(*) AS total_records
                                                        FROM disposal_records
                                                        WHERE 
                                                            YEARWEEK(disposal_datetime, 0) <= YEARWEEK(CURDATE(), 0)
                                                            AND garbage_type = ?
                                                        GROUP BY week_start
                                                        ORDER BY week_start;`, [categoryID]);

        if (garbageDisposal.length < 5) {
            let lastDate = garbageDisposal.length > 0 ? dayjs(garbageDisposal[garbageDisposal.length - 1].week_start) : dayjs();
            let missing = 5 - garbageDisposal.length;

            let futureData = Array(missing).fill(null).map((_, i) => ({
                week_start: lastDate.add(i + 1, "week").format("YYYY-MM-DD"),
                total_records: 0,
            }));

            garbageDisposal = garbageDisposal.concat(futureData);
        }

        const [categoryName] = await database.query(`SELECT category FROM garbage_type WHERE id = ?`, [categoryID]);
        res.json({ categoryName, data: garbageDisposal });
    } catch (error) {
        console.log(error);
    }
})

// To load the pie chart in analytics.html
router.get('/getGarbageOverview', async (req, res) => {
    try {
        // Fetch the garbage type's name, color code, and its unique ID
        const [garbageType] = await database.query('SELECT DISTINCT disposal_records.garbage_type, garbage_type.category, garbage_type.color_code FROM disposal_records INNER JOIN garbage_type ON disposal_records.garbage_type = garbage_type.id ORDER BY disposal_records.garbage_type');

        let counts = [];

        for (const type of garbageType) {
            const [[{ count }]] = await database.query(`SELECT COUNT(*) AS count FROM disposal_records WHERE garbage_type = ?`, [type.garbage_type]);

            counts.push({
                category: type.category,
                count,
                color: type.color_code,
            });
        }
        res.json(counts);
    } catch (error) {
        console.log(error);
    }
})

export default router;