import xrpl from "xrpl";

const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
await client.connect();

// Deux comptes de test créés par le faucet
const { wallet: alice } = await client.fundWallet();
const { wallet: bob } = await client.fundWallet();
console.log("Alice :", alice.address);
console.log("Bob   :", bob.address);

// 1. Préparer : autofill ajoute les frais et le numéro de séquence
const tx = await client.autofill({
  TransactionType: "Payment",
  Account: alice.address,
  Destination: bob.address,
  Amount: xrpl.xrpToDrops("10"),
  Memos: [{ Memo: { MemoData: xrpl.convertStringToHex("demo-001") } }],
});

// 2. Signer avec la clé secrète d'Alice
const signed = alice.sign(tx);

// 3. Soumettre et attendre la validation par le réseau
const res = await client.submitAndWait(signed.tx_blob);

// 4. Vérifier le résultat
console.log("Résultat :", res.result.meta.TransactionResult);
console.log("Hash     :", signed.hash);

await client.disconnect();