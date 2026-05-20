import { Router } from "express";
import { submitAuthCode, submitPassword, isConnected, fetchAllChannels } from "../bot/userbot.js";

const router = Router();

const ADMIN_ID = process.env.ADMIN_ID || "";

router.get("/", (_req, res) => {
  const connected = isConnected();
  res.send(`<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Userbot Auth</title>
  <style>
    body { font-family: sans-serif; max-width: 400px; margin: 60px auto; padding: 20px; background: #f5f5f5; }
    h2 { color: #333; }
    input { width: 100%; padding: 12px; margin: 8px 0; border: 1px solid #ddd; border-radius: 8px; font-size: 18px; box-sizing: border-box; }
    button { width: 100%; padding: 14px; background: #0088cc; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 8px; }
    button:hover { background: #006699; }
    .status { padding: 12px; border-radius: 8px; margin-bottom: 16px; }
    .ok { background: #d4edda; color: #155724; }
    .err { background: #f8d7da; color: #721c24; }
    .info { background: #d1ecf1; color: #0c5460; }
  </style>
</head>
<body>
  <h2>🤖 Userbot Auth</h2>
  ${connected
    ? `<div class="status ok">✅ Userbot ulangan va ishlayapdi</div>`
    : `<div class="status err">❌ Userbot ulanmagan — kod kiriting</div>`
  }
  <div class="status info">
    Telegramdan kelgan kodni kiriting:<br>
    <small>Telefon raqam: +998200040995</small>
  </div>
  <form method="POST" action="/api/userauth/submit">
    <input type="number" name="code" placeholder="Masalan: 22306" required autofocus>
    <input type="hidden" name="key" value="${ADMIN_ID}">
    <button type="submit">✅ Kodni yuborish</button>
  </form>
  <br>
  <form method="POST" action="/api/userauth/password">
    <input type="text" name="password" placeholder="2FA parol (agar so'ralsa)">
    <input type="hidden" name="key" value="${ADMIN_ID}">
    <button type="submit" style="background:#666">🔐 2FA parol yuborish</button>
  </form>
  <br>
  <form method="POST" action="/api/userauth/sync">
    <input type="hidden" name="key" value="${ADMIN_ID}">
    <button type="submit" style="background:#28a745">🔄 Kanallarni yangilash</button>
  </form>
</body>
</html>`);
});

router.post("/submit", (req, res) => {
  const { code, key } = req.body as { code: string; key: string };
  if (key !== ADMIN_ID) {
    res.status(403).send("Ruxsat yo'q");
    return;
  }
  if (!code) {
    res.redirect("/api/userauth/");
    return;
  }
  submitAuthCode(code.trim());
  res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="3;url=/api/userauth/"></head>
<body style="font-family:sans-serif;text-align:center;padding:40px">
  <h2>✅ Kod yuborildi!</h2>
  <p>Userbot ulanmoqda... 3 soniyada qayta yo'naltirilasiz.</p>
</body></html>`);
});

router.post("/password", (req, res) => {
  const { password, key } = req.body as { password: string; key: string };
  if (key !== ADMIN_ID) {
    res.status(403).send("Ruxsat yo'q");
    return;
  }
  submitPassword(password || "");
  res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="3;url=/api/userauth/"></head>
<body style="font-family:sans-serif;text-align:center;padding:40px">
  <h2>✅ 2FA parol yuborildi!</h2>
  <p>3 soniyada qayta yo'naltirilasiz.</p>
</body></html>`);
});

router.post("/sync", async (req, res) => {
  const { key } = req.body as { key: string };
  if (key !== ADMIN_ID) {
    res.status(403).send("Ruxsat yo'q");
    return;
  }
  try {
    const count = await fetchAllChannels();
    res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="3;url=/api/userauth/"></head>
<body style="font-family:sans-serif;text-align:center;padding:40px">
  <h2>✅ ${count} ta yangi e'lon qo'shildi!</h2>
  <p>3 soniyada qayta yo'naltirilasiz.</p>
</body></html>`);
  } catch {
    res.send(`<h2>❌ Xatolik. Userbot ulanganligini tekshiring.</h2>`);
  }
});

export default router;
