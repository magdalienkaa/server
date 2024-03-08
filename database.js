const { Client } = require("pg");

const client = new Client({
  host: "localhost",
  user: "postgres",
  port: 5432,
  password: "bc3bhi2201",
  database: "StudentAccommodationDB",
});

// client.connect();

module.exports = client;
