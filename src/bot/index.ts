import { Bot, Context, webhookCallback } from "grammy";
import { Env } from "../types";
import { DatabaseService } from "../database/queries";
import { buildSettingsKeyboard } from "./keyboards/settings.keyboard";

export function createBot(env: Env) {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
  const db = new DatabaseService(env.DB);
  const adminIds = env.ADMIN_USER_IDS.split(",").map((id) => Number(id.trim()));

  // Middleware: Restrict access exclusively to configured Admin IDs
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || !adminIds.includes(userId)) {
      if (ctx.chat?.type === "private") {
        await ctx.reply("⛔ Unauthorized access. You do not have permission to control this bot.");
      }
      return;
    }
    await next();
  });

  // Command: /start
  bot.command("start", async (ctx) => {
    await ctx.reply(
      `👋 **Welcome to AI Quiz Generator Bot**\n\n` +
        `Use this bot to generate native Telegram quizzes from PDFs, images, and text prompts.\n\n` +
        `⚙️ Use /settings to configure quiz parameters.\n` +
        `📤 Send a PDF, Image, or Text directly to start generation.\n` +
        `📊 Use /queue to check scheduled items.`,
      { parse_mode: "Markdown" }
    );
  });

  // Command: /settings
  bot.command("settings", async (ctx) => {
    const settings = await db.getAdminSettings(ctx.from!.id);
    await ctx.reply("⚙️ **Current Quiz Generation Settings:**", {
      parse_mode: "Markdown",
      reply_markup: buildSettingsKeyboard(settings),
    });
  });

  // Callback Query Handlers for Menu Toggles
  bot.callbackQuery("toggle_difficulty", async (ctx) => {
    const settings = await db.getAdminSettings(ctx.from.id);
    const difficulties = ["easy", "medium", "hard", "mixed"];
    const nextDiff = difficulties[(difficulties.indexOf(settings.difficulty) + 1) % difficulties.length];
    await db.updateAdminSettings(ctx.from.id, "difficulty", nextDiff);
    
    const updated = await db.getAdminSettings(ctx.from.id);
    await ctx.editMessageReplyMarkup({ reply_markup: buildSettingsKeyboard(updated) });
    await ctx.answerCallbackQuery({ text: `Difficulty set to ${nextDiff.toUpperCase()}` });
  });

  bot.callbackQuery("toggle_language", async (ctx) => {
    const settings = await db.getAdminSettings(ctx.from.id);
    const languages = ["bangla", "english", "mixed"];
    const nextLang = languages[(languages.indexOf(settings.language) + 1) % languages.length];
    await db.updateAdminSettings(ctx.from.id, "language", nextLang);

    const updated = await db.getAdminSettings(ctx.from.id);
    await ctx.editMessageReplyMarkup({ reply_markup: buildSettingsKeyboard(updated) });
    await ctx.answerCallbackQuery({ text: `Language set to ${nextLang}` });
  });

  bot.callbackQuery("toggle_count", async (ctx) => {
    const settings = await db.getAdminSettings(ctx.from.id);
    const counts = [5, 10, 20, 30, 50];
    const nextCount = counts[(counts.indexOf(settings.question_count) + 1) % counts.length];
    await db.updateAdminSettings(ctx.from.id, "question_count", nextCount);

    const updated = await db.getAdminSettings(ctx.from.id);
    await ctx.editMessageReplyMarkup({ reply_markup: buildSettingsKeyboard(updated) });
    await ctx.answerCallbackQuery({ text: `Question count set to ${nextCount}` });
  });

  bot.callbackQuery("toggle_explanation", async (ctx) => {
    const settings = await db.getAdminSettings(ctx.from.id);
    const nextVal = settings.explanation_enabled ? 0 : 1;
    await db.updateAdminSettings(ctx.from.id, "explanation_enabled", nextVal);

    const updated = await db.getAdminSettings(ctx.from.id);
    await ctx.editMessageReplyMarkup({ reply_markup: buildSettingsKeyboard(updated) });
    await ctx.answerCallbackQuery({ text: `Explanations ${nextVal ? "Enabled" : "Disabled"}` });
  });

  bot.callbackQuery("ready_upload", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `📥 **Ready for content!**\n\nPlease send your **PDF document**, **photos**, or **text prompt** now.`,
      { parse_mode: "Markdown" }
    );
  });

  return bot;
}
