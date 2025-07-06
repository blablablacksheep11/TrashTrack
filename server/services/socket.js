import { Server } from 'socket.io';

let socket = null; // Declare socket variable

function socketSetup(server) {
    socket = new Server(server, { // Create a socket connection
        cors: {
            origin: "http://127.0.0.1:5500"
        }
    });

    socket.on('connection', (socket) => { // Crete connection with client side
        console.log("Connected to client");
    });
};

export {socket, socketSetup}; // Export the socket variable and socketSetup function