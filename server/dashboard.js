import { createServer } from 'http';
import { Server } from 'socket.io';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
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

function portConnection() { // Function to connect to the serial port
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
            })
        } else { // If COM5 is not found
            console.log('COM5 not found');
            setTimeout(portConnection, 5000); // Retry after 5 second
        }
    });
}

app.use(cors()); // Use cors to allow cross-origin requests

socket.on('connection', (socket) => {
    console.log("Connected to client");
});

portConnection(); // Connect to the serial port

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

app.get('/fetchBin/:id', async (req, res)=>{
    const binid = req.params.id;
    try{
        const [bin] = await database.query("SELECT * FROM bin WHERE ID = ?", [binid]);
        console.log(bin);
        res.json(bin);
    } catch(error){
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