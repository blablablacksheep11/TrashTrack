import { createServer } from 'http';
import { Server } from 'socket.io';
import { createTransport } from 'nodemailer';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2';
import speakeasy from 'speakeasy';
import { createClient } from 'redis';
import PdfPrinter from 'pdfmake';
import { fileURLToPath } from 'url';
import path from 'path';
import { GoogleGenAI } from "@google/genai";
import axios from 'axios'; // Used to make HTTP requests to esp32
import shared from './shared.js'; // Fetch the global shared variables

const app = express(); // Create an express app
const server = createServer(app); // Create a server with the express app
const socket = new Server(server, { // Create a socket connection
    cors: {
        origin: "http://127.0.0.1:5500"
    }
});

const redis = createClient({ // Create redis client
    socket: {
        host: 'localhost',
        port: 6379, // Default Redis port
    }
});

redis.connect() // Connect to the Redis database
    .then(() => console.log('Connected to Redis'))
    .catch(err => console.log('Redis Connection Error:', err));

const database = mysql.createPool({ // Create a connection to the database
    host: '127.0.0.1',
    user: 'root',
    password: 'Yongqin_1101',
    database: 'bin'
}).promise();

const transporter = createTransport({
    service: "gmail", // Use Gmail's SMTP service
    auth: {
        user: "lamyongqin@gmail.com",
        pass: "xvtgwerkxhoavubq"
    }
});

app.use(cors()); // Use cors to allow cross-origin requests
app.use(express.json()); // Parse JSON request body
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request body, for POST CRUD operation

socket.on('connection', (socket) => { // Crete connection with client side
    console.log("Connected to client");
});

