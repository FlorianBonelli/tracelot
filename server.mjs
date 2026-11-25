import express from "express";
import { readdirSync, existsSync } from "node:fs";
import {
  connecter,
  compte,
  creerLot,
  transfererLot,
  historiqueLot,
  lireLot,
  ROLES,
} from "./src/tracelot.mjs";

const app = express();
app.use(express.json());
app.use(express.static("public")); // sert la page web du dossier public

// Une seule connexion au Testnet, rouverte si elle est tombée
const client = await connecter();
async function ledger() {
  if (!client.isConnected()) await client.connect();
  return client;
}

// Le nom d'un lot sert de nom de fichier : on n'accepte que lettres, chiffres et tirets
function nomValide(lot) {
  return typeof lot === "string" && /^[A-Za-z0-9-]{1,20}$/.test(lot);
}

// Liste des acteurs et de leurs adresses publiques (jamais les seeds)
app.get("/api/acteurs", (req, res) => {
  res.json(ROLES.map((role) => ({ role, adresse: compte(role).address })));
});

// Liste des lots connus (fiches off-chain)
app.get("/api/lots", (req, res) => {
  if (!existsSync("data")) return res.json([]);
  const lots = readdirSync("data")
    .filter((f) => f.endsWith(".json"))
    .map((f) => lireLot(f.replace(".json", "")));
  res.json(lots);
});

// Créer un lot
app.post("/api/lots", async (req, res) => {
  try {
    const { lot, matiere, quantite } = req.body;
    if (!nomValide(lot)) throw new Error("Nom de lot invalide (lettres, chiffres, tirets).");
    if (existsSync(`data/${lot}.json`)) throw new Error(`Le lot ${lot} existe déjà.`);
    const fiche = {
      lot,
      matiere: matiere || "cuir pleine fleur",
      quantite: quantite || "50 peaux",
      date: new Date().toISOString().slice(0, 10),
    };
    res.json(await creerLot(await ledger(), fiche));
  } catch (erreur) {
    res.status(400).json({ erreur: erreur.message });
  }
});

// Transférer un lot
app.post("/api/transferts", async (req, res) => {
  try {
    const { lot, de, vers, motif } = req.body;
    if (!nomValide(lot)) throw new Error("Nom de lot invalide.");
    if (de === vers) throw new Error("Le cédant et le receveur doivent être différents.");
    res.json(
      await transfererLot(await ledger(), lot, de, vers, motif || "Transfert de responsabilité")
    );
  } catch (erreur) {
    res.status(400).json({ erreur: erreur.message });
  }
});

// Historique d'un lot, lu sur le ledger
app.get("/api/lots/:lot/historique", async (req, res) => {
  try {
    const { lot } = req.params;
    if (!nomValide(lot)) throw new Error("Nom de lot invalide.");
    res.json(await historiqueLot(await ledger(), lot));
  } catch (erreur) {
    res.status(400).json({ erreur: erreur.message });
  }
});

// Écoute uniquement sur ce poste (127.0.0.1), pas sur le réseau
app.listen(3000, "127.0.0.1", () => {
  console.log("TraceLot est lancé : http://localhost:3000");
});
