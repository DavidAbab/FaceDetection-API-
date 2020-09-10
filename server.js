const express = require("express");
const bcrypt = require("bcrypt-nodejs");
const cors = require("cors");
const knex = require("knex");
const Clarifai = require("clarifai");

const db = knex({
  client: "pg",
  connection: {
    host: process.env.DATABASE_URL,
    ssl: true,
  },
});

const api = new Clarifai.App({
  apiKey: "eef7be14a5b04caeaed832b6fd90aca5",
});

const app = express();

app.use(cors());
app.use(express.json());

const handleApiCall = (req, res) => {
  api.models
    // This part has been updated with the recent Clarifai changed. Used to be:
    .predict(Clarifai.FACE_DETECT_MODEL, req.body.input)
    //.predict("c0c0ac362b03416da06ab3fa36fb58e3", req.body.input)
    .then((data) => {
      res.json(data);
    })
    .catch((err) => res.status(400).json("Problème avec l api"));
};

app.get("/", (req, res) => {
  res.send("ça fonctionne :)");
});

app.post("/signin", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json("Il faut remplir tout les champs !");
  }
  db.select("email", "hash")
    .from("login")
    .where("email", "=", email)
    .then((data) => {
      const isValid = bcrypt.compareSync(password, data[0].hash);
      if (isValid) {
        return db
          .select("*")
          .from("users")
          .where("email", "=", email)
          .then((user) => {
            res.json(user[0]);
          })
          .catch((err) => res.status(400).json("utilisateur introuvable"));
      } else {
        res.status(400).json("mauvais identifiants");
      }
    })
    .catch((err) => res.status(400).json("mauvais identifiants"));
});

app.post("/register", (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json("Il faut remplir tout les champs !");
  }
  const hash = bcrypt.hashSync(password);
  db.transaction((trx) => {
    trx
      .insert({
        hash: hash,
        email: email,
      })
      .into("login")
      .returning("email")
      .then((loginEmail) => {
        return trx("users")
          .returning("*")
          .insert({
            email: loginEmail[0],
            name: name,
            joined: new Date(),
          })
          .then((user) => {
            res.json(user[0]);
          });
      })
      .then(trx.commit)
      .catch(trx.rollback);
  }).catch((err) => res.status(400).json("Erreur d inscription"));
});

app.get("/profile/:id", (req, res) => {
  const { id } = req.params;
  db.select("*")
    .from("users")
    .where({ id })
    .then((user) => {
      if (user.length) {
        res.json(user[0]);
      } else {
        res.status(400).json("Pas trouvé");
      }
    })
    .catch((err) => res.status(400).json("Utilisateur introuvable"));
});

app.put("/image", (req, res) => {
  const { id } = req.body;
  db("users")
    .where("id", "=", id)
    .increment("entries", 1)
    .returning("entries")
    .then((entries) => {
      res.json(entries[0]);
    })
    .catch((err) => res.status(400).json("Score introuvable"));
});

app.post("/imageurl", (req, res) => {
  handleApiCall(req, res);
});

app.listen(process.env.PORT || 3001, () => {
  console.log("L app fonctionne");
});
