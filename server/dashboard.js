import { createServer } from 'http';
import { Server } from 'socket.io';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { createTransport } from 'nodemailer';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2';
import speakeasy from 'speakeasy';
import { createClient } from 'redis';
import PdfPrinter from 'pdfmake';
import { fileURLToPath } from 'url';
import path from 'path';

const app = express(); // Create an express app
const server = createServer(app); // Create a server with the express app
const parser = new ReadlineParser(); // Create a parser to read the data from the serial port
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

// Function to send mail when bin is full
async function mail(email, bin) {
    try {
        const info = await transporter.sendMail({
            from: '"SmartBin Manager" <smartbinmanager@gmail.com>', // sender address
            to: email, // list of receivers
            subject: "Bin Ready for Collection", // Subject line
            text: `Dear administrator,\nThis is an automatic notification from the SmartBin System.\nA bin at Block ${bin[0].block}, Level ${bin[0].level} has reached its collection threshold and requires immediate attention.\nBin Details:\n- Location: Block ${bin[0].block}, Level ${bin[0].level}\n- Bin ID: ${bin[0].binid}\nAccumulation : ${bin[0].accumulation}%\nPlease arrange for collection as soon as possible to prevent overflow.\nThank you.`, // plain text body
            html: `
            <p>Dear administrator,</p>
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

async function portConnection() { // Function to connect to the serial port
    const ports = await SerialPort.list(); // List all available serial ports
    const arduino = await ports.filter(port => port.vendorId && port.productId); // Filter the list to find the Arduino board
    console.log(arduino);

    if (arduino.length == 0) {
        console.log("No Arduino found");
        setTimeout(portConnection, 5000); // Retry after 5 second
    } else {
        arduino.forEach(arduino => {
            console.log(`Connecting to Arduino at ${arduino.path}`);
            const port = new SerialPort({
                path: arduino.path,
                baudRate: 9600
            });

            port.pipe(parser);
        })

        parser.on("data", async (data) => {
            console.log(data); // Log the data received from the Arduino
            const parsedData = JSON.parse(data);

            if ("string" in parsedData) {
                console.log("Test: Invalid data."); // This is a test module
            } else if (!("cleanerID" in parsedData)) { // If the data does not contain cleanerID, it means it is a bin data
                if (parsedData.binstatus == "closed") {
                    const binID = Number(parsedData.binID);
                    const status = parsedData.binstatus;
                    const distance = Number(parsedData.distance);
                    const accumulation = 100 - ((distance / 23.5) * 100);
                    if (accumulation >= 80) { // If the bin is full, change the status to unavailable
                        try {
                            let update = await database.query("UPDATE bin SET status = 'unavailable', accumulation = ? WHERE ID = ?", [accumulation, binID]);
                            console.log(`Bin${binID} has been changed to unavailable`);
                        } catch (err) {
                            console.log(err);
                        }
                        try {
                            let insert = await database.query("INSERT INTO bin_history (binID, accumulation, creation, status) VALUES (?,?,?,?)", [binID, accumulation, new Date(), 'unavailable']);
                            console.log(insert);
                        } catch (error) {
                            console.log(error);
                        }

                        socket.emit("updateHistory") // Emit the updateHistory event to update the history table

                        const [bin] = await database.query("SELECT * FROM bin WHERE ID = ?", [binID]);
                        const [email] = await database.query("SELECT email FROM administrator");
                        let emailList = [];
                        email.forEach((email) => {
                            emailList.push(email.email);
                        });
                        mail(emailList, bin).catch(console.error); // Send email to the all administrator
                        socket.emit("updateChart", { binID: binID, distance: distance });
                    } else {
                        try {
                            let update = await database.query("UPDATE bin SET status = 'available', accumulation = ? WHERE ID = ?", [accumulation, binID]);
                            console.log(`Bin${binID} has been changed to available`);
                        } catch (err) {
                            console.log(err);
                        }
                        socket.emit("updateChart", { binID: binID, distance: distance });
                    }
                } else if (parsedData.binstatus == "opened") {
                    const binID = parsedData.binID;
                    const status = parsedData.binstatus;
                }
            } else if ("cleanerID" in parsedData) { // If the data contains cleanerID, it means it is a collection data
                const binID = parsedData.binid;
                const cleanerid = parsedData.cleanerID;

                // Update the bin status to available and reset the accumulation to 0
                try {
                    let update = await database.query("UPDATE bin SET status = 'available', accumulation = '0' WHERE ID = ?", [binID]);
                    socket.emit("updateChart", { binID: binID, distance: 23.5 });
                } catch (err) {
                    console.log(err);
                }
                // Insert the collection data into the bin_history table
                try {
                    let collect = await database.query("UPDATE bin_history SET collectorID = ?, collection=? WHERE ID = (SELECT ID FROM (SELECT max(ID) AS ID FROM bin_history) AS temp_table)", [cleanerid, new Date()]);
                    socket.emit("updateHistory");
                    socket.emit("updateGraph", { binID: binID });
                    console.log(collect);
                } catch (err) {
                    console.log(err);
                }
            }
        })
    }
}

app.use(cors()); // Use cors to allow cross-origin requests
app.use(express.json()); // Parse JSON request body
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request body, for POST CRUD operation



socket.on('connection', (socket) => {
    console.log("Connected to client");
});

portConnection(); // Connect to the serial port

redis.connect() // Connect to the Redis database
    .then(() => console.log('Connected to Redis'))
    .catch(err => console.log('Redis Connection Error:', err));

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

app.get('/validateCleanerEmail/:email', async (req, res) => {
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

app.get('/validateCleanerIC/:ic', async (req, res) => {
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

// Express for administrator.html
app.get('/loadAdministrator/:id', async (req, res) => {
    const adminEmail = req.params.id;
    try {
        const [administrators] = await database.query(`SELECT * FROM administrator WHERE NOT email = ?`, [adminEmail]);
        res.json(administrators);
    } catch (error) {
        console.log(error);
    }
})

app.post('/addAdministrator', async (req, res) => {
    const { name, gender, email, contact, password } = req.body;
    try {
        const [add] = await database.query("INSERT INTO administrator (name, gender, email, contact, password) VALUES(?,?,?,?,?)", [name, gender, email, contact, password]);
        if (add.warningStatus == 0) {
            res.json({ status: "success" });
        } else {
            res.json({ status: "failed" });
        }
    } catch (error) {
        console.log(error);
    }
})

app.post('/editAdministrator', async (req, res) => {
    const { administratorID, name, gender, email, contact } = req.body;
    console.log(name);
    console.log(gender);
    console.log(email);
    console.log(contact);
    try {
        const [edit] = await database.query("UPDATE administrator SET name = ?, gender = ?, email = ?, contact = ? WHERE ID = ?", [name, gender, email, contact, administratorID]);
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

app.get('/fetchAdministrator/:id', async (req, res) => {
    const administratorID = req.params.id;
    try {
        const [fetch] = await database.query("SELECT * FROM administrator WHERE ID = ?", [administratorID]);
        console.log(fetch);
        res.json(fetch);
    } catch (error) {
        console.log(error);
    }
})

app.get('/deleteAdministrator/:id', async (req, res) => {
    const administratorID = req.params.id;
    try {
        const [del] = await database.query("DELETE FROM administrator WHERE ID = ?", [administratorID]);
        if (del.warningStatus == 0) {
            res.json({ status: "success" });
        } else {
            res.json({ status: "failed" });
        }
    } catch (error) {
        console.log(error);
    }
})

app.get('/validateEmail/:email', async (req, res) => {
    const email = req.params.email;
    try {
        const [validate1] = await database.query("SELECT * FROM administrator WHERE email = ?", [email]);
        const [validate2] = await database.query("SELECT * FROM cleaner WHERE email = ?", [email]);
        if (validate1.length > 0 || validate2.length > 0) {
            res.json({ status: "existed" });
        } else {
            res.json({ status: "empty" });
        }
    } catch (error) {
        console.log(error);
    }
})

app.get('/validateContact/:contact', async (req, res) => {
    const contact = req.params.contact;
    try {
        const [validate] = await database.query("SELECT * FROM administrator WHERE contact = ?", [contact]);
        if (validate.length > 0) {
            res.json({ status: "existed" });
        } else {
            res.json({ status: "empty" });
        }
    } catch (error) {
        console.log(error);
    }
})

// Express for history.html
app.get('/loadBinHistory/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const [binHistory] = await database.query("SELECT * FROM bin_history WHERE binID = ?", [id]);
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
                console.log(cleanerName);
                history.collectorID = cleanerName[0].name;
            } else {
                history.collectorID = "Uncollected";
            }
        }
        console.log(binHistory);
        res.json(binHistory);
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

app.get('/validateProfileEmail/:email', async (req, res) => {
    const email = req.params.email;
    try {
        const [validate1] = await database.query("SELECT * FROM administrator WHERE email = ?", [email]);
        const [validate2] = await database.query("SELECT * FROM cleaner WHERE email = ?", [email]);
        if (validate1.length > 0 || validate2.length > 0) {
            res.json({ status: "existed" });
        } else {
            res.json({ status: "empty" });
        }
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

server.listen(3000, () => {
    console.log('Server is running on port 3000');
})