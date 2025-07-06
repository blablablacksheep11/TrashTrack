import mysql from 'mysql2';

const database = mysql.createPool({ // Create a connection to the database
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, // Replace with your database password
    database: process.env.DB_NAME, // Replace with your database name
}).promise();

export default database;