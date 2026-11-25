import xrpl from "xrpl";
import { writeFileSync, existsSync } from "node:fs";

// Sécurité : on ne recrée pas les comptes s'ils existent déjà
if (existsSync(".env")) {
  console.log("Le fichier .env existe déjà : les comptes ne sont pas recréés.");
  process.exit(0);
}

const roles = ["TANNERIE", "TRANSPORTEUR", "ATELIER", "BOUTIQUE"];

const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
await client.connect();

let env = "";
const acteurs = {};

for (const role of roles) {
  const { wallet } = await client.fundWallet();
  env += `SEED_${role}=${wallet.seed}\n`; // secret
  acteurs[role.toLowerCase()] = wallet.address; // public
  console.log(role.padEnd(13), wallet.address);
}

writeFileSync(".env", env);
writeFileSync("acteurs.json", JSON.stringify(acteurs, null, 2));
console.log("Seeds écrites dans .env, adresses écrites dans acteurs.json");

await client.disconnect();