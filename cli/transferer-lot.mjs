import { connecter, transfererLot } from "../src/tracelot.mjs";

// Usage : node cli/transferer-lot.mjs LOT-001 tannerie transporteur "Remise au transporteur"
const [lot, de, vers, motif] = process.argv.slice(2);
if (!lot || !de || !vers) {
  console.log('Usage : node cli/transferer-lot.mjs LOT-001 tannerie transporteur "Remise au transporteur"');
  process.exit(1);
}

const client = await connecter();
try {
  const { hashOffre, hashAcceptation } = await transfererLot(
    client, lot, de, vers, motif ?? "Transfert de responsabilité"
  );
  console.log(`Lot ${lot} transféré : ${de} > ${vers}`);
  console.log("Offre       : https://testnet.xrpl.org/transactions/" + hashOffre);
  console.log("Acceptation : https://testnet.xrpl.org/transactions/" + hashAcceptation);
} catch (erreur) {
  console.log("Transfert impossible :", erreur.message);
}
await client.disconnect();