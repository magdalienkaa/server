const express = require("express");
const app = express();
const routes = require("./routes");
const cors = require("cors");

const PORT = process.env.PORT || 5000;
app.use(express.json());

app.use("/api", routes);

app.use(cors({ origin: "https://client-production-8f11.up.railway.app" }));

app.listen(PORT, () => {
  console.log(`Server beží na porte ${PORT}`);
});
