const express = require("express");
const app = express();
const routes = require("./routes");
const cors = require("cors");

app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {
  console.log("Ahoj svet");
  res.status(400).json({ hello: "world" });
});

app.use("/api", routes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server beží na porte ${PORT}`);
});
