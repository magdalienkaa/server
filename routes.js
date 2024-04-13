const express = require("express");
const path = require("path");
const router = express.Router();
const client = require("./database");
const bodyParser = require("body-parser");

router.use(express.static(path.join(__dirname, "frontend", "build")));
router.use(bodyParser.json());

router.get("/home", async (req, res) => {
  try {
    const result = await client.query(
      "SELECT id_internat, nazov, popis, ENCODE(fotky,'base64') as fotky FROM internat"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Chyba pri získavaní informácií o internátoch:", error);
    res.status(500).json({ error: "Interná chyba servera" });
  }
});

router.get("/info/:id", async (req, res) => {
  const internatId = req.params.id;

  try {
    const result = await client.query(
      "SELECT * FROM internat WHERE id_internat = $1",
      [internatId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Internát nebol nájdený" });
    }

    const internatInfo = result.rows[0];
    res.json(internatInfo);
  } catch (error) {
    console.error("Chyba pri získavaní informácií o internáte:", error);
    res.status(500).json({ error: "Interná chyba servera" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await client.query(
      "SELECT * FROM student WHERE email = $1",
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
    res.status(500).json({ success: false, error: "Interná chyba servera" });
  }
});

router.get("/izba", async (req, res) => {
  try {
    const result = await client.query(`
      SELECT izba.*, internat.nazov
      FROM izba
      JOIN internat ON izba.id_internat = internat.id_internat
      WHERE izba.id_izba NOT IN (
        SELECT id_izba 
        FROM ziadosti 
        WHERE stav IN ('nevybavené', 'schválené')
      )
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Chyba pri vykonávaní SELECT", error);
    res
      .status(500)
      .json({ message: "Chyba pri načítaní informácií o izbách:" });
  }
});

router.post("/select/:id_izba", async (req, res) => {
  const { id_izba } = req.params;
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
        error: "Admin si nemôže vyberať izbu!",
      });
    }

    const studentRoomStatus = await client.query(
      "SELECT maizbu FROM student WHERE id_student = $1",
      [id_student]
    );

    if (studentRoomStatus.rows.length > 0) {
      const maizbu = studentRoomStatus.rows[0].maizbu;
      if (maizbu === "Schválené" || maizbu === "Požiadané") {
        return res.status(400).json({
          success: false,
          error: "Študent už má vybratú izbu!",
        });
      } else if (maizbu === "Nepožiadané" || maizbu === "Zamietnuté") {
        const result = await client.query(
          "SELECT id_internat FROM izba WHERE id_izba = $1",
          [id_izba]
        );
        const id_internat = result.rows[0].id_internat;
        await client.query(
          "INSERT INTO ziadosti(id_student, id_internat, id_izba, stav) VALUES ($1, $2, $3, $4)",
          [id_student, id_internat, id_izba, "nevybavené"]
        );
        await client.query(
          "UPDATE student SET maizbu = 'Požiadané' WHERE id_student = $1",
          [id_student]
        );
        return res.status(200).json({
          success: true,
          message: "Izba úspešne vybratá.",
        });
      }
    }

    res.status(200).json({
      success: false,
      error: "Nepodarilo sa získať stav izby pre tohto študenta.",
    });
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
      console.error("Chyba pri získavaní roly používateľa:", error);
      throw new Error("Nepodarilo sa získať rolu používateľa.");
    }
  };

  const userRole = await getUserRole(id_student);

  try {
    let query;
    let queryParams = [id_student];

    if (userRole === "admin") {
      query =
        "SELECT ziadosti.*, izba.cislo_izby, ziadosti.id_student, student.body FROM ziadosti JOIN izba ON ziadosti.id_izba = izba.id_izba JOIN student ON ziadosti.id_student = student.id_student";
      queryParams = [];
    } else {
      query =
        "SELECT ziadosti.*, izba.cislo_izby, student.body FROM ziadosti JOIN izba ON ziadosti.id_izba = izba.id_izba JOIN student ON ziadosti.id_student = student.id_student WHERE ziadosti.id_student = $1";
    }

    const { sortByPoints, sortByTime } = req.query;

    if (sortByPoints) {
      query +=
        " ORDER BY student.body " + (sortByPoints === "asc" ? "ASC" : "DESC");
    }

    if (sortByTime) {
      query +=
        " ORDER BY ziadosti.cas_ziadosti " +
        (sortByTime === "asc" ? "ASC" : "DESC");
    }

    const result = await client.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error("Chyba pri získavaní žiadostí:", error);
    res.status(500).json({ error: "Interná chyba servera" });
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
    console.error("Chyba pri získavaní fotiek internátov:", error);
    res.status(500).json({ error: "Interná chyba servera" });
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

    const id_izba = requestExists.rows[0].id_izba;

    await client.query("UPDATE izba SET id_student = $1 WHERE id_izba = $2", [
      id_student,
      id_izba,
    ]);

    await client.query(
      "UPDATE student SET id_izba = $1, maizbu = $2 WHERE id_student = $3",
      [id_izba, "Schválené", id_student]
    );

    await client.query("UPDATE ziadosti SET stav = NULL WHERE id = $1", [id]);

    await client.query(
      "UPDATE ziadosti SET stav = $1, cas_ziadosti = CURRENT_TIMESTAMP WHERE id = $2",
      ["schválené", id]
    );
    res
      .status(200)
      .json({ success: true, message: "Žiadosť bola úspešne schválená" });
  } catch (error) {
    console.error("Chyba pri schvaľovaní žiadosti:", error);
    res.status(500).json({ success: false, error: "Interná chyba servera" });
  }
});

router.delete("/request/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const deletedRequest = await client.query(
      "DELETE FROM ziadosti WHERE id = $1 RETURNING id_student",
      [id]
    );

    if (deletedRequest.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Žiadosť nebola nájdená",
      });
    }

    const id_student = deletedRequest.rows[0].id_student;

    await client.query("UPDATE student SET maizbu = $1 WHERE id_student = $2", [
      "Nepožiadané",
      id_student,
    ]);

    res
      .status(200)
      .json({ success: true, message: "Žiadosť bola úspešne odstránená" });
  } catch (error) {
    console.error("Chyba pri odstraňovaní žiadosti:", error);
    res.status(500).json({ success: false, error: "Interná chyba servera" });
  }
});

router.put("/reject/:id", async (req, res) => {
  const { id } = req.params;

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

    await client.query(
      "UPDATE ziadosti SET stav = 'zamietnuté', cas_ziadosti = CURRENT_TIMESTAMP WHERE id = $1",
      [id]
    );

    await client.query("UPDATE izba SET id_student = NULL WHERE id_izba = $1", [
      requestExists.rows[0].id_izba,
    ]);

    await client.query(
      "UPDATE student SET id_izba = NULL, maizbu = 'Zamietnuté' WHERE id_student = $1",
      [requestExists.rows[0].id_student]
    );

    res
      .status(200)
      .json({ success: true, message: "Žiadosť bola úspešne zamietnutá" });
  } catch (error) {
    console.error("Chyba pri zamietaní žiadosti:", error);
    res.status(500).json({ success: false, error: "Interná chyba servera" });
  }
});

router.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "build", "index.html"));
});
module.exports = router;
