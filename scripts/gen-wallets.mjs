import { writeFileSync, existsSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const COUNT = Number(process.env.COUNT ?? process.argv[2] ?? 100);
const OUT = process.env.OUT ?? process.argv[3] ?? "scripts/wallets.json";

if (!Number.isFinite(COUNT) || COUNT < 1 || COUNT > 10_000) {
  console.error(`✗ COUNT must be 1..10000 (got ${COUNT})`);
  process.exit(1);
}

if (existsSync(OUT) && process.env.FORCE !== "1") {
  console.error(
    `✗ ${OUT} already exists. Set FORCE=1 to overwrite (will lose existing keys).`,
  );
  process.exit(1);
}

const keys = Array.from({ length: COUNT }, () => generatePrivateKey());
writeFileSync(OUT, JSON.stringify(keys, null, 2) + "\n");

console.log(`✓ generated ${COUNT} keys → ${OUT}`);
console.log(`  first address: ${privateKeyToAccount(keys[0]).address}`);
console.log(`  last address:  ${privateKeyToAccount(keys[keys.length - 1]).address}`);
console.log(`\nNext steps:`);
console.log(`  1. fund each wallet: FUNDER_KEY=0x... AMOUNT_CELO=0.5 npm run fund`);
console.log(`  2. paste contents of ${OUT} into GitHub Secret WALLETS`);
console.log(`  3. trigger multi-spam workflow`);
console.log(`\n⚠️  ${OUT} is gitignored. Back it up offline if you want to keep these wallets.`);
