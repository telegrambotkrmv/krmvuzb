import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import type { NewMessageEvent } from "telegram/events/NewMessage.js";
import { logger } from "../lib/logger.js";
import { getChannels, getJobs, addJob, type Job } from "./data.js";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import TelegramBot from "node-telegram-bot-api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.resolve(__dirname, "../../data/userbot_session.txt");
const DATA_DIR = path.resolve(__dirname, "../../data");

function loadSession(): string {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(SESSION_FILE)) {
    return fs.readFileSync(SESSION_FILE, "utf-8").trim();
  }
  return "";
}

function saveSession(session: string) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SESSION_FILE, session, "utf-8");
}

let client: TelegramClient | null = null;
let authCodeResolve: ((code: string) => void) | null = null;
let authPasswordResolve: ((pwd: string) => void) | null = null;
let pendingAuthUserId: number | null = null;
let botRef: TelegramBot | null = null;
let connected = false;

export function setBot(bot: TelegramBot) {
  botRef = bot;
}

export function submitAuthCode(code: string) {
  if (authCodeResolve) {
    authCodeResolve(code);
    authCodeResolve = null;
  }
}

export function submitPassword(pwd: string) {
  if (authPasswordResolve) {
    authPasswordResolve(pwd);
    authPasswordResolve = null;
  }
}

export function getPendingAuthUserId() {
  return pendingAuthUserId;
}

export function isConnected() {
  return connected;
}

function parseJobFromText(text: string, channelUsername: string): Job | null {
  const lower = text.toLowerCase();
  const jobKeywords = [
    "ish", "vakansiya", "ishchi", "xodim", "kerak", "talab", "qabul",
    "oylik", "maosh", "lavozim", "mutaxassis", "operator", "haydovchi",
    "sotuvchi", "oshpaz", "afitsant", "kassir",
  ];

  const hasJobKeyword = jobKeywords.some((kw) => lower.includes(kw));
  if (!hasJobKeyword) return null;

  const phoneMatch = text.match(/\+?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}/);
  const phone = phoneMatch ? phoneMatch[0] : `@${channelUsername}`;

  const salaryMatch = text.match(/(\d[\d\s.,]*(?:so['`']?m|uzs|\$|usd))/i);
  const salary = salaryMatch ? salaryMatch[0] : "Kelishiladi";

  const districts = [
    "yunusobod", "chilonzor", "mirzo ulug'bek", "shayxontohur",
    "yakkasaroy", "uchtepa", "sergeli", "olmazar",
    "bektemir", "yashnobod", "mirobod", "hamza",
  ];
  let district = "Toshkent";
  for (const d of districts) {
    if (lower.includes(d)) {
      district = d.charAt(0).toUpperCase() + d.slice(1);
      break;
    }
  }

  const jobTypes = [
    "afitsant", "oshpaz", "haydovchi", "qorovul", "kassir", "sotuvchi",
    "operator", "menejer", "dasturchi", "hisobchi", "muhandis",
    "yuvuvchi", "tozalovchi", "tikuvchi", "elektrik", "santexnik",
    "administrator", "stajyor",
  ];
  let jobType = "Ishchi";
  for (const jt of jobTypes) {
    if (lower.includes(jt)) {
      jobType = jt.charAt(0).toUpperCase() + jt.slice(1);
      break;
    }
  }

  const shortText = text.length > 400 ? text.slice(0, 400) + "..." : text;

  return {
    id: uuidv4(),
    phone,
    jobType,
    salary,
    district,
    ageMin: 18,
    ageMax: 60,
    description: shortText,
    postedBy: 0,
    postedAt: Date.now(),
    approved: true,
    paid: true,
  };
}

async function fetchChannelHistory(channelUsername: string): Promise<number> {
  if (!client || !connected) return 0;
  let added = 0;
  try {
    const messages = await client.getMessages(channelUsername, { limit: 50 });
    const existingJobs = getJobs();

    for (const msg of messages) {
      const text = msg.text || "";
      if (!text || text.length < 20) continue;

      const isDuplicate = existingJobs.some(
        (j) => j.description && j.description.startsWith(text.slice(0, 50))
      );
      if (isDuplicate) continue;

      const job = parseJobFromText(text, channelUsername);
      if (job) {
        addJob(job);
        added++;
      }
    }
    logger.info({ channel: channelUsername, added }, "Fetched channel history");
  } catch (err) {
    logger.warn({ err, channel: channelUsername }, "Failed to fetch channel history");
  }
  return added;
}

