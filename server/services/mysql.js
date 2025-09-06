import mysql from 'mysql2';

const database = mysql.createPool({ // Create a connection to the database
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, // Replace with your database password
    database: process.env.DB_NAME, // Replace with your database name
    dateStrings: true, // Return date and time as strings instead of JS Date object
}).promise();

if (database) {
    console.log("Connected to the MySQL database.");
} else {
    console.log("MySQL database connection failed.");
}

export default database;