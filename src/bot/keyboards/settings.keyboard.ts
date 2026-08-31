import { InlineKeyboard } from "grammy";
import { AdminSettingsRow } from "../../database/queries";

export function buildSettingsKeyboard(settings: AdminSettingsRow): InlineKeyboard {
  const diffIcons: Record<string, string> = { easy: "🟢 Easy", medium: "🟡 Medium", hard: "🔴 Hard", mixed: "🔀 Mixed" };
  const langIcons: Record<string, string> = { bangla: "🇧🇩 বাংলা", english: "🇬🇧 English", mixed: "🌐 Mixed" };

  return new InlineKeyboard()
    .text(`Difficulty: ${diffIcons[settings.difficulty]}`, "toggle_difficulty")
    .row()
    .text(`Language: ${langIcons[settings.language]}`, "toggle_language")
    .row()
    .text(`Count: 🔢 ${settings.question_count}`, "toggle_count")
    .text(`Explanation: ${settings.explanation_enabled ? "✅ ON" : "❌ OFF"}`, "toggle_explanation")
    .row()
    .text("📢 Set Target Channel", "set_channel")
    .row()
    .text("🚀 Generate Quiz (Ready for Upload)", "ready_upload");
    }
