const { Client } = require("pg");

// const client = new Client({
//   host: "localhost",
//   user: "postgres",
//   port: 5432,
//   password: "bc3bhi2201",
//   database: "StudentAccommodationDB",
// });

const client = new Client({
  host: "roundhouse.proxy.rlwy.net",
  user: "postgres",
  port: 46497,
  password: "YjPiiTSfGKwWdLXyibhimVaIvZTFPIKW",
  database: "railway",
});

client.connect();

module.exports = client;
