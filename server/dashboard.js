import { createServer } from 'http';
import { Server } from 'socket.io';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { createTransport } from 'nodemailer';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2';

const app = express(); // Create an express app
const server = createServer(app); // Create a server with the express app
const parser = new ReadlineParser(); // Create a parser to read the data from the serial port
const socket = new Server(server, { // Create a socket connection
    cors: {
        origin: "http://127.0.0.1:5500"
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

async function main(email, bin) {
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

async function portConnection() { // Function to connect to the serial port
    SerialPort.list().then(function (ports) {
        const COM5 = ports.find(port => port.path === 'COM5');

        if (COM5) { // If COM5 is found, connect to the port
            console.log("COM5 found");
            const port = new SerialPort({
                path: 'COM5',
                baudRate: 9600
            });

            port.pipe(parser);

            parser.on("data", async (data) => {
                console.log(data);
                const parsedData = JSON.parse(data);

                if (!("cleanerID" in parsedData)) {
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
                            const [bin] = await database.query("SELECT * FROM bin WHERE ID = ?", [binID]);
                            const [email] = await database.query("SELECT email FROM administrator");
                            let emailList = [];
                            email.forEach((email) => {
                                emailList.push(email.email);
                            });
                            main(emailList,bin).catch(console.error);
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
                }
            })
        } else { // If COM5 is not found
            console.log('COM5 not found');
            setTimeout(portConnection, 5000); // Retry after 5 second
        }
    });
}

app.use(cors()); // Use cors to allow cross-origin requests
app.use(express.json()); // Parse JSON request body
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request body

socket.on('connection', (socket) => {
    console.log("Connected to client");
});

portConnection(); // Connect to the serial port

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

server.listen(3000, () => {
    console.log('Server is running on port 3000');
})