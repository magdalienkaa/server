const express = require("express");
const path = require("path");
const router = express.Router();
const client = require("./database");
const bodyParser = require("body-parser");

router.use(express.static(path.join(__dirname, "frontend", "build")));
router.use(bodyParser.json());

router.get("/home", async (req, res) => {
  console.log("Retrieving information about dormitories...");
  try {
    const result = await client.query(
      "SELECT id_internat, nazov, popis, ENCODE(fotky,'base64') as fotky FROM internat"
    );
    console.log("Retrieved dormitories:", result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error("Error retrieving information about dormitories:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/info/:id", async (req, res) => {
  const internatId = req.params.id;
  console.log("Retrieving information about dormitory with id:", internatId);

  try {
    const result = await client.query(
      "SELECT * FROM internat WHERE id_internat = $1",
      [internatId]
    );

    if (result.rowCount === 0) {
      console.log("Dormitory not found with id:", internatId);
      return res.status(404).json({ error: "Dormitory not found" });
    }

    const internatInfo = result.rows[0];
    console.log("Retrieved dormitory info:", internatInfo);
    res.json(internatInfo);
  } catch (error) {
    console.error("Error retrieving dormitory info:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("Received password:", password);
  console.log("Login attempt:", email);
  try {
    const result = await client.query(
      "SELECT id_student, meno, priezvisko, heslo, body FROM student WHERE email = $1",
      [email]
    );

    if (result.rowCount === 0) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const student = result.rows[0];
    console.log("Retrieved student:", student);

    const isPasswordValid = password === student.heslo;
    console.log("Password comparison result:", isPasswordValid);

    if (isPasswordValid) {
      const { heslo, ...user } = student;
      console.log("Logged in user:", user);
      res.json({ success: true, user });
    } else {
      console.log("Passwords do not match");
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

router.get("/izba", async (req, res) => {
  try {
    const result = await client.query("SELECT * FROM izba");

    res.json(result.rows);
  } catch (error) {
    console.error("Chyba pri vykonávaní SELECT", error);
    res
      .status(500)
      .json({ message: "Chyba pri načítaní informácií o izbách." });
  }
});

router.post("/select/:id", async (req, res) => {
  const { id } = req.params;
  const { id_student } = req.body;

  try {
    const studentHasRoom = await client.query(
      "SELECT id_izba FROM izba WHERE id_student = $1",
      [id_student]
    );
    if (studentHasRoom.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "The student has already selected a room",
      });
    }

    const roomAlreadySelected = await client.query(
      "SELECT id_student FROM izba WHERE id_izba = $1",
      [id]
    );
    if (
      roomAlreadySelected.rows.length > 0 &&
      roomAlreadySelected.rows[0].id_student
    ) {
      return res.status(400).json({
        success: false,
        error: "The room has already been selected by another student",
      });
    }

    await client.query("UPDATE izba SET id_student = $1 WHERE id_izba = $2", [
      id_student,
      id,
    ]);

    const result = await client.query(
      "SELECT id_internat FROM izba WHERE id_izba = $1",
      [id]
    );
    const id_internat = result.rows[0].id_internat;
    await client.query(
      "INSERT INTO ziadosti(id_student, id_internat, id_izba, stav) VALUES ($1, $2, $3, $4)",
      [id_student, id_internat, id, "nevybavené"]
    );

    res
      .status(200)
      .json({ success: true, message: "Room selected successfully" });
  } catch (error) {
    console.error("Error selecting room:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

router.get("/requests/:id_student", async (req, res) => {
  const { id_student } = req.params;
  try {
    const result = await client.query(
      "SELECT ziadosti.*, izba.cislo_izby FROM ziadosti JOIN izba ON ziadosti.id_izba = izba.id_izba WHERE ziadosti.id_student = $1",
      [id_student]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error retrieving requests:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "build", "index.html"));
});

module.exports = router;
