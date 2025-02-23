import {createServer} from 'http';
import {Server} from 'socket.io';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2';

const app = express();
const server = createServer(app);
const socket = new Server(server, {
    cors: {
        origin: "http://127.0.0.1:5500"
    }
});

app.use(cors());

const database = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Yongqin_1101',
    database: 'bin'
}).promise();

socket.on('connection', (socket) => {
    console.log("Connected to client");
});

app.get('/loadRegisteredBin', async (req, res) => {
    try {
        const [rows] = await database.query("SELECT * FROM bin");
        res.json(rows);
    } catch (error) {
        console.log(error);
    }
})

server.listen(3000, ()=>{
    console.log('Server is running on port 3000');
})