require("dotenv").config();
const { Client } = require("pg");

const client = new Client({
  host: "localhost",
  user: "postgres",
  port: 5432,
  password: "bc3bhi2201",
  database: "StudentAccommodationDB",
});

// const client = new Client({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   port: process.env.DB_PORT,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_DATABASE,
// });

client.connect();

module.exports = client;
