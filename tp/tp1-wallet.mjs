import xrpl from "xrpl";

// Connexion au Testnet public
const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
await client.connect();

// Le faucet crée un compte et lui verse des XRP de test
const { wallet, balance } = await client.fundWallet();

console.log("Adresse :", wallet.address);
console.log("Seed    :", wallet.seed);
console.log("Solde   :", balance, "XRP");

await client.disconnect();