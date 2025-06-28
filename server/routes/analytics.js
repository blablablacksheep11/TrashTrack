import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import database from '../services/mysql';

const __filename = fileURLToPath(import.meta.url); // Get the url of the current file
const __dirname = path.dirname(__filename); // Get the directory of the current file

const router = express.Router();

router.get('/getGarbageType/:category_id', async (req, res) => {
    try {
        const category_id = req.params.category_id;
        const [garbageType] = await database.query(`SELECT
                                                        CONVERT_TZ(STR_TO_DATE(CONCAT(YEAR(disposal_datetime), WEEK(disposal_datetime, 0), ' Sunday'), '%X%V %W'), '+00:00', '+08:00') AS week_start,
                                                        COUNT(*) AS total_records
                                                    FROM disposal_records
                                                    WHERE 
                                                        STR_TO_DATE(CONCAT(YEAR(disposal_datetime), WEEK(disposal_datetime, 0), ' Sunday'), '%X%V %W') 
                                                        <= STR_TO_DATE(CONCAT(YEAR(CURDATE()), WEEK(CURDATE(), 0), ' Sunday'), '%X%V %W')
                                                        AND garbage_type = ?
                                                    GROUP BY week_start
                                                    ORDER BY week_start`, [category_id]);

        const [categoryName] = await database.query(`SELECT category FROM garbage_type WHERE id = ?`, [category_id]);
        console.log(garbageType)
        res.json({ categoryName, data: garbageType });
    } catch (error) {
        console.log(error);
    }
})

router.get('/getGarbageOverview', async (req, res) => {
    try {
        const [garbageType] = await database.query('SELECT DISTINCT disposal_records.garbage_type, garbage_type.category FROM disposal_records INNER JOIN garbage_type ON disposal_records.garbage_type = garbage_type.id');

        let counts = [];

        for (const type of garbageType) {
            const [[{ count }]] = await database.query(`SELECT COUNT(*) AS count FROM disposal_records WHERE garbage_type = ?`, [type.garbage_type]);

            counts.push({
                category: type.category,
                garbage_type: type.garbage_type,
                count
            });
        }
        res.json(counts);
    } catch (error) {
        console.log(error);
    }
})

export default router;