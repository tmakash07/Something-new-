import { Bot } from "grammy";
import { Env, MediaInput } from "../types";
import { DatabaseService } from "../database/queries";
import { AIService } from "../services/ai.service";
import { buildSettingsKeyboard } from "./keyboards/settings.keyboard";
import { createQuestionHash } from "../utils/hash";
import { downloadTelegramFileAsBase64 } from "../utils/telegram-file";

export function createBot(env: Env) {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
  const db = new DatabaseService(env.DB);
  const ai = new AIService(env.GEMINI_API_KEY);
  const adminIds = env.ADMIN_USER_IDS.split(",").map((id) => Number(id.trim()));

  // Security Middleware: Restrict access to Admins
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || !adminIds.includes(userId)) {
      if (ctx.chat?.type === "private") {
        await ctx.reply("⛔ Unauthorized access.");
      }
      return;
    }
    await next();
  });

  // Track channel when bot is added or receives messages in channels
  bot.on("channel_post", async (ctx) => {
    if (ctx.chat && ctx.chat.title) {
      await db.registerChannel(ctx.chat.id.toString(), ctx.chat.title);
    }
  });

  // Command: /start
  bot.command("start", async (ctx) => {
    await ctx.reply(
      `👋 **AI Quiz Generator Bot**\n\n` +
        `• ⚙️ /settings — Configure count, difficulty, and language\n` +
        `• 📊 /queue — View scheduled questions\n` +
        `• 🗑️ /clearqueue — Flush pending questions\n` +
        `• 📤 Send a **PDF**, **Photo**, or **Text message** to generate quizzes!`,
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

  // Command: /queue
  bot.command("queue", async (ctx) => {
    const stats = await db.getQueueStats();
    await ctx.reply(
      `📊 **Queue Status:**\n\n` +
        `⏳ Pending in queue: **${stats.pending}** questions\n` +
        `✅ Successfully published: **${stats.sent}** questions`,
      { parse_mode: "Markdown" }
    );
  });

  // Command: /clearqueue
  bot.command("clearqueue", async (ctx) => {
    await db.clearQueue();
    await ctx.reply("🗑️ Pending queue has been cleared.");
  });

  // Inline Settings Callbacks
  bot.callbackQuery("toggle_difficulty", async (ctx) => {
    const settings = await db.getAdminSettings(ctx.from.id);
    const difficulties = ["easy", "medium", "hard", "mixed"];
    const nextDiff = difficulties[(difficulties.indexOf(settings.difficulty) + 1) % difficulties.length];
    await db.updateAdminSettings(ctx.from.id, "difficulty", nextDiff);
    const updated = await db.getAdminSettings(ctx.from.id);
    await ctx.editMessageReplyMarkup({ reply_markup: buildSettingsKeyboard(updated) });
    await ctx.answerCallbackQuery({ text: `Difficulty: ${nextDiff.toUpperCase()}` });
  });

  bot.callbackQuery("toggle_language", async (ctx) => {
    const settings = await db.getAdminSettings(ctx.from.id);
    const languages = ["bangla", "english", "mixed"];
    const nextLang = languages[(languages.indexOf(settings.language) + 1) % languages.length];
    await db.updateAdminSettings(ctx.from.id, "language", nextLang);
    const updated = await db.getAdminSettings(ctx.from.id);
    await ctx.editMessageReplyMarkup({ reply_markup: buildSettingsKeyboard(updated) });
    await ctx.answerCallbackQuery({ text: `Language: ${nextLang}` });
  });

  bot.callbackQuery("toggle_count", async (ctx) => {
    const settings = await db.getAdminSettings(ctx.from.id);
    const counts = [5, 10, 20, 30, 50];
    const nextCount = counts[(counts.indexOf(settings.question_count) + 1) % counts.length];
    await db.updateAdminSettings(ctx.from.id, "question_count", nextCount);
    const updated = await db.getAdminSettings(ctx.from.id);
    await ctx.editMessageReplyMarkup({ reply_markup: buildSettingsKeyboard(updated) });
    await ctx.answerCallbackQuery({ text: `Count: ${nextCount}` });
  });

  bot.callbackQuery("toggle_explanation", async (ctx) => {
    const settings = await db.getAdminSettings(ctx.from.id);
    const nextVal = settings.explanation_enabled ? 0 : 1;
    await db.updateAdminSettings(ctx.from.id, "explanation_enabled", nextVal);
    const updated = await db.getAdminSettings(ctx.from.id);
    await ctx.editMessageReplyMarkup({ reply_markup: buildSettingsKeyboard(updated) });
    await ctx.answerCallbackQuery({ text: `Explanation: ${nextVal ? "ON" : "OFF"}` });
  });

  bot.callbackQuery("set_channel", async (ctx) => {
    const channels = await db.getChannels();
    if (channels.length === 0) {
      await ctx.answerCallbackQuery({ text: "No channels found! Add the bot as Admin to your channel first." });
      return;
    }
    // Auto-select first active channel or toggle
    const selected = channels[0];
    await db.updateAdminSettings(ctx.from.id, "target_channel_id", selected.channel_id);
    await ctx.answerCallbackQuery({ text: `Target set to: ${selected.title}` });
    await ctx.reply(`📢 Active channel linked: **${selected.title}** (\`${selected.channel_id}\`)`, { parse_mode: "Markdown" });
  });

  bot.callbackQuery("ready_upload", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("📥 Send your **PDF**, **Photo**, or **Topic text** to generate MCQs.");
  });

  // Handler: Document (PDF) Uploads
  bot.on("message:document", async (ctx) => {
    const doc = ctx.message.document;
    if (doc.mime_type !== "application/pdf") {
      await ctx.reply("⚠️ Please upload a valid PDF document.");
      return;
    }

    const statusMsg = await ctx.reply("⏳ Downloading PDF & processing with Gemini AI...");
    try {
      const file = await ctx.api.getFile(doc.file_id);
      if (!file.file_path) throw new Error("Could not retrieve file path from Telegram.");

      const base64Data = await downloadTelegramFileAsBase64(env.TELEGRAM_BOT_TOKEN, file.file_path);
      const mediaInputs: MediaInput[] = [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: base64Data,
          },
        },
      ];

      const settings = await db.getAdminSettings(ctx.from.id);
      const generated = await ai.generateQuiz(
        {
          count: settings.question_count,
          difficulty: settings.difficulty,
          language: settings.language,
          explanationEnabled: Boolean(settings.explanation_enabled),
          customPrompt: ctx.message.caption || undefined,
        },
        undefined,
        mediaInputs
      );

      // Hash and attach
      const hashedQuestions = await Promise.all(
        generated.map(async (q) => ({
          ...q,
          hash: await createQuestionHash(q.question),
        }))
      );

      const targetChannel = settings.target_channel_id || ctx.chat.id.toString();
      const result = await db.saveAndQueueQuestions(targetChannel, hashedQuestions);

      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `✅ **Quiz Generation Successful!**\n\n` +
          `• Total generated: **${generated.length}**\n` +
          `• Queued: **${result.inserted}**\n` +
          `• Deduplicated: **${result.duplicates}**\n\n` +
          `The bot will automatically post these to the channel based on your schedule.`,
        { parse_mode: "Markdown" }
      );
    } catch (err: any) {
      console.error(err);
      await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `❌ Error: ${err.message || "Failed to process PDF"}`);
    }
  });

  // Handler: Photo Uploads
  bot.on("message:photo", async (ctx) => {
    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1];

    const statusMsg = await ctx.reply("⏳ Analyzing image with Gemini AI...");
    try {
      const file = await ctx.api.getFile(largestPhoto.file_id);
      if (!file.file_path) throw new Error("Could not retrieve image path.");

      const base64Data = await downloadTelegramFileAsBase64(env.TELEGRAM_BOT_TOKEN, file.file_path);
      const mediaInputs: MediaInput[] = [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data,
          },
        },
      ];

      const settings = await db.getAdminSettings(ctx.from.id);
      const generated = await ai.generateQuiz(
        {
          count: settings.question_count,
          difficulty: settings.difficulty,
          language: settings.language,
          explanationEnabled: Boolean(settings.explanation_enabled),
          customPrompt: ctx.message.caption || undefined,
        },
        undefined,
        mediaInputs
      );

      const hashedQuestions = await Promise.all(
        generated.map(async (q) => ({
          ...q,
          hash: await createQuestionHash(q.question),
        }))
      );

      const targetChannel = settings.target_channel_id || ctx.chat.id.toString();
      const result = await db.saveAndQueueQuestions(targetChannel, hashedQuestions);

      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `✅ **Image Quizzes Created!**\n\n` +
          `• Generated: **${generated.length}**\n` +
          `• Queued: **${result.inserted}**\n` +
          `• Deduplicated: **${result.duplicates}**`,
        { parse_mode: "Markdown" }
      );
    } catch (err: any) {
      console.error(err);
      await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `❌ Error: ${err.message || "Failed to process image"}`);
    }
  });

  // Handler: Raw Text Prompts
  bot.on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;

    const statusMsg = await ctx.reply("⏳ Generating quizzes from topic prompt...");
    try {
      const settings = await db.getAdminSettings(ctx.from.id);
      const generated = await ai.generateQuiz(
        {
          count: settings.question_count,
          difficulty: settings.difficulty,
          language: settings.language,
          explanationEnabled: Boolean(settings.explanation_enabled),
        },
        ctx.message.text
      );

      const hashedQuestions = await Promise.all(
        generated.map(async (q) => ({
          ...q,
          hash: await createQuestionHash(q.question),
        }))
      );

      const targetChannel = settings.target_channel_id || ctx.chat.id.toString();
      const result = await db.saveAndQueueQuestions(targetChannel, hashedQuestions);

      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `✅ **MCQs Generated from Topic!**\n\n` +
          `• Generated: **${generated.length}**\n` +
          `• Queued: **${result.inserted}**\n` +
          `• Deduplicated: **${result.duplicates}**`,
        { parse_mode: "Markdown" }
      );
    } catch (err: any) {
      console.error(err);
      await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `❌ Error: ${err.message || "Failed to generate quiz"}`);
    }
  });

  return bot;
      }
    
