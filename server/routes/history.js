import express from 'express';
import PdfPrinter from 'pdfmake';
import database from '../services/mysql.js';

const router = express.Router();

router.get('/loadBinHistory/:binID/:pageNumber', async (req, res) => {
    const binID = req.params.binID;
    const pageNumber = req.params.pageNumber;
    const limit = 15; // Only fetch 15 records per page
    const offset = (pageNumber - 1) * limit; // Skip the records in the previous page

    try {
        const [recordCount] = await database.query("SELECT COUNT(*) as total FROM bin_history WHERE binID = ?", [binID]); // Get the total number of records
        const totalRecord = recordCount[0].total;
        const pageCount = Math.ceil((recordCount[0].total) / 15);
        const [binHistory] = await database.query("SELECT * FROM bin_history WHERE binID = ? LIMIT ? OFFSET ?", [binID, limit, offset]); // Fetch the records for the current page
        for (const history of binHistory) {
            // Convert the datetime to locale string
           
            if (history.collection == null) {
                history.collection = "Uncollected";
            }

            if (history.collectorID != null) {
                // Convert the cleanerID to the cleaner's name
                const [cleanerName] = await database.query("SELECT name FROM cleaner WHERE ID = ?", [history.collectorID]);
                history.collectorID = cleanerName[0].name;
            } else {
                history.collectorID = "Uncollected";
            }
        }
        res.json({ totalRecord, pageCount, binHistory });
    } catch (error) {
        console.log(error);
    }
})

router.get('/deleteHistory/:historyID', async (req, res) => {
    const historyID = req.params.historyID;
    try {
        const [del] = await database.query("DELETE FROM bin_history WHERE ID = ?", [historyID]);
        if (del.warningStatus == 0) {
            res.json({ status: "success" });
        } else if (del.warningStatus != 0) {
            res.json({ status: "failed" });
        }
    } catch (error) {
        console.log(error);
    }
})

router.get('/fetchHistory/:historyID', async (req, res) => {
    const historyID = req.params.historyID;
    try {
        const [fetch] = await database.query("SELECT * FROM bin_history WHERE ID = ?", [historyID]);
        console.log(fetch);
        // The datetime will be returned in timezone format
        // Split datetime into date and time
        // Convert date and time to locale string
        if (fetch[0].creation != null) {
            const creationDateTime = fetch[0].creation.toLocaleString().split(",");
            fetch[0].creationDate = creationDateTime[0];
            fetch[0].creationTime = creationDateTime[1];
            delete fetch[0].creation;
        }
        if (fetch[0].collection != null) {
            const collectionDateTime = fetch[0].collection.toLocaleString().split(",");
            fetch[0].collectionDate = collectionDateTime[0];
            fetch[0].collectionTime = collectionDateTime[1];
            delete fetch[0].collection;
        }
        console.log(fetch);
        res.json(fetch);
    } catch (error) {
        console.log(error);
    }
})

router.get('/getCleanerList', async (req, res) => {
    try {
        const [cleanerList] = await database.query("SELECT * FROM cleaner");
        res.json(cleanerList);
    } catch (error) {
        console.log(error);
    }
})

router.post('/editHistory', async (req, res) => {
    // Unlike fetch history, the colleection datetime is already preprocessed on the client side (history.html)
    const { historyID, collector, collection } = req.body;
    try {
        const [edit] = await database.query("UPDATE bin_history SET collectorID = ?, collection =? WHERE ID = ?", [collector, collection, historyID]);
        if (edit.warningStatus == 0) {
            res.json({ status: "success" });
        } else if (edit.warningStatus != 0) {
            res.json({ status: "failed" });
        }
    } catch (error) {
        console.log(error);
    }
})

router.get('/exportHistory/:binID', async (req, res) => {
    const binID = req.params.binID;
    const fonts = {
        Roboto: {
            normal: '../fonts/Roboto-Regular.ttf',
            bold: '../fonts/Roboto-Medium.ttf',
            italics: '../fonts/Roboto-Italic.ttf',
            bolditalics: '../fonts/Roboto-MediumItalic.ttf',
        },
    };

    const printer = new PdfPrinter(fonts);
    try {
        const [binHistory] = await database.query("SELECT * FROM bin_history WHERE binID = ?", [binID]);
        for (const history of binHistory) {
            // Convert the datetime to locale string
            if (history.creation != null) {
                history.creation = history.creation.toLocaleString();
            }

            if (history.collection != null) {
                history.collection = history.collection.toLocaleString();
            } else {
                history.collection = "Uncollected";
            }

            // Convert the cleanerID to the cleaner's name
            if (history.collectorID != null) {
                const [cleanerName] = await database.query("SELECT name FROM cleaner WHERE ID = ?", [history.collectorID]);
                history.collectorID = `${cleanerName[0].name} (${history.collectorID})`;
            } else {
                history.collectorID = "Uncollected";
            }
        }

        // Format the data for the table (assuming your query returns an array of objects)
        const attributes = binHistory.map(history => [
            history.binID,
            history.accumulation,
            history.creation,
            history.collectorID,
            history.collection
        ]);

        // Document definition with a table
        const docDefinition = {
            content: [
                { text: 'Bin History Report', fontSize: 20, bold: true, margin: [0, 0, 0, 20] },
                {
                    table: {
                        headerRows: 1,
                        widths: ['*', '*', '*', '*', '*', '*'], // Set the column width auto fit maximum of page width
                        body: [
                            [
                                { text: 'Bin ID', fontSize: 10, fillColor: '#f2f2f2' },
                                { text: 'Accumulation', fontSize: 10, fillColor: '#f2f2f2' },
                                { text: 'Request Created At', fontSize: 10, fillColor: '#f2f2f2' },
                                { text: 'Collector', fontSize: 10, fillColor: '#f2f2f2' },
                                { text: 'Collection', fontSize: 10, fillColor: '#f2f2f2' }
                            ],  // Table headers
                            ...attributes.map(row => row.map(cell => ({ text: cell, fontSize: 10 }))) // Add the table data from the database
                        ]
                    },
                    layout: {
                        hLineWidth: function (i, node) { return 0.2; }, // Horizontal border width
                        vLineWidth: function (i, node) { return 0.2; }, // Vertical border width
                        hLineColor: function (i, node) { return '#000000'; }, // Horizontal border color
                        vLineColor: function (i, node) { return '#000000'; }  // Vertical border color
                    }
                }
            ]
        };

        const pdfDoc = printer.createPdfKitDocument(docDefinition);

        // Set response headers to force download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="custom-filename.pdf"');

        // Pipe the PDF directly to the response object
        pdfDoc.pipe(res);

        // End the document generation (this will send the file to the client)
        pdfDoc.end();

        console.log('PDF is being sent to the client for download');
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send('Error generating PDF');
    }
})

export default router;