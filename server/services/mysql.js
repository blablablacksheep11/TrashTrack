import mysql from 'mysql2';

const database = mysql.createPool({ // Create a connection to the database
    host: '127.0.0.1',
    user: 'root',
    password: 'DATABASE_PASSWORD', // Replace with your database password
    database: 'DATABASE_NAME', // Replace with your database name
}).promise();

export default database;