const express = require("express");
const app = express();
const routes = require("./routes");
const cors = require("cors");

app.use(cors({ origin: "https://client-production-8f11.up.railway.app/" }));

app.use(function (req, res, next) {
  res.header(
    "Access-Control-Allow-Origin",
    "https://client-production-8f11.up.railway.app"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.use(express.json());

app.use("/api", routes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server beží na porte ${PORT}`);
});