// Function to send mail when bin is full
async function mail(email, bin) {
    try {
        const info = await transporter.sendMail({
            from: '"SmartBin Manager" <smartbinmanager@gmail.com>', // sender address
            to: email, // list of receivers
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
                    <b>Accumulation:</b>${bin[0].accumulation}%
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

// Function to send mail for password reset
async function send(email, name, otp) {
    try {
        const info = await transporter.sendMail({
            from: '"SmartBin Manager" <smartbinmanager@gmail.com>', // sender address
            to: email, // list of receivers
            subject: "OTP for password reset", // Subject line
            text: `Dear ${name},\nYou have requested to reset your password. Please use the following One-Time Password (OTP) to proceed:\nOTP Code: ${otp}\n This OTP is valid for 2 minutes. Do not share this code with anyone for security reasons.`, // plain text body
            html: `
            <p>Dear ${name},</p>
            <br>
            <p>You have requested to reset your password. Please use the following <b>One-Time Password (OTP)</b> to proceed:</p>
            <br>
            <b>OTP Code: </b>${otp}
            <br>
            <b>This OTP is valid for 2 minutes.</b>Do not share this code with anyone for security reasons.
            `, // HTML body
        });

        console.log("Message sent");
    } catch (error) {
        console.log(error);
    }
}

async function sendSegregationData(data) {
    axios.post('http://192.168.0.103/segregationData', {
        category: data
    })
        .then(response => {
            console.log('ESP32 responded:', response.data);
        })
        .catch(error => {
            console.error('Error posting to ESP32:', error.message);
        });

}

// When server get data from ESP32 through HTTP POST request
app.post('/esp32data', async (req, res) => {
    res.status(200).send("OK"); // Critical! Without this, ESP32 will timeout
    console.log(req.body); // Log the data received from ESP32

    if ("cleanerID" in req.body) { // If the data contains cleanerID, it means it is a collection data
        const binID = req.body.binid;
        const cleanerid = req.body.cleanerID;

        // Update the bin status to available and reset the accumulation to 0
        try {
            let update = await database.query("UPDATE bin SET status = 'available', cat1_accumulation = '0', cat2_accumulation = '0', cat3_accumulation = '0' WHERE ID = ?", [binID]);
            socket.emit("updateChart", { binID: binID, distance: 23.5 });

            // Insert the collection data into the bin_history table
            let collect = await database.query("UPDATE bin_history SET collectorID = ?, collection=? WHERE ID = (SELECT ID FROM (SELECT max(ID) AS ID FROM bin_history) AS temp_table)", [cleanerid, new Date()]);
            socket.emit("updateGraph", { binID: binID });
            console.log(collect);
        } catch (err) {
            console.log(err);
        }

    } else if ("binstatus" in req.body && req.body.binstatus == "closed") { // If the data does not contain cleanerID, it means it is a bin data
        const binID = Number(req.body.binID);
        const acceptingIMG = Boolean(req.body.acceptingIMG);
        shared.acceptingIMG = acceptingIMG; // Update the global shared variable

    } else if ("distance" in req.body) {
        const binID = Number(req.body.binID);
        const category = Number(req.body.category);
        const distance = Number(req.body.distance);
        const accumulation = 100 - ((distance / 23.5) * 100);
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
                const [accumulations] = await database.query("SELECT cat1_accumulation, cat2_accumulation, cat2_accumulation FROM bin WHERE ID = ?", [binID]);

                accumulations[0][colToReplace] = accumulation; // Replace the accumulation of the category with the new value

                let insert = await database.query("INSERT INTO bin_history (binID, cat1_accumulation, cat2_accumulation, cat3_accumulation, creation, status) VALUES (?,?,?,?)", [binID, accumulations[0]['cat1_accumulation'], accumulations[0]['cat2_accumulation'], accumulations[0]['cat3_accumulation'], new Date(), 'unavailable']);

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
                socket.emit("updateChart", { binID: binID, distance: distance, category: category });

            } catch (err) {
                console.log(err);
            }
        } else {
            try {
                let update = await database.query(`UPDATE bin SET status = 'available', cat${category}_accumulation = ? WHERE ID = ?`, [accumulation, binID]);
                console.log(`Bin${binID} has been changed to available`);
            } catch (err) {
                console.log(err);
            }
            socket.emit("updateChart", { binID: binID, distance: distance });
        }
    }
});

// Express for img recognition / garbage segregation
app.post('/img', async (req, res) => {
    try {
        // Get the img data from request body
        const { label, confidence, image } = req.body;  // This is the img data from Python
        if (image) {
            res.status(200).json({ message: 'Image received successfully' });
        }

        // Create Gemeni object
        const ai = new GoogleGenAI({ apiKey: "AIzaSyDXM2GrjA3ualF8L9CdLdD_zTG-F51eNfI" });

        const contents = [
            {
                inlineData: {
                    mimeType: "image/jpeg",
                    data: image,
                },
            },
            { text: "Is this a paper, plastic, or general waste. Return me the response in single vocabulary. Return general waste if multiple material detected." },
        ];

        if (shared.acceptingIMG == true) {
            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: contents,
            });

            if (response.error) {
                return; // Stop the execetion if gemeni return error
            }

            if (response.text.toLowerCase().includes("paper")) {
                const [insert] = await database.query("INSERT INTO disposal_records (garbage_type) VALUES (?)", ["1"]);
                if (insert.warningStatus == 0) {
                    console.log("Paper waste detected and recorded");
                }
                sendSegregationData("paper"); // Send the segregation data to ESP32
            } else if (response.text.toLowerCase().includes("plastic")) {
                const [insert] = await database.query("INSERT INTO disposal_records (garbage_type) VALUES (?)", ["2"]);
                if (insert.warningStatus == 0) {
                    console.log("Plastic waste detected and recorded");
                }
                sendSegregationData("plastic"); // Send the segregation data to ESP32
            } else {
                const [insert] = await database.query("INSERT INTO disposal_records (garbage_type) VALUES (?)", ["4"]);
                if (insert.warningStatus == 0) {
                    console.log("General waste detected and recorded");
                }
                sendSegregationData("general"); // Send the segregation data to ESP32
            }
        }
    } catch (error) {
        console.error("Error processing image:", error);
        res.status(500).json({ error: "Failed to process image" });
    }
});

