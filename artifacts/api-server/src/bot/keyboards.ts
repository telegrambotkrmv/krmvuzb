import TelegramBot from "node-telegram-bot-api";

const ADMIN_ID = Number(process.env.ADMIN_ID);

export function mainKeyboard(userId: number): TelegramBot.ReplyKeyboardMarkup {
  const isAdmin = userId === ADMIN_ID;
  const buttons: TelegramBot.KeyboardButton[][] = [
    [{ text: "🔍 Ish qidirish" }, { text: "📢 E'lon berish" }],
    [{ text: "📋 Mening e'lonlarim" }],
    [{ text: "💳 Donate qilish" }, { text: "📣 Reklama uchun admin bilan bog'lanish" }],
  ];
  if (isAdmin) {
    buttons.push([{ text: "➕ Kanal qo'shish" }, { text: "📋 Kanallar ro'yxati" }]);
    buttons.push([{ text: "⏳ Tasdiqlash kutayotgan e'lonlar" }]);
    buttons.push([{ text: "🔄 Kanallarni yangilash" }, { text: "🤖 Userbot holati" }]);
    buttons.push([{ text: "📊 Statistika" }, { text: "📢 Hammaga xabar" }]);
  }
  return { keyboard: buttons, resize_keyboard: true };
}

export function cancelKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return {
    keyboard: [[{ text: "❌ Bekor qilish" }]],
    resize_keyboard: true,
  };
}

export function donateKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: "✅ Donate qildim" }],
      [{ text: "❌ Bekor qilish" }],
    ],
    resize_keyboard: true,
  };
}

export function districtKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  const districts = [
    "Yunusobod", "Chilonzor", "Mirzo Ulug'bek", "Shayxontohur",
    "Yakkasaroy", "Uchtepa", "Sergeli", "Olmazar",
    "Bektemir", "Yashnobod", "Mirobod", "Hamza",
  ];
  const rows: TelegramBot.KeyboardButton[][] = [];
  for (let i = 0; i < districts.length; i += 3) {
    rows.push(districts.slice(i, i + 3).map((d) => ({ text: d })));
  }
  rows.push([{ text: "❌ Bekor qilish" }]);
  return { keyboard: rows, resize_keyboard: true };
}

export function inlineApprove(jobId: string): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: "✅ Tasdiqlash", callback_data: `approve_${jobId}` },
      { text: "❌ Rad etish", callback_data: `reject_${jobId}` },
    ]],
  };
}

export function editDeleteKeyboard(jobId: string): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: "🗑️ O'chirish", callback_data: `delete_${jobId}` },
    ]],
  };
}

export function confirmDeleteKeyboard(jobId: string): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: "✅ Ha, o'chirish", callback_data: `confirm_del_${jobId}` },
      { text: "❌ Bekor qilish", callback_data: `cancel_del_${jobId}` },
    ]],
  };
}

export function myJobsKeyboard(
  jobs: { id: string; jobType: string }[]
): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: jobs.map((j) => [
      { text: `📌 ${j.jobType}`, callback_data: `myjob_${j.id}` },
    ]),
  };
}

export function channelsKeyboard(
  channels: { id: string; username: string }[]
): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: channels.map((c) => [
      { text: `📢 @${c.username}`, callback_data: `ch_view_${c.id}` },
      { text: "🗑️", callback_data: `ch_del_${c.id}` },
    ]),
  };
}

export function userbotStatusKeyboard(connected: boolean): TelegramBot.InlineKeyboardMarkup {
  if (connected) {
    return {
      inline_keyboard: [[
        { text: "🔄 Kanallarni yangilash", callback_data: "ub_refresh" },
        { text: "🔌 Qayta ulash", callback_data: "ub_reconnect" },
      ]],
    };
  }
  return {
    inline_keyboard: [[
      { text: "🔄 Userbot faollashtirish", callback_data: "ub_reconnect" },
    ]],
  };
}
