import TelegramBot from "node-telegram-bot-api";
import { v4 as uuidv4 } from "uuid";
import {
  getChannels, addChannel, removeChannel,
  getJobs, addJob, deleteJob, getJobById, getUserJobs,
  addPendingJob, getPendingJobs, getPendingById, removePendingJob,
  getSession, setSession, clearSession,
  trackUser, getAllUserIds,
  type Job, type Channel,
} from "./data.js";
import {
  mainKeyboard, cancelKeyboard, districtKeyboard, donateKeyboard,
  inlineApprove, editDeleteKeyboard, confirmDeleteKeyboard, myJobsKeyboard, channelsKeyboard,
  userbotStatusKeyboard,
} from "./keyboards.js";
import { searchJobs, formatJob } from "./search.js";
import { logger } from "../lib/logger.js";
import {
  submitAuthCode, submitPassword, getPendingAuthUserId,
  fetchAllChannels, isConnected, reconnectUserbot,
} from "./userbot.js";

const ADMIN_ID = Number(process.env.ADMIN_ID);
const CARD_NUMBER = "5614684702056944";
const CARD_OWNER = "Nosirjon Karimov";
const JOB_PRICE = 9000;
const CONTACT_LINK = "@Karimov_112";

function isAdmin(userId: number) {
  return userId === ADMIN_ID;
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendMain(bot: TelegramBot, chatId: number, userId: number, text: string) {
  await bot.sendMessage(chatId, text, {
    parse_mode: "HTML",
    reply_markup: mainKeyboard(userId),
  });
}

export function registerHandlers(bot: TelegramBot) {

  bot.onText(/\/start/, async (msg) => {
    const userId = msg.from!.id;
    const chatId = msg.chat.id;
    clearSession(userId);
    await sendMain(
      bot, chatId, userId,
      `<b>Assalomu alaykum!</b> 👋\n\nToshkent shahrida ish topish va berish botiga xush kelibsiz.\n\nKerakli bo'limni tanlang:`
    );
  });

  bot.onText(/\/myads/, async (msg) => {
    const userId = msg.from!.id;
    const chatId = msg.chat.id;
    await showMyJobs(bot, chatId, userId);
  });

  bot.on("message", async (msg) => {
    if (!msg.text && !msg.photo && !msg.document) return;
    const userId = msg.from!.id;
    const chatId = msg.chat.id;
    const text = msg.text || "";

    if (text.startsWith("/")) return;

    trackUser(userId);

    // Auth kodi: "aa12345" yoki "12345" formatida (aa prefiksi bloklanishni oldini oladi)
    if (getPendingAuthUserId() === userId) {
      const raw = text.trim();
      const codeMatch = raw.match(/^(?:aa)?(\d{5,6})$/i);
      if (codeMatch) {
        submitAuthCode(codeMatch[1]);
        await bot.sendMessage(chatId, "✅ Kod qabul qilindi, ulanmoqda...");
        return;
      }
    }

    const session = getSession(userId);

    if (text === "❌ Bekor qilish") {
      clearSession(userId);
      await sendMain(bot, chatId, userId, "Bekor qilindi.");
      return;
    }

    if (session) {
      await handleSession(bot, msg, session);
      return;
    }

    switch (text) {
      case "🔍 Ish qidirish":
        setSession({ userId, step: "search_query", data: {} });
        await bot.sendMessage(chatId,
          `Toshkent tumani va ish turini kiriting.\n\nMasalan: <b>Yunusobod afitsant</b> yoki <b>Chilonzor oshpaz</b>`,
          { parse_mode: "HTML", reply_markup: cancelKeyboard() }
        );
        break;

      case "📢 E'lon berish":
        setSession({ userId, step: "post_phone", data: {} });
        await bot.sendMessage(chatId,
          `📞 Telefon raqamingizni kiriting (masalan: +998901234567):`,
          { parse_mode: "HTML", reply_markup: cancelKeyboard() }
        );
        break;

      case "💳 Donate qilish":
        await bot.sendMessage(chatId,
          `💳 <b>Karta raqami:</b> <code>${CARD_NUMBER}</code>\n` +
          `👤 <b>Egasi:</b> ${esc(CARD_OWNER)}\n\n` +
          `Har qanday miqdorda donate qilishingiz mumkin. Rahmat! 🙏\n\n` +
          `<i>To'lovdan so'ng "✅ Donate qildim" tugmasini bosing.</i>`,
          { parse_mode: "HTML", reply_markup: donateKeyboard() }
        );
        break;

      case "✅ Donate qildim":
        setSession({ userId, step: "donate_username", data: {} });
        await bot.sendMessage(chatId,
          `✅ Rahmat! Tasdiqlash uchun bir necha ma'lumot kerak.\n\n` +
          `👤 <b>Ismingiz yoki username'ingizni yozing:</b>\n` +
          `(masalan: Akbar yoki @akbar123)`,
          { parse_mode: "HTML", reply_markup: cancelKeyboard() }
        );
        break;

      case "📣 Reklama uchun admin bilan bog'lanish":
        await bot.sendMessage(chatId,
          `📣 Reklama uchun admin bilan bog'laning: ${CONTACT_LINK}`
        );
        break;

      case "📋 Mening e'lonlarim":
        await showMyJobs(bot, chatId, userId);
        break;

      case "➕ Kanal qo'shish":
        if (!isAdmin(userId)) break;
        setSession({ userId, step: "admin_add_channel", data: {} });
        await bot.sendMessage(chatId,
          `Kanal username ini kiriting (masalan: @myjobchannel):`,
          { reply_markup: cancelKeyboard() }
        );
        break;

      case "📋 Kanallar ro'yxati":
        if (!isAdmin(userId)) break;
        await showChannels(bot, chatId);
        break;

      case "⏳ Tasdiqlash kutayotgan e'lonlar":
        if (!isAdmin(userId)) break;
        await showPending(bot, chatId);
        break;

      case "🤖 Userbot holati":
        if (!isAdmin(userId)) break;
        await bot.sendMessage(chatId,
          isConnected()
            ? `✅ <b>Userbot ulangan</b>\n\nKanallardan yangi e'lonlar avtomatik olinadi.`
            : `❌ <b>Userbot ulanmagan</b>\n\nQayta faollashtirish uchun tugmani bosing.`,
          { parse_mode: "HTML", reply_markup: userbotStatusKeyboard(isConnected()) }
        );
        break;

      case "📊 Statistika":
        if (!isAdmin(userId)) break;
        await showStats(bot, chatId);
        break;

      case "📢 Hammaga xabar":
        if (!isAdmin(userId)) break;
        setSession({ userId, step: "broadcast_msg", data: {} });
        await bot.sendMessage(chatId,
          `📢 <b>Hammaga xabar yuborish</b>\n\n` +
          `Yuboriladigan xabarni kiriting.\n` +
          `<i>Matn, rasm, yoki video bo'lishi mumkin.</i>\n\n` +
          `Foydalanuvchilar soni: <b>${getAllUserIds().length} ta</b>`,
          { parse_mode: "HTML", reply_markup: cancelKeyboard() }
        );
        break;

      case "🔄 Kanallarni yangilash":
        if (!isAdmin(userId)) break;
        await bot.sendMessage(chatId, "⏳ Kanallardan e'lonlar olinmoqda...");
        try {
          const count = await fetchAllChannels();
          await bot.sendMessage(chatId, `✅ ${count} ta yangi e'lon qo'shildi.`);
        } catch (err) {
          await bot.sendMessage(chatId, "❌ Xatolik yuz berdi. Userbot ulanganligini tekshiring.");
        }
        break;

      default:
        await sendMain(bot, chatId, userId, "Tugmadan birini tanlang.");
    }
  });

  bot.on("callback_query", async (query) => {
    const userId = query.from.id;
    const chatId = query.message!.chat.id;
    const data = query.data || "";

    await bot.answerCallbackQuery(query.id);

    if (data.startsWith("approve_")) {
      if (!isAdmin(userId)) return;
      const id = data.replace("approve_", "");
      const pending = getPendingById(id);
      if (!pending) {
        await bot.sendMessage(chatId, "E'lon topilmadi yoki allaqachon ko'rib chiqilgan.");
        return;
      }
      pending.job.approved = true;
      pending.job.paid = true;
      addJob(pending.job);
      removePendingJob(id);
      await bot.sendMessage(chatId, `✅ E'lon tasdiqlandi!`);
      try {
        await bot.sendMessage(
          pending.job.postedBy,
          `✅ E'loningiz tasdiqlandi va botga joylandi!\n\nIsh: <b>${esc(pending.job.jobType)}</b> — ${esc(pending.job.district)}`,
          { parse_mode: "HTML" }
        );
      } catch (e) {
        logger.warn({ err: e }, "Could not notify job poster");
      }
    }

    if (data.startsWith("reject_")) {
      if (!isAdmin(userId)) return;
      const id = data.replace("reject_", "");
      const pending = getPendingById(id);
      if (!pending) {
        await bot.sendMessage(chatId, "E'lon topilmadi.");
        return;
      }
      removePendingJob(id);
      await bot.sendMessage(chatId, `❌ E'lon rad etildi.`);
      try {
        await bot.sendMessage(
          pending.job.postedBy,
          `❌ E'loningiz rad etildi. Batafsil ma'lumot uchun: ${CONTACT_LINK}`
        );
      } catch (e) {
        logger.warn({ err: e }, "Could not notify job poster");
      }
    }

    if (data.startsWith("ch_del_")) {
      if (!isAdmin(userId)) return;
      const chId = data.replace("ch_del_", "");
      const channels = getChannels();
      const ch = channels.find((c) => c.id === chId);
      if (!ch) {
        await bot.sendMessage(chatId, "Kanal topilmadi.");
        return;
      }
      removeChannel(ch.username);
      await bot.answerCallbackQuery(query.id, { text: `✅ @${ch.username} o'chirildi` });
      const updated = getChannels();
      if (updated.length === 0) {
        await bot.editMessageText("Barcha kanallar o'chirildi.", {
          chat_id: chatId,
          message_id: query.message!.message_id,
        });
      } else {
        await bot.editMessageText(
          `📋 <b>Ulangan kanallar (${updated.length} ta):</b>\n\nO'chirish uchun 🗑️ tugmasini bosing:`,
          {
            chat_id: chatId,
            message_id: query.message!.message_id,
            parse_mode: "HTML",
            reply_markup: channelsKeyboard(updated),
          }
        );
      }
      return;
    }

    if (data === "ub_refresh") {
      if (!isAdmin(userId)) return;
      await bot.sendMessage(chatId, "⏳ Kanallardan e'lonlar olinmoqda...");
      try {
        const count = await fetchAllChannels();
        await bot.sendMessage(chatId, `✅ ${count} ta yangi e'lon qo'shildi.`);
      } catch {
        await bot.sendMessage(chatId, "❌ Xatolik. Userbot holatini tekshiring.");
      }
      return;
    }

    if (data === "ub_reconnect") {
      if (!isAdmin(userId)) return;
      clearSession(userId);
      setSession({ userId, step: "ub_api_id", data: {} });
      await bot.sendMessage(chatId,
        `🤖 <b>Userbot faollashtirish</b>\n\n` +
        `<b>1-qadam:</b> API ID kiriting\n` +
        `(Masalan: <code>24368508</code>)\n\n` +
        `<i>my.telegram.org → API development tools</i>`,
        { parse_mode: "HTML", reply_markup: cancelKeyboard() }
      );
      return;
    }

    if (data.startsWith("ch_view_")) {
      return;
    }

    if (data.startsWith("myjob_")) {
      const id = data.replace("myjob_", "");
      const job = getJobById(id);
      if (!job || job.postedBy !== userId) return;
      const status = job.approved ? "✅ <b>Tasdiqlangan</b>" : "⏳ <b>Tasdiq kutmoqda</b>";
      await bot.sendMessage(chatId,
        `${formatJob(job)}\n\n${status}`,
        { parse_mode: "HTML", reply_markup: editDeleteKeyboard(id) }
      );
      return;
    }

    if (data.startsWith("delete_")) {
      const id = data.replace("delete_", "");
      const job = getJobById(id);
      if (!job || job.postedBy !== userId) return;
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: chatId, message_id: query.message!.message_id }
      ).catch(() => {});
      await bot.sendMessage(chatId,
        `⚠️ <b>E'lonni o'chirishni tasdiqlaysizmi?</b>\n\n💼 ${esc(job.jobType)} — ${esc(job.district)}`,
        { parse_mode: "HTML", reply_markup: confirmDeleteKeyboard(id) }
      );
      return;
    }

    if (data.startsWith("confirm_del_")) {
      const id = data.replace("confirm_del_", "");
      const job = getJobById(id);
      if (!job || job.postedBy !== userId) return;
      deleteJob(id);
      await bot.editMessageText(
        `🗑️ E'lon o'chirildi.\n\n💼 ${esc(job.jobType)} — ${esc(job.district)}`,
        { chat_id: chatId, message_id: query.message!.message_id, parse_mode: "HTML" }
      );
      return;
    }

    if (data.startsWith("cancel_del_")) {
      const id = data.replace("cancel_del_", "");
      const job = getJobById(id);
      if (!job || job.postedBy !== userId) return;
      await bot.editMessageText(
        `${formatJob(job)}\n\n${job.approved ? "✅ <b>Tasdiqlangan</b>" : "⏳ <b>Tasdiq kutmoqda</b>"}`,
        {
          chat_id: chatId,
          message_id: query.message!.message_id,
          parse_mode: "HTML",
          reply_markup: editDeleteKeyboard(id),
        }
      );
      return;
    }

  });
}

async function handleSession(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  session: NonNullable<ReturnType<typeof getSession>>
) {
  const userId = msg.from!.id;
  const chatId = msg.chat.id;
  const text = msg.text || "";

  switch (session.step) {

    case "search_query": {
      clearSession(userId);
      const jobs = getJobs();
      const results = searchJobs(jobs, text);
      if (results.length === 0) {
        const fallback = jobs.filter((j) => j.approved && j.paid).slice(0, 3);
        if (fallback.length === 0) {
          await sendMain(bot, chatId, userId, "Hozircha mos e'lonlar topilmadi. Keyinroq urinib ko'ring.");
        } else {
          await bot.sendMessage(chatId,
            `"${esc(text)}" bo'yicha mos e'lon topilmadi. Boshqa e'lonlardan namunalar:`,
            { parse_mode: "HTML" }
          );
          for (const job of fallback) {
            await bot.sendMessage(chatId, formatJob(job), { parse_mode: "HTML" });
          }
          await sendMain(bot, chatId, userId, "Bosh menyu:");
        }
      } else {
        await bot.sendMessage(chatId, `✅ ${results.length} ta e'lon topildi:`, { parse_mode: "HTML" });
        for (const job of results) {
          await bot.sendMessage(chatId, formatJob(job), { parse_mode: "HTML" });
        }
        await sendMain(bot, chatId, userId, "Bosh menyu:");
      }
      break;
    }

    case "post_phone": {
      if (!text.match(/^\+?[0-9\s\-()]{7,15}$/)) {
        await bot.sendMessage(chatId, "Noto'g'ri format. Qaytadan kiriting (+998901234567):");
        return;
      }
      session.data.phone = text;
      session.step = "post_jobtype";
      setSession(session);
      await bot.sendMessage(chatId, "💼 Ish turini kiriting (masalan: Afitsant, Oshpaz, Haydovchi):", { reply_markup: cancelKeyboard() });
      break;
    }

    case "post_jobtype": {
      session.data.jobType = text;
      session.step = "post_salary";
      setSession(session);
      await bot.sendMessage(chatId, "💰 Oylik maoshni kiriting (masalan: 2 000 000 so'm yoki kelishiladi):", { reply_markup: cancelKeyboard() });
      break;
    }

    case "post_salary": {
      session.data.salary = text;
      session.step = "post_district";
      setSession(session);
      await bot.sendMessage(chatId, "📍 Tumanni tanlang:", { reply_markup: districtKeyboard() });
      break;
    }

    case "post_district": {
      session.data.district = text;
      session.step = "post_age";
      setSession(session);
      await bot.sendMessage(chatId, "👤 Ishchi yosh chegarasini kiriting (masalan: 18-35):", { reply_markup: cancelKeyboard() });
      break;
    }

    case "post_age": {
      const match = text.match(/^(\d+)\s*[-–]\s*(\d+)$/);
      if (!match) {
        await bot.sendMessage(chatId, "Format noto'g'ri. Masalan: 18-35");
        return;
      }
      session.data.ageMin = parseInt(match[1]);
      session.data.ageMax = parseInt(match[2]);
      session.step = "post_desc";
      setSession(session);
      await bot.sendMessage(chatId, "📝 Qo'shimcha ma'lumot kiriting (yoki \"yoq\" deb yozing):", { reply_markup: cancelKeyboard() });
      break;
    }

    case "post_desc": {
      session.data.description = text === "yoq" ? "" : text;
      session.step = "post_receipt";
      setSession(session);
      await bot.sendMessage(chatId,
        `💳 E'lon joylash narxi: <b>${JOB_PRICE.toLocaleString()} so'm</b>\n\nKarta: <code>${CARD_NUMBER}</code>\nEgasi: ${esc(CARD_OWNER)}\n\nTo'lovni amalga oshirib, chekni (screenshot yoki rasm) botga yuboring:`,
        { parse_mode: "HTML", reply_markup: cancelKeyboard() }
      );
      break;
    }

    case "post_receipt": {
      let fileId: string | undefined;
      if (msg.photo) {
        fileId = msg.photo[msg.photo.length - 1].file_id;
      } else if (msg.document) {
        fileId = msg.document.file_id;
      }
      if (!fileId) {
        await bot.sendMessage(chatId, "Iltimos, to'lov chekini rasm yoki fayl sifatida yuboring.");
        return;
      }

      const jobId = uuidv4();
      const job: Job = {
        id: jobId,
        phone: String(session.data.phone),
        jobType: String(session.data.jobType),
        salary: String(session.data.salary),
        district: String(session.data.district),
        ageMin: Number(session.data.ageMin),
        ageMax: Number(session.data.ageMax),
        description: String(session.data.description || ""),
        postedBy: userId,
        postedAt: Date.now(),
        approved: false,
        paid: false,
        receiptFile: fileId,
      };

      addPendingJob({ id: jobId, job, receiptFile: fileId, submittedAt: Date.now() });
      clearSession(userId);

      await bot.sendMessage(chatId,
        `✅ E'loningiz qabul qilindi! Admin tasdiqlashini kuting.\n\n<b>${JOB_PRICE.toLocaleString()} so'm</b> to'lov tekshiriladi.`,
        { parse_mode: "HTML", reply_markup: mainKeyboard(userId) }
      );

      const adminText =
        `📬 <b>Yangi e'lon va to'lov cheki</b>\n\n` +
        formatJob(job) +
        `\n<i>Tasdiqlaysizmi?</i>`;

      try {
        await bot.sendPhoto(ADMIN_ID, fileId, {
          caption: adminText,
          parse_mode: "HTML",
          reply_markup: inlineApprove(jobId),
        });
      } catch (e) {
        logger.error({ err: e }, "Failed to send receipt to admin");
      }
      break;
    }

    case "broadcast_msg": {
      if (!isAdmin(userId)) return;
      const userIds = getAllUserIds();
      clearSession(userId);

      await bot.sendMessage(chatId,
        `⏳ Yuborilmoqda... (${userIds.length} ta foydalanuvchi)`,
        { reply_markup: mainKeyboard(userId) }
      );

      let sent = 0;
      let failed = 0;
      for (const uid of userIds) {
        try {
          if (msg.photo) {
            const fileId = msg.photo[msg.photo.length - 1].file_id;
            await bot.sendPhoto(uid, fileId, { caption: msg.caption || "", parse_mode: "HTML" });
          } else if (msg.video) {
            await bot.sendVideo(uid, msg.video.file_id, { caption: msg.caption || "", parse_mode: "HTML" });
          } else if (msg.document) {
            await bot.sendDocument(uid, msg.document.file_id, { caption: msg.caption || "", parse_mode: "HTML" });
          } else if (text) {
            await bot.sendMessage(uid, text, { parse_mode: "HTML" });
          }
          sent++;
        } catch {
          failed++;
        }
        await new Promise((r) => setTimeout(r, 50));
      }

      await bot.sendMessage(chatId,
        `✅ <b>Xabar yuborildi!</b>\n\n📤 Muvaffaqiyatli: ${sent} ta\n❌ Yetkazilmadi: ${failed} ta`,
        { parse_mode: "HTML" }
      );
      break;
    }

    case "donate_username": {
      const donorName = text.trim();
      if (donorName.length < 2) {
        await bot.sendMessage(chatId, "Iltimos, to'liq ism yoki username yozing:");
        return;
      }
      session.data.donorName = donorName;
      session.step = "donate_receipt";
      setSession(session);
      await bot.sendMessage(chatId,
        `✅ Ismingiz saqlandi.\n\n📸 <b>Endi to'lov screenshotini yuboring:</b>`,
        { parse_mode: "HTML", reply_markup: cancelKeyboard() }
      );
      break;
    }

    case "donate_receipt": {
      let fileId: string | undefined;
      if (msg.photo) {
        fileId = msg.photo[msg.photo.length - 1].file_id;
      } else if (msg.document) {
        fileId = msg.document.file_id;
      }
      if (!fileId) {
        await bot.sendMessage(chatId, "Iltimos, screenshotni rasm yoki fayl sifatida yuboring:");
        return;
      }
      const donorName = String(session.data.donorName);
      const donorLink = msg.from?.username
        ? `@${msg.from.username}`
        : `<a href="tg://user?id=${userId}">${esc(msg.from?.first_name || "Foydalanuvchi")}</a>`;
      clearSession(userId);

      await sendMain(bot, chatId, userId,
        `🙏 <b>Rahmat!</b>\n\nDonate qabul qilindi. Siz botni rivojlantirishga hissa qo'shdingiz!`
      );

      try {
        await bot.sendPhoto(ADMIN_ID, fileId, {
          caption:
            `💰 <b>Yangi donate!</b>\n\n` +
            `👤 <b>Ismi:</b> ${esc(donorName)}\n` +
            `🔗 <b>Telegram:</b> ${donorLink}\n` +
            `🆔 <b>User ID:</b> <code>${userId}</code>`,
          parse_mode: "HTML",
        });
      } catch (e) {
        logger.error({ err: e }, "Failed to send donate receipt to admin");
      }
      break;
    }

    case "admin_add_channel": {
      if (!isAdmin(userId)) return;
      const username = text.startsWith("@") ? text.slice(1) : text;
      const channel: Channel = {
        id: uuidv4(),
        username,
        title: username,
        addedAt: Date.now(),
      };
      addChannel(channel);
      clearSession(userId);
      await sendMain(bot, chatId, userId, `✅ Kanal @${esc(username)} qo'shildi!`);
      break;
    }

    case "ub_api_id": {
      if (!isAdmin(userId)) return;
      const apiId = parseInt(text.trim(), 10);
      if (isNaN(apiId) || apiId <= 0) {
        await bot.sendMessage(chatId, "❌ Noto'g'ri API ID. Faqat raqam kiriting (masalan: 24368508):");
        return;
      }
      session.data.apiId = apiId;
      session.step = "ub_api_hash";
      setSession(session);
      await bot.sendMessage(chatId,
        `✅ API ID saqlandi.\n\n<b>2-qadam:</b> API Hash kiriting:\n(32 belgili satr)`,
        { parse_mode: "HTML", reply_markup: cancelKeyboard() }
      );
      break;
    }

    case "ub_api_hash": {
      if (!isAdmin(userId)) return;
      const apiHash = text.trim();
      if (apiHash.length < 16) {
        await bot.sendMessage(chatId, "❌ API Hash juda qisqa. Qaytadan kiriting:");
        return;
      }
      session.data.apiHash = apiHash;
      session.step = "ub_phone";
      setSession(session);
      await bot.sendMessage(chatId,
        `✅ API Hash saqlandi.\n\n<b>3-qadam:</b> Telefon raqamini kiriting:\n(Masalan: <code>+998901234567</code>)`,
        { parse_mode: "HTML", reply_markup: cancelKeyboard() }
      );
      break;
    }

    case "ub_phone": {
      if (!isAdmin(userId)) return;
      const phone = text.trim();
      if (!phone.match(/^\+?[0-9]{9,15}$/)) {
        await bot.sendMessage(chatId, "❌ Noto'g'ri format. Masalan: +998901234567");
        return;
      }
      const apiId = Number(session.data.apiId);
      const apiHash = String(session.data.apiHash);
      clearSession(userId);
      await bot.sendMessage(chatId,
        `✅ Ma'lumotlar qabul qilindi.\n\n` +
        `⏳ Telegram akkauntingizga kod yuborilmoqda...\n\n` +
        `Kod kelgandan keyin uni <b>aa</b> prefiksi bilan yuboring.\n` +
        `Masalan: <code>aa12345</code>`,
        { parse_mode: "HTML", reply_markup: cancelKeyboard() }
      );
      reconnectUserbot(userId, apiId, apiHash, phone).catch((err) => {
        logger.error({ err }, "Reconnect userbot failed");
      });
      break;
    }

    default:
      clearSession(userId);
      await sendMain(bot, chatId, userId, "Xatolik yuz berdi. Qaytadan urinib ko'ring.");
  }
}

async function showStats(bot: TelegramBot, chatId: number) {
  const jobs = getJobs();
  const pending = getPendingJobs();
  const channels = getChannels();

  const now = Date.now();
  const dayMs = 86_400_000;
  const todayStart = now - dayMs;
  const weekStart = now - 7 * dayMs;
  const monthStart = now - 30 * dayMs;

  const approved = jobs.filter((j) => j.approved);
  const fromChannels = approved.filter((j) => j.postedBy === 0);
  const fromUsers = approved.filter((j) => j.postedBy !== 0);
  const uniqueUsers = new Set(fromUsers.map((j) => j.postedBy)).size;

  const todayJobs = jobs.filter((j) => j.postedAt >= todayStart).length;
  const weekJobs = jobs.filter((j) => j.postedAt >= weekStart).length;
  const monthJobs = jobs.filter((j) => j.postedAt >= monthStart).length;

  const oldestJob = jobs.length > 0
    ? new Date(Math.min(...jobs.map((j) => j.postedAt))).toLocaleDateString("uz-UZ")
    : "—";

  const districtMap: Record<string, number> = {};
  for (const j of approved) {
    districtMap[j.district] = (districtMap[j.district] || 0) + 1;
  }
  const topDistricts = Object.entries(districtMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([d, n]) => `  • ${esc(d)}: ${n} ta`)
    .join("\n");

  const jobTypeMap: Record<string, number> = {};
  for (const j of approved) {
    jobTypeMap[j.jobType] = (jobTypeMap[j.jobType] || 0) + 1;
  }
  const topTypes = Object.entries(jobTypeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t, n]) => `  • ${esc(t)}: ${n} ta`)
    .join("\n");

  const text =
    `📊 <b>Bot statistikasi</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `📋 <b>E'lonlar:</b>\n` +
    `  • Jami tasdiqlangan: <b>${approved.length} ta</b>\n` +
    `  • Kanallardan: ${fromChannels.length} ta\n` +
    `  • Foydalanuvchilardan: ${fromUsers.length} ta\n` +
    `  • Tasdiq kutmoqda: ${pending.length} ta\n\n` +
    `⏱ <b>Yangi e'lonlar:</b>\n` +
    `  • Bugun: ${todayJobs} ta\n` +
    `  • Hafta ichida: ${weekJobs} ta\n` +
    `  • 30 kunda: ${monthJobs} ta\n\n` +
    `👥 <b>Foydalanuvchilar:</b>\n` +
    `  • E'lon bergan userlar: ${uniqueUsers} ta\n\n` +
    `📢 <b>Kanallar:</b> ${channels.length} ta\n` +
    `🤖 <b>Userbot:</b> ${isConnected() ? "✅ ulangan" : "❌ ulanmagan"}\n\n` +
    (topDistricts ? `📍 <b>Top tumanlar:</b>\n${topDistricts}\n\n` : "") +
    (topTypes ? `💼 <b>Top ish turlari:</b>\n${topTypes}\n\n` : "") +
    `📅 <b>Birinchi e'lon:</b> ${oldestJob}`;

  await bot.sendMessage(chatId, text, { parse_mode: "HTML" });
}

