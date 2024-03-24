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

  try {
    const result = await client.query(
      "SELECT id_student, meno, priezvisko, heslo, body, role FROM student WHERE email = $1",
      [email]
    );

    if (result.rowCount === 0) {
      res
        .status(401)
        .json({ success: false, message: "Neplatné prihlasovacie údaje." });
      return;
    }

    const student = result.rows[0];
    const isPasswordValid = password === student.heslo;

    if (isPasswordValid) {
      const { heslo, ...user } = student;
      res.json({ success: true, user });
    } else {
      res
        .status(401)
        .json({ success: false, message: "Neplatné prihlasovacie údaje." });
    }
  } catch (error) {
    console.error("Chyba počas prihlasovania.", error);
    res.status(500).json({ success: false, error: "Interná chyba servera." });
  }
});
router.get("/izba", async (req, res) => {
  try {
    const result = await client.query(`
      SELECT izba.*, internat.nazov_internatu
      FROM izba
      JOIN internat ON izba.id_internat = internat.id_internat
    `);

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

  const getUserRole = async (id_student) => {
    try {
      const result = await client.query(
        "SELECT role FROM student WHERE id_student = $1",
        [id_student]
      );
      return result.rows[0].role;
    } catch (error) {
      console.error("Chyba pri získavaní role používateľa:", error);
      throw new Error("Nepodarilo sa získať rolu používateľa");
    }
  };

  try {
    const userRole = await getUserRole(id_student);

    if (userRole === "admin") {
      return res.status(400).json({
        success: false,
        error: "Admin nemôže vybrať izbu",
      });
    }

    const studentHasRoom = await client.query(
      "SELECT id_izba FROM ziadosti WHERE id_student = $1",
      [id_student]
    );
    if (studentHasRoom.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Študent už má vybratú izbu",
      });
    }

    const roomAlreadySelected = await client.query(
      "SELECT id_student FROM ziadosti WHERE id_izba = $1",
      [id]
    );
    if (
      roomAlreadySelected.rows.length > 0 &&
      roomAlreadySelected.rows[0].id_student
    ) {
      return res.status(400).json({
        success: false,
        error: "Izbu už zvolil iný študent",
      });
    }

    const result = await client.query(
      "SELECT id_internat FROM izba WHERE id_izba = $1",
      [id]
    );
    const id_internat = result.rows[0].id_internat;
    await client.query(
      "INSERT INTO ziadosti(id_student, id_internat, id_izba, stav) VALUES ($1, $2, $3, $4)",
      [id_student, id_internat, id, "nevybavené"]
    );

    res.status(200).json({ success: true, message: "Izba úspešne vybratá" });
  } catch (error) {
    console.error("Chyba pri výbere izby:", error);
    res.status(500).json({ success: false, error: "Interná chyba servera" });
  }
});

router.get("/requests/:id_student", async (req, res) => {
  const { id_student } = req.params;

  const getUserRole = async (id_student) => {
    try {
      const result = await client.query(
        "SELECT role FROM student WHERE id_student = $1",
        [id_student]
      );
      return result.rows[0].role;
    } catch (error) {
      console.error("Error fetching user role:", error);
      throw new Error("Failed to fetch user role");
    }
  };

  const userRole = await getUserRole(id_student);

  try {
    let query;
    let queryParams = [id_student];

    if (userRole === "admin") {
      query =
        "SELECT ziadosti.*, izba.cislo_izby, ziadosti.id_student FROM ziadosti JOIN izba ON ziadosti.id_izba = izba.id_izba";
      queryParams = [];
    } else {
      query =
        "SELECT ziadosti.*, izba.cislo_izby FROM ziadosti JOIN izba ON ziadosti.id_izba = izba.id_izba WHERE ziadosti.id_student = $1";
    }

    const result = await client.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error("Error retrieving requests:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/fotky/:id_internat", async (req, res) => {
  const { id_internat } = req.params;
  const { typ } = req.query;

  try {
    let query =
      "SELECT id_fotka, ENCODE(fotka,'base64') as fotka, id_internat, typ FROM fotky_intraky WHERE id_internat = $1";
    let values = [id_internat];

    if (typ) {
      query += " AND typ = $2";
      values.push(typ);
    }

    const result = await client.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error("Error retrieving photos for dormitory", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "build", "index.html"));
});

router.delete("/request/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await client.query("DELETE FROM ziadosti WHERE id = $1", [
      id,
    ]);

    if (result.rowCount === 1) {
      res
        .status(200)
        .json({ success: true, message: "Žiadosť bola úspešne odstránená" });
    } else {
      res
        .status(404)
        .json({ success: false, message: "Žiadosť nebola nájdená" });
    }
  } catch (error) {
    console.error("Chyba pri odstraňovaní žiadosti:", error);
    res.status(500).json({ success: false, error: "Interná serverová chyba" });
  }
});
router.put("/approve/:id", async (req, res) => {
  const { id } = req.params;
  const { id_student } = req.body;

  try {
    const requestExists = await client.query(
      "SELECT * FROM ziadosti WHERE id = $1",
      [id]
    );
    if (requestExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Žiadosť neexistuje",
      });
    }

    const id_izba = requestExists.rows[0].id_izba; // Získajte id_izba z existujúcej žiadosti

    await client.query("UPDATE izba SET id_student = $1 WHERE id_izba = $2", [
      id_student,
      id_izba, // Použite id_izba z existujúcej žiadosti
    ]);

    await client.query(
      "UPDATE student SET id_izba = $1 WHERE id_student = $2",
      [id_izba, id_student] // Tu pridajte id_izba pre študenta
    );

    await client.query("DELETE FROM ziadosti WHERE id = $1", [id]);
    res
      .status(200)
      .json({ success: true, message: "Žiadosť bola úspešne schválená" });
  } catch (error) {
    console.error("Chyba pri schvaľovaní žiadosti:", error);
    res.status(500).json({ success: false, error: "Interná chyba servera" });
  }
});

module.exports = router;