// Serve the navigation bar
app.get('/loadNavbar', (req, res) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    res.sendFile(path.join(__dirname, '../client/navbar.html'));
})

// Serve the footer
app.get('/loadFooter', (req, res) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    res.sendFile(path.join(__dirname, '../client/footer.html'));
})


// Express for signin.html
app.post('/signin', async (req, res) => { // When user request for signin
    const { email, password } = req.body;
    try {
        const [admin] = await database.query("SELECT * FROM administrator WHERE email = ?", [email]);
        console.log(admin);
        if (admin.length > 0) {
            if (admin[0].password == password) {
                console.log("pass correct");
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

// Express for forgotpass.html
app.post('/forgotpassword', async (req, res) => { // When user request for password reset
    const { email } = req.body;
    try {
        const [account] = await database.query("SELECT * FROM administrator WHERE email = ?", [email]);
        console.log(account);
        if (account.length > 0) { // If the email exists in the database
            var secret = speakeasy.generateSecret({ length: 20 });  // Generate a secret code

            const otp = speakeasy.totp({ // Convert the secret code to a one-time password
                secret: secret.base32,
                encoding: "base32",
            });

            const pin = `pin:${email}`;
            const otpPin = secret.base32.toString();

            async function store(pin, secret) {
                try {
                    const pinExists = await redis.exists(pin); // Check if OTP exists

                    if (pinExists == 0) {
                        await redis.setEx(pin, 120, secret);
                    } else if (pinExists == 1) {
                        await redis.del(pin); // Ensure deletion completes before setting new value
                        await redis.setEx(pin, 120, secret);
                    }

                    console.log("Redis storage updated successfully.");
                } catch (error) {
                    console.error("Redis error:", error);
                }
            }

            store(pin, otpPin);
            send(account[0].email, account[0].name, otp).catch(console.error);
            res.json({ status: "success", admin: account[0], otp: otp });
        } else { // If the email does not exist in the database
            res.json({ status: "empty" });
        }
    } catch (error) {
        console.log(error);
    }
})

// Express for verification.html
app.post('/verification', async (req, res) => {
    const { otp, email } = req.body;
    const pin = `pin:${email}`;

    async function fetch(pin, secret) {
        try {
            const pinExists = await redis.exists(pin); // Check if OTP exists

            if (pinExists == 0) {
                res.json({ status: "expired" });
            } else if (pinExists == 1) {
                const originalpin = await redis.get(pin);

                const verification = speakeasy.totp.verify({ // Verify the one-time password
                    secret: originalpin, // The correct otp (raw)
                    encoding: "base32",
                    token: secret, // The user input
                    window: 4
                });

                if (verification) {
                    res.json({ status: "success" });
                } else {
                    res.json({ status: "invalid" });
                }
                console.log(verification);
            }
        } catch (error) {
            console.error("Redis error:", error);
            res.json({ status: "failed" });
        }
    }

    fetch(pin, otp);
})

app.post('/resend', async (req, res) => {
    const { email } = req.body;
    const [account] = await database.query("SELECT * FROM administrator WHERE email = ?", [email]);

    try {
        var secret = speakeasy.generateSecret({ length: 20 });  // Generate a secret code

        const otp = speakeasy.totp({ // Convert the secret code to a one-time password
            secret: secret.base32,
            encoding: "base32",
        });

        const pin = `pin:${email}`;
        const otpPin = secret.base32.toString();

        async function store(pin, secret) {
            try {
                const pinExists = await redis.exists(pin); // Check if OTP exists

                if (pinExists == 0) {
                    await redis.setEx(pin, 120, secret);
                } else if (pinExists == 1) {
                    await redis.del(pin); // Ensure deletion completes before setting new value
                    await redis.setEx(pin, 120, secret);
                }

                console.log("Redis storage updated successfully.");
            } catch (error) {
                console.error("Redis error:", error);
            }
        }

        store(pin, otpPin);
        send(account[0].email, account[0].name, otp).catch(console.error);
        res.json({ status: "success", admin: account[0], otp: otp });
    } catch (error) {
        console.log(error);
        res.json({ status: "failed" });
    }
})

// Express for resetpass.html
app.post('/resetpassword', async (req, res) => {
    const { email, password, confirmpassword } = req.body;
    const pin = `pin:${email}`;

    try {
        const [reset] = await database.query("UPDATE administrator SET password = ? WHERE email = ?", [password, email]);
        if (reset.warningStatus == 0) {
            res.json({ status: "success" });
        } else {
            res.json({ status: "failed" });
        }
    } catch (error) {
        console.error("Database error:", error);
    }
})

// Express for dashboard.html
app.get('/loadBinsCount', async (req, res) => {
    try {
        const [bins] = await database.query("SELECT * FROM bin");
        res.json(bins);
    } catch (error) {
        console.log(error);
    }
})

app.get('/loadCleanerCount', async (req, res) => {
    try {
        const [cleaners] = await database.query("SELECT * FROM cleaner");
        res.json(cleaners);
    } catch (error) {
        console.log(error);
    }
})

app.get('/loadFreeBinTable', async (req, res) => {
    try {
        const [freebins] = await database.query("SELECT * FROM bin WHERE status = 'available'");
        res.json(freebins);
    } catch (error) {
        console.log(error);
    }
})

app.get('/loadFulledBinTable', async (req, res) => {
    try {
        const [fulledbins] = await database.query("SELECT * FROM bin WHERE status = 'unavailable'");
        res.json(fulledbins);
    } catch (error) {
        console.log(error);
    }
})

app.get('/initializeChart&Graph', async (req, res) => {
    try {
        const [record] = await database.query("SELECT * FROM bin");
        res.json(record);
    } catch (error) {
        console.log(error);
    }
})

app.get('/fetchChart/:id', async (req, res) => {
    const binid = req.params.id;
    try {
        const [bin] = await database.query("SELECT * FROM bin WHERE ID = ?", [binid]);
        console.log(bin);
        res.json(bin);
    } catch (error) {
        console.log(error);
    }
})

app.get('/fetchGraph/:id', async (req, res) => {
    const binid = req.params.id;
    try {
        const [date] = await database.query("SELECT DISTINCT DATE(collection) AS date FROM bin_history WHERE binID = ?  ORDER BY date;", [binid]);
        res.json(date);
    } catch (error) {
        console.log(error);
    }
})

app.get('/getHistory/:id/:date', async (req, res) => {
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

// Express for bin.html
app.get('/loadRegisteredBin', async (req, res) => {
    try {
        const [bins] = await database.query("SELECT * FROM bin");
        res.json(bins);
    } catch (error) {
        console.log(error);
    }
})

// Express for cleaner.html
app.get('/loadCleaner', async (req, res) => {
    try {
        const [cleaners] = await database.query("SELECT * FROM cleaner");
        res.json(cleaners);
    } catch (error) {
        console.log(error);
    }
})

app.post('/addCleaner', async (req, res) => {
    const { name, gender, ic, email } = req.body;
    try {
        const [add] = await database.query("INSERT INTO cleaner (name, gender, IC, email) VALUES(?,?,?,?)", [name, gender, ic, email]);
        if (add.warningStatus == 0) {
            res.json({ status: "success" });
        } else {
            res.json({ status: "failed" });
        }
    } catch (error) {
        console.log(error);
    }
})

app.post('/editCleaner', async (req, res) => {
    const { cleanerID, name, gender, ic, email } = req.body;
    console.log(name);
    console.log(gender);
    console.log(ic);
    console.log(email);
    try {
        const [edit] = await database.query("UPDATE cleaner SET name = ?, gender = ?, IC = ?, email = ? WHERE ID = ?", [name, gender, ic, email, cleanerID]);
        console.log(edit);
        if (edit.warningStatus == 0) {
            res.json({ status: "success" });
        } else {
            res.json({ status: "failed" });
        }
    } catch (error) {
        console.log(error);
    }
})

app.get('/fetchCleaner/:id', async (req, res) => {
    const cleanerID = req.params.id;
    try {
        const [fetch] = await database.query("SELECT * FROM cleaner WHERE ID = ?", [cleanerID]);
        console.log(fetch);
        res.json(fetch);
    } catch (error) {
        console.log(error);
    }
})

app.get('/deleteCleaner/:id', async (req, res) => {
    const cleanerID = req.params.id;
    try {
        const [del] = await database.query("DELETE FROM cleaner WHERE ID = ?", [cleanerID]);
        if (del.warningStatus == 0) {
            res.json({ status: "success" });
        } else {
            res.json({ status: "failed" });
        }
    } catch (error) {
        console.log(error);
    }
})

app.get('/validateCleanerEmail/:email', async (req, res) => { // This is used when adding new cleaner
    const email = req.params.email;
    try {
        const [validate1] = await database.query("SELECT * FROM cleaner WHERE email = ?", [email]);
        const [validate2] = await database.query("SELECT * FROM administrator WHERE email = ?", [email]);
        if (validate1.length > 0 || validate2.length > 0) {
            res.json({ status: "existed" });
        } else {
            res.json({ status: "empty" });
        }
    } catch (error) {
        console.log(error);
    }
})

app.get('/validateCleanerIC/:ic', async (req, res) => { // This is used when adding new cleaner
    const ic = req.params.ic;
    try {
        const [validate] = await database.query("SELECT * FROM cleaner WHERE IC = ?", [ic]);
        if (validate.length > 0) {
            res.json({ status: "existed" });
        } else {
            res.json({ status: "empty" });
        }
    } catch (error) {
        console.log(error);
    }
})

app.get('/checkCleanerEmail/:id/:email', async (req, res) => { // This is used when editing existing cleaner
    const cleanerID = req.params.id;
    const email = req.params.email;

    try {
        const [validation1] = await database.query("SELECT * FROM cleaner WHERE email = ?", [email]);
        if (validation1.length > 0) {
            return res.json({ status: validation1[0].ID == cleanerID ? "empty" : "existed" });
        }

        const [validation2] = await database.query("SELECT * FROM administrator WHERE email = ?", [email]);
        if (validation2.length > 0) {
            return res.json({ status: "existed" });
        }

        res.json({ status: "empty" }); // Email is not found in both tables
    } catch (error) {
        console.log(error);
    }
})

app.get('/checkCleanerIC/:id/:IC', async (req, res) => { // This is used when editing existing cleaner
    const cleanerID = req.params.id;
    const IC = req.params.IC;

    try {
        const [check] = await database.query("SELECT * FROM cleaner WHERE IC = ?", [IC]);
        if (check.length > 0) {
            if (check[0].ID == cleanerID) {
                res.json({ status: "empty" });
            } else {
                res.json({ status: "existed" });
            }
        } else {
            res.json({ status: "empty" });
        }
    } catch (error) {
        console.log(error);
    }
})

// Express for history.html
app.get('/loadBinHistory/:id/:pageNumber', async (req, res) => {
    const id = req.params.id;
    const pageNumber = req.params.pageNumber;
    const limit = 15; // Only fetch 15 records per page
    const offset = (pageNumber - 1) * limit; // Skip the records in the previous page

    try {
        const [recordCount] = await database.query("SELECT COUNT(*) as total FROM bin_history WHERE binID = ?", [id]); // Get the total number of records
        const totalRecord = recordCount[0].total;
        const pageCount = Math.ceil((recordCount[0].total) / 15);
        const [binHistory] = await database.query("SELECT * FROM bin_history WHERE binID = ? LIMIT ? OFFSET ?", [id, limit, offset]); // Fetch the records for the current page
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

app.get('/deleteHistory/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const [del] = await database.query("DELETE FROM bin_history WHERE ID = ?", [id]);
        if (del.warningStatus == 0) {
            res.json({ status: "success" });
        } else if (del.warningStatus != 0) {
            res.json({ status: "failed" });
        }
    } catch (error) {
        console.log(error);
    }
})

app.get('/fetchHistory/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const [fetch] = await database.query("SELECT * FROM bin_history WHERE ID = ?", [id]);
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

app.get('/getCleanerList', async (req, res) => {
    try {
        const [cleanerList] = await database.query("SELECT * FROM cleaner");
        res.json(cleanerList);
    } catch (error) {
        console.log(error);
    }
})

app.post('/editHistory', async (req, res) => {
    // Unlike fetch history, the colleection datetime is already preprocessed on the client side (history.html)
    const { historyID, collector, collection } = req.body;
    console.log(req.body);
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

app.get('/exportHistory/:id', async (req, res) => {
    const binID = req.params.id;
    const fonts = {
        Roboto: {
            normal: '../fonts/Roboto-Regular.ttf',
            bold: '../fonts/Roboto-Medium.ttf',
            italics: '../fonts/Roboto-Italic.ttf',
            bolditalics: '../fonts/Roboto-MediumItalic.ttf',
        },
    };

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const printer = new PdfPrinter(fonts);

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

    console.log(binHistory);
    console.log(attributes);

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

    try {
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

// Express for profile.html
app.get('/loadInfo/:email', async (req, res) => {
    const email = req.params.email;
    try {
        const [admin] = await database.query("SELECT * FROM administrator WHERE email = ?", [email]);
        console.log(admin);
        res.json(admin);
    } catch (error) {
        console.error(error);
    }
})

app.get('/validateProfileEmail/:id/:email', async (req, res) => {
    const adminID = req.params.id;
    const email = req.params.email;
    try {
        const [validation1] = await database.query("SELECT * FROM administrator WHERE email = ?", [email]);
        if (validation1.length > 0) {
            return res.json({ status: validation1[0].ID == adminID ? "empty" : "existed" });
        }

        const [validation2] = await database.query("SELECT * FROM cleaner WHERE email = ?", [email]);
        if (validation2.length > 0) {
            return res.json({ status: "existed" });
        }

        res.json({ status: "empty" }); // Email is not found in both tables
    } catch (error) {
        console.log(error);
    }
})

app.post('/updateProfile', async (req, res) => {
    const { adminemail, name, email, gender, phone } = req.body;
    try {
        const [edit] = await database.query("UPDATE administrator SET name = ?, email = ?, gender = ?, contact = ? WHERE email = ?", [name, email, gender, phone, adminemail]);
        console.log(edit);
        if (edit.warningStatus == 0) {
            res.json({ status: "success" });
        } else {
            res.json({ status: "failed" });
        }
    } catch (error) {
        console.log(error);
    }
})

app.post('/validatePassword', async (req, res) => {
    const { adminemail, oldpassword } = req.body;
    try {
        const [validate] = await database.query("SELECT * FROM administrator WHERE email = ? AND password = ?", [adminemail, oldpassword]);
        console.log(validate);
        if (validate.length > 0) {
            res.json({ status: "success" });
        } else {
            res.json({ status: "failed" });
        }
    } catch (error) {
        console.log(error);
    }
})

app.post('/changePassword', async (req, res) => {
    const { adminemail, newpassword } = req.body;
    try {
        const [update] = await database.query("UPDATE administrator SET password = ? WHERE email = ?", [newpassword, adminemail]);
        console.log(update);
        if (update.warningStatus == 0) {
            res.json({ status: "success" });
        } else {
            res.json({ status: "failed" });
        }
    } catch (error) {
        console.log(error);
    }
})

// Express for analytics.html
app.get('/getGarbageType/:category_id', async (req, res) => {
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

app.get('/getGarbageOverview', async (req, res) => {
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

server.listen(3000, () => {
    console.log('Server is running on port 3000');
})