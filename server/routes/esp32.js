import express from 'express';
import shared from '../shared.js'; // Fetch the global shared variables
import database from '../services/mysql.js';
import { socket } from '../services/socket.js'; // Import the socket variables
import transporter from '../services/mailer.js';

const router = express.Router();

async function mail(recipientEmail, bin) {
    try {
        const info = await transporter.sendMail({
            from: '"SmartBin Manager" <smartbinmanager@gmail.com>', // sender address
            to: recipientEmail, // list of receivers
            subject: "Bin Ready for Collection", // Subject line
            text: `Dear administrator,\nThis is an automatic notification from the SmartBin System.\nA bin at Block ${bin[0].block}, Level ${bin[0].level} has reached its collection threshold and requires immediate attention.\nBin Details:\n- Location: Block ${bin[0].block}, Level ${bin[0].level}\n- Bin ID: ${bin[0].binid}\nAccumulation : ${bin[0].accumulation}%\nPlease arrange for collection as soon as possible to prevent overflow.\nThank you.`, // plain text body
            html: `
            <p>Dear administrator & cleaner,</p>
            <br>
            <p>This is an automatic notification from the SmartBin System.</p>
            <br>
            <p>A bin at Block ${bin[0].block}, Level ${bin[0].level} has reached its collection threshold and requires immediate attention.</p>
            <br>
            <h3>Bin Details:</h3>
            <br>
            <ul>
                <li>
                    <b>Location:</b> Block ${bin[0].block}, Level ${bin[0].level}
                </li>
                <li>
                    <b>Bin ID:</b>${bin[0].ID}
                </li>
                <li>
                    <b>Paper Accumulation:</b>${bin[0].cat1_accumulation}%
                    <b>Plastic Accumulation:</b>${bin[0].cat2_accumulation}%
                    <b>General Waste Accumulation:</b>${bin[0].cat3_accumulation}%
                </li>
            </ul>
            <p>Please arrange for collection as soon as possible to prevent overflow.</p>
            <br>
            <p>Thank you.</p>
            `, // HTML body
        });

        console.log("Message sent");
    } catch (error) {
        console.log(error);
    }
}

router.post('/esp32Data', async (req, res) => {
    console.log("Received data from ESP32:", req.body);
    if ("cleanerID" in req.body) { // If the data contains cleanerID, it means it is a collection data
        const binID = req.body.binid;
        const cleanerID = req.body.cleanerID;

        // Update the bin status to available and reset the accumulation to 0
        try {
            let update = await database.query("UPDATE bin SET status = 'available', cat1_accumulation = '0', cat2_accumulation = '0', cat3_accumulation = '0' WHERE ID = ?", [binID]);
            socket.emit("updateAccumulationPieChart", { binID: binID });

            // Insert the collection data into the bin_history table
            let collect = await database.query("UPDATE bin_history SET collectorID = ?, collection=? WHERE ID = (SELECT ID FROM (SELECT max(ID) AS ID FROM bin_history) AS temp_table)", [cleanerID, new Date().toLocaleString()]);
            socket.emit("updateCollectionFreqGraph", { binID: binID });
        } catch (err) {
            console.log(err);
        }

    } else if ("binstatus" in req.body && req.body.binstatus == "closed") { // If the data does not contain cleanerID, it means it is a bin data
        const acceptingIMG = Boolean(req.body.acceptingIMG);
        shared.acceptingIMG = acceptingIMG; // Update the global shared variable

    } else if ("remainingDistance" in req.body) {
        const binID = Number(req.body.binID);
        const category = Number(req.body.category);
        const remainingDistance = Number(req.body.remainingDistance);
        const accumulation = 100 - ((remainingDistance / 11.5) * 100);
        const categoryMap = {
            1: 'cat1_accumulation',
            2: 'cat2_accumulation',
            3: 'cat3_accumulation'
        };

        const colToReplace = categoryMap[category];

        if (accumulation >= 80) { // If the bin is full, change the status to unavailable
            try {
                let update = await database.query(`UPDATE bin SET status = 'unavailable', cat${category}_accumulation = ? WHERE ID = ?`, [accumulation, binID]);
                console.log(`Bin${binID} has been changed to unavailable`);

                // Get the accumulation of the other 2 categories
                const [accumulations] = await database.query("SELECT cat1_accumulation, cat2_accumulation, cat3_accumulation FROM bin WHERE ID = ?", [binID]);

                accumulations[0][colToReplace] = accumulation; // Replace the accumulation of the category with the new value

                let insert = await database.query("INSERT INTO bin_history (binID, cat1_accumulation, cat2_accumulation, cat3_accumulation, creation, status) VALUES (?,?,?,?,?,?)", [binID, accumulations[0]['cat1_accumulation'], accumulations[0]['cat2_accumulation'], accumulations[0]['cat3_accumulation'], new Date().toLocaleString(), 'unavailable']);

                const [bin] = await database.query("SELECT * FROM bin WHERE ID = ?", [binID]);
                let emailList = [];

                const [adminEmail] = await database.query("SELECT email FROM administrator");
                adminEmail.forEach((email) => {
                    emailList.push(email.email);
                });

                const [cleanerEmail] = await database.query("SELECT email FROM cleaner");
                cleanerEmail.forEach((email) => {
                    emailList.push(email.email);
                });

                mail(emailList, bin).catch(console.error); // Send email to the all administrator
                socket.emit("updateAccumulationPieChart", { binID: binID });

            } catch (err) {
                console.log(err);
            }
        } else {
            try {
                let update = await database.query(`UPDATE bin SET status = 'available', cat${category}_accumulation = ? WHERE ID = ?`, [accumulation, binID]);
                console.log(`Bin${binID} has been changed to available`);

                socket.emit("updateAccumulationPieChart", { binID: binID });
            } catch (err) {
                console.log(err);
            }
        }
    }

    res.status(200).send("OK"); // Critical! Without this, ESP32 will timeout
});

export default router;