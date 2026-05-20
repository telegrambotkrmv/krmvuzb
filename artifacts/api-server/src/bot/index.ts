import TelegramBot from "node-telegram-bot-api";
import { logger } from "../lib/logger.js";
import { registerHandlers } from "./handlers.js";
import { startUserbot, setBot } from "./userbot.js";
import { startScheduler } from "./scheduler.js";

const ADMIN_ID = Number(process.env.ADMIN_ID);

let bot: TelegramBot | null = null;

export function startBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    logger.warn("BOT_TOKEN not set, bot will not start");
    return;
  }

  bot = new TelegramBot(token, { polling: true });

  bot.on("polling_error", (err) => {
    logger.error({ err: err.message }, "Telegram polling error");
  });

  bot.on("error", (err) => {
    logger.error({ err: err.message }, "Telegram bot error");
  });

  registerHandlers(bot);
  startScheduler();

  logger.info("Telegram bot started (polling)");

  setBot(bot);
  startUserbot(ADMIN_ID).catch((err) => {
    logger.error({ err }, "Userbot failed to start");
  });
}

export function stopBot() {
  if (bot) {
    bot.stopPolling();
    bot = null;
  }
}

export { bot };
