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

async function mail(email, bin) {
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
}

async function send(email, name, otp) {
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
            console.log(data);
            const parsedData = JSON.parse(data);

            if ("string" in parsedData) {
                console.log("Test: Invalid data.");
            } else if (!("cleanerID" in parsedData)) {
                if (parsedData.status == "closed") {
                    const binID = Number(parsedData.binID);
                    const status = parsedData.status;
                    const distance = Number(parsedData.distance);
                    const accumulation = 100 - ((distance / 13) * 100);
                    if (accumulation >= 80) {
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

                        socket.emit("updateHistory")

                        const [bin] = await database.query("SELECT * FROM bin WHERE ID = ?", [binID]);
                        const [email] = await database.query("SELECT email FROM administrator");
                        let emailList = [];
                        email.forEach((email) => {
                            emailList.push(email.email);
                        });
                        mail(emailList, bin).catch(console.error);
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
                } else if (parsedData.status == "opened") {
                    const binID = parsedData.binID;
                    const status = parsedData.status;
                }
            } else if ("cleanerID" in parsedData) {
                const binID = parsedData.binid;
                const cleanerid = parsedData.cleanerID;
                try {
                    let update = await database.query("UPDATE bin SET status = 'available', accumulation = '0' WHERE ID = ?", [binID]);
                } catch (err) {
                    console.log(err);
                }
                try {
                    let collect = await database.query("UPDATE bin_history SET collectorID = ?, collection=? WHERE ID = (SELECT ID FROM (SELECT max(ID) AS ID FROM bin_history) AS temp_table)", [cleanerid, new Date()]);
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
app.post('/signin', async (req, res) => {
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
app.post('/forgotpassword', async (req, res) => {
    const { email } = req.body;
    try {
        const [account] = await database.query("SELECT * FROM administrator WHERE email = ?", [email]);
        console.log(account);
        if (account.length > 0) {
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
        } else {
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

app.get('/initializeChart', async (req, res) => {
    try {
        const [record] = await database.query("SELECT * FROM bin");
        res.json(record);
    } catch (error) {
        console.log(error);
    }
})

app.get('/fetchBin/:id', async (req, res) => {
    const binid = req.params.id;
    try {
        const [bin] = await database.query("SELECT * FROM bin WHERE ID = ?", [binid]);
        console.log(bin);
        res.json(bin);
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

// Express for history.html
app.get('/loadBinHistory/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const [binHistory] = await database.query("SELECT * FROM bin_history WHERE binID = ?", [id]);
        binHistory.forEach(history => {
            if (history.creation != null) {
                history.creation = history.creation.toLocaleString();
            }
            if (history.collection != null) {
                history.collection = history.collection.toLocaleString();
            }
        })
        console.log(binHistory);
        res.json(binHistory);
    } catch (error) {
        console.log(error);
    }
})

server.listen(3000, () => {
    console.log('Server is running on port 3000');
})