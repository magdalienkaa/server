const express = require("express");
const app = express();
const routes = require("./routes");
const cors = require("cors");

app.use(cors({ origin: "https://client-production-8f11.up.railway.app" }));
app.use(express.json());

app.use("/api", routes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server beží na porte ${PORT}`);
});