async function showMyJobs(bot: TelegramBot, chatId: number, userId: number) {
  const jobs = getUserJobs(userId);
  if (jobs.length === 0) {
    await bot.sendMessage(chatId,
      `Sizda hali e'lonlar yo'q.\n\n<i>E'lon berish uchun "📢 E'lon berish" tugmasini bosing.</i>`,
      { parse_mode: "HTML", reply_markup: mainKeyboard(userId) }
    );
    return;
  }
  await bot.sendMessage(chatId,
    `📋 <b>Sizning e'lonlaringiz (${jobs.length} ta):</b>\n\nKo'rish uchun tanlang:`,
    { parse_mode: "HTML", reply_markup: myJobsKeyboard(jobs) }
  );
}

async function showChannels(bot: TelegramBot, chatId: number) {
  const channels = getChannels();
  if (channels.length === 0) {
    await bot.sendMessage(chatId, "Hali kanallar qo'shilmagan.");
    return;
  }
  await bot.sendMessage(chatId,
    `📋 <b>Ulangan kanallar (${channels.length} ta):</b>\n\nO'chirish uchun 🗑️ tugmasini bosing:`,
    { parse_mode: "HTML", reply_markup: channelsKeyboard(channels) }
  );
}

async function showPending(bot: TelegramBot, chatId: number) {
  const pending = getPendingJobs();
  if (pending.length === 0) {
    await bot.sendMessage(chatId, "Tasdiq kutayotgan e'lonlar yo'q.");
    return;
  }
  for (const p of pending) {
    const text = `📬 <b>E'lon (ID: ${p.id.slice(0, 8)})</b>\n\n` + formatJob(p.job);
    try {
      await bot.sendPhoto(chatId, p.receiptFile, {
        caption: text,
        parse_mode: "HTML",
        reply_markup: inlineApprove(p.id),
      });
    } catch {
      await bot.sendMessage(chatId, text, {
        parse_mode: "HTML",
        reply_markup: inlineApprove(p.id),
      });
    }
  }
}
