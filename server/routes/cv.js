import express from 'express';
import axios from 'axios'; // Used to make HTTP requests to esp32
import shared from '../shared.js'; // Fetch the global shared variables
import database from '../services/mysql.js';
import { socket } from '../services/socket.js'; // Import the socket variable
import classifyWaste from '../services/gemini.js'; // Import the classifyWaste function


const router = express.Router();

async function sendSegregationData(data) {
    axios.post('http://ESP32_IP_ADDRESS/segregationData', {
        category: data
    })
        .then(response => {
            console.log('ESP32 responded:', response.data);
        })
        .catch(error => {
            console.error('Error posting to ESP32:', error.message);
        });

}

router.post('/img', async (req, res) => {
    try {
        // Get the img data from request body
        const { label, confidence, image } = req.body;  // This is the img data from Python
        if (image) {
            res.status(200).json({ message: 'Image received successfully' });
        }

        if (shared.acceptingIMG == true) {
            let categoryID = 0; // Initialize categoryID
            const segregation = await classifyWaste(image); // Call the classifyWaste function with the image data

            if (segregation.includes("paper")) {
                const [insert] = await database.query("INSERT INTO disposal_records (garbage_type) VALUES (?)", ["1"]);
                if (insert.warningStatus == 0) {
                    console.log("Paper waste detected and recorded");
                }
                sendSegregationData("paper"); // Send the segregation data to ESP32
                categoryID = 1; // Paper category ID
            } else if (segregation.includes("plastic")) {
                const [insert] = await database.query("INSERT INTO disposal_records (garbage_type) VALUES (?)", ["2"]);
                if (insert.warningStatus == 0) {
                    console.log("Plastic waste detected and recorded");
                }
                sendSegregationData("plastic"); // Send the segregation data to ESP32
                categoryID = 2; // Plastic category ID
            } else {
                const [insert] = await database.query("INSERT INTO disposal_records (garbage_type) VALUES (?)", ["4"]);
                if (insert.warningStatus == 0) {
                    console.log("General waste detected and recorded");
                }
                sendSegregationData("general"); // Send the segregation data to ESP32
                categoryID = 4; // General waste category ID
            }

            socket.emit("updateOverviewColumnChart"); // Update the overview column chart in dashboard.html
            socket.emit("updateAnalytics", { categoryID: categoryID }); // Emit the event to update the pie chart
            shared.acceptingIMG = false; // Set the acceptingIMG to false after processing the image
        }
    } catch (error) {
        console.error("Error processing image:", error);
        res.status(500).json({ error: "Failed to process image" });
    }
});

export default router;