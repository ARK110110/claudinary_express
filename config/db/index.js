// Get the client
import mysql from 'mysql2/promise';
import dot from "dotenv"
dot.config()

// Create the connection to database
const connection = await mysql.createConnection({
  host      : process.env.DB_HOST,
  user      : process.env.DB_USER,
  database  : process.env.DB_NAME,
  password  : process.env.DB_PASSWORD
});

export default connection