import express from 'express';
import database from '../services/mysql.js';

const router = express.Router();

// To load the column chart in analytic.html
router.get('/getGarbageType/:categoryID', async (req, res) => {
    try {
        const categoryID = req.params.categoryID;
        const [garbageType] = await database.query(`SELECT
                                                        CONVERT_TZ(STR_TO_DATE(CONCAT(YEAR(disposal_datetime), WEEK(disposal_datetime, 0), ' Sunday'), '%X%V %W'), '+00:00', '+08:00') AS week_start,
                                                        COUNT(*) AS total_records
                                                    FROM disposal_records
                                                    WHERE 
                                                        STR_TO_DATE(CONCAT(YEAR(disposal_datetime), WEEK(disposal_datetime, 0), ' Sunday'), '%X%V %W') 
                                                        <= STR_TO_DATE(CONCAT(YEAR(CURDATE()), WEEK(CURDATE(), 0), ' Sunday'), '%X%V %W')
                                                        AND garbage_type = ?
                                                    GROUP BY week_start
                                                    ORDER BY week_start`, [categoryID]);

        const [categoryName] = await database.query(`SELECT category FROM garbage_type WHERE id = ?`, [categoryID]);
        res.json({ categoryName, data: garbageType });
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