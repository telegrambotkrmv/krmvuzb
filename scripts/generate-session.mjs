// Lokal kompyuterda bir marta ishlatish uchun script
// Kerakli: Node.js 18+ o'rnatilgan bo'lishi kerak
//
// Ishlatish:
//   node scripts/generate-session.mjs
//
// Kerak bo'lsa avval o'rnating:
//   npm install telegram input

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";

const API_ID = 24368508;
const API_HASH = "4b903bff1b2aa563978108a4f172583b";

const client = new TelegramClient(new StringSession(""), API_ID, API_HASH, {
  connectionRetries: 5,
});

await client.start({
  phoneNumber: async () => await input.text("Telefon raqamingiz (+998...): "),
  phoneCode: async () => await input.text("Telegramdan kelgan kod: "),
  password: async () => await input.text("2FA parol (agar bo'lmasa Enter): "),
  onError: (err) => console.error("Xato:", err),
});

const sessionString = client.session.save();

console.log("\n✅ Session string:");
console.log("━".repeat(60));
console.log(sessionString);
console.log("━".repeat(60));
console.log("\nYuqoridagi session stringni nusxalab, botga yuboring.");

await client.disconnect();