export async function fetchAllChannels(): Promise<number> {
  const channels = getChannels();
  let total = 0;
  for (const ch of channels) {
    total += await fetchChannelHistory(ch.username);
  }
  return total;
}

function registerNewMessageHandler() {
  if (!client) return;
  client.addEventHandler(async (event: NewMessageEvent) => {
    const msg = event.message;
    if (!msg) return;
    const text = msg.text || "";
    if (!text || text.length < 20) return;

    try {
      const chat = await msg.getChat();
      if (!chat) return;
      const username = (chat as { username?: string }).username || "";
      if (!username) return;

      const channels = getChannels();
      const isTracked = channels.some(
        (c) => c.username.toLowerCase() === username.toLowerCase()
      );
      if (!isTracked) return;

      const existingJobs = getJobs();
      const isDuplicate = existingJobs.some(
        (j) => j.description && j.description.startsWith(text.slice(0, 50))
      );
      if (isDuplicate) return;

      const job = parseJobFromText(text, username);
      if (job) {
        addJob(job);
        logger.info({ channel: username, jobType: job.jobType }, "New job added from channel");
      }
    } catch (err) {
      logger.warn({ err }, "Error handling new channel message");
    }
  }, new NewMessage({}));
}

async function connectClient(adminId: number, apiId: number, apiHash: string, phone: string) {
  pendingAuthUserId = adminId;
  const sessionStr = loadSession();
  const stringSession = new StringSession(sessionStr);

  client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => phone,
    phoneCode: async () => {
      logger.info("Waiting for auth code...");
      if (botRef && adminId) {
        try {
          await botRef.sendMessage(
            adminId,
            `📱 Telegram akkauntingizga tasdiqlash kodi yuborildi.\n\n` +
            `Kodni <b>aa</b> prefiksi bilan yuboring.\nMasalan: <code>aa12345</code>\n\n` +
            `(prefix bloklanishni oldini oladi)`,
            { parse_mode: "HTML" }
          );
        } catch { /* ignore */ }
      }
      return new Promise<string>((resolve) => {
        authCodeResolve = resolve;
      });
    },
    password: async () => {
      if (botRef && adminId) {
        try {
          await botRef.sendMessage(
            adminId,
            `🔐 2FA parol so'ralmoqda.\n\nCloud parolingizni yuboring:`
          );
        } catch { /* ignore */ }
      }
      return new Promise<string>((resolve) => {
        authPasswordResolve = resolve;
      });
    },
    onError: (err) => {
      logger.error({ err }, "Userbot auth error");
    },
  });

  const session = client.session.save() as unknown as string;
  saveSession(session);
  connected = true;
  logger.info("Userbot connected and session saved");

  if (botRef && adminId) {
    try {
      await botRef.sendMessage(
        adminId,
        `✅ Userbot muvaffaqiyatli ulandi! Kanallardan e'lonlar yuklanmoqda...`
      );
    } catch { /* ignore */ }
  }

  const count = await fetchAllChannels();
  logger.info({ count }, "Initial channel fetch complete");

  if (botRef && adminId && count > 0) {
    try {
      await botRef.sendMessage(adminId, `📥 ${count} ta e'lon kanallardan olindi.`);
    } catch { /* ignore */ }
  }

  registerNewMessageHandler();
}

export async function startUserbot(adminId: number) {
  const apiId = 24368508;
  const apiHash = process.env.TELEGRAM_API_HASH || "";
  const phone = process.env.TELEGRAM_PHONE || "+998200040995";

  if (!apiHash || apiHash.length < 10) {
    logger.warn("TELEGRAM_API_HASH not set, userbot will not start");
    return;
  }

  try {
    await connectClient(adminId, apiId, apiHash, phone);
  } catch (err) {
    logger.error({ err }, "Failed to start userbot");
    connected = false;
  }
}

export async function reconnectUserbot(adminId: number, apiId: number, apiHash: string, phone: string) {
  if (client) {
    try {
      await client.disconnect();
    } catch { /* ignore */ }
    client = null;
  }
  connected = false;
  authCodeResolve = null;
  authPasswordResolve = null;

  if (botRef && adminId) {
    try {
      await botRef.sendMessage(adminId, `⏳ Userbot qayta ulanmoqda...`);
    } catch { /* ignore */ }
  }

  try {
    await connectClient(adminId, apiId, apiHash, phone);
  } catch (err) {
    connected = false;
    logger.error({ err }, "Failed to reconnect userbot");
    if (botRef && adminId) {
      try {
        await botRef.sendMessage(adminId, `❌ Userbot ulanishda xatolik: ${String(err)}`);
      } catch { /* ignore */ }
    }
  }
}

export { client };
