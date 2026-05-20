# Toshkent Ish Bot

Toshkent shahrida ish topish va berish uchun Telegram bot.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server va bot ishga tushirish (port 8080)
- `pnpm run typecheck` — full typecheck
- Required secrets: `BOT_TOKEN`, `ADMIN_ID`, `TELEGRAM_API_HASH`

## Stack

- pnpm workspaces, Node.js 22, TypeScript 5.9
- API: Express 5
- Bot: node-telegram-bot-api (polling)
- Userbot: GramJS (MTProto) — kanallardan e'lonlarni o'qish
- Storage: JSON files in `artifacts/api-server/data/`
- Build: esbuild (ESM bundle)

## Where things live

- `artifacts/api-server/src/bot/` — bot barcha mantiqi
  - `index.ts` — bot ishga tushirish
  - `handlers.ts` — barcha xabarlar va callback handler'lar
  - `keyboards.ts` — Telegram klaviaturalar
  - `search.ts` — ish qidirish algoritmi
  - `data.ts` — JSON fayl orqali ma'lumotlar saqlash
  - `userbot.ts` — GramJS userbot (kanallardan e'lon o'qish)
- `artifacts/api-server/src/routes/auth.ts` — userbot auth web sahifasi `/api/userauth/`
- `artifacts/api-server/data/` — JSON ma'lumotlar (channels, jobs, pending, sessions, userbot_session)

## Architecture decisions

- Ma'lumotlar JSON faylda saqlanadi (database o'rniga)
- Bot polling rejimida ishlaydi — webhook konfiguratsiyasiz sodda deployment
- E'lonlar faqat kalit so'z orqali topiladi, ro'yxatga chiqmaydi
- Admin ID environment variable orqali aniqlanadi
- Userbot (GramJS) kanallardan admin/obuna bo'lmasdan e'lonlarni o'qiydi
- Birinchi auth: `/api/userauth/` sahifasi orqali kod kiritiladi, session saqlanadi

## Product

- Foydalanuvchilar: ish qidirish (tuman + ish turi), e'lon berish (to'lovli 9000 so'm), donate, reklama
- Admin: kanallarni boshqarish, e'lonlarni tasdiqlash/rad etish, kanallarni yangilash

## Railway Deployment

### 1. GitHub push (Replit Shell'da):
```bash
git remote add github https://TOKEN@github.com/karimovformusic-design/krmvuz.git
git push github main --force
```

### 2. Railway.app da:
1. railway.app ga kiring → "New Project" → "Deploy from GitHub"
2. Repository: `krmvuz` ni tanlang
3. Environment Variables qo'shing:
   - `BOT_TOKEN` = (Telegram bot token)
   - `ADMIN_ID` = `6199569947`
   - `TELEGRAM_API_HASH` = `4b903bff1b2aa563978108a4f172583b`
4. Deploy tugmasini bosing
5. Deploy bo'lgandan keyin: `https://your-domain.railway.app/api/userauth/` ga kiring va auth kodini kiriting

### 3. Userbot session saqlash uchun:
Railway'da Volume qo'shing: `/app/artifacts/api-server/data` — bu JSON fayllarni saqlab qoladi

## User preferences

- Bot faqat Toshkent shahri uchun
- Karta: 5614684702056944 (Nosirjon Karimov)
- Reklama kontakt: @Karimov_112
- E'lon narxi: 9000 so'm

## Gotchas

- `data/` papkasi `.gitignore`'ga qo'shilgan — production'da Railway Volume kerak
- Bot polling ishlatadi, bir vaqtda faqat bitta instance ishlashi kerak
- Userbot birinchi marta `/api/userauth/` orqali auth qilinadi, keyin session saqlanadi
