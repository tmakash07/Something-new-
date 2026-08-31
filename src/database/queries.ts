import { DifficultyLevel, LanguageOption } from "../types";

export interface AdminSettingsRow {
  admin_id: number;
  target_channel_id: string | null;
  difficulty: DifficultyLevel;
  language: LanguageOption;
  question_count: number;
  explanation_enabled: number;
  custom_prompt: string | null;
}

export class DatabaseService {
  constructor(private db: D1Database) {}

  async getAdminSettings(adminId: number): Promise<AdminSettingsRow> {
    const query = `SELECT * FROM admin_settings WHERE admin_id = ?`;
    const result = await this.db.prepare(query).bind(adminId).first<AdminSettingsRow>();

    if (result) return result;

    // Create default settings if not exists
    const defaultSettings: AdminSettingsRow = {
      admin_id: adminId,
      target_channel_id: null,
      difficulty: "medium",
      language: "bangla",
      question_count: 10,
      explanation_enabled: 1,
      custom_prompt: null,
    };

    await this.db
      .prepare(
        `INSERT INTO admin_settings (admin_id, target_channel_id, difficulty, language, question_count, explanation_enabled)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        adminId,
        defaultSettings.target_channel_id,
        defaultSettings.difficulty,
        defaultSettings.language,
        defaultSettings.question_count,
        defaultSettings.explanation_enabled
      )
      .run();

    return defaultSettings;
  }

  async updateAdminSettings(adminId: number, field: string, value: any): Promise<void> {
    const query = `UPDATE admin_settings SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE admin_id = ?`;
    await this.db.prepare(query).bind(value, adminId).run();
  }

  async registerChannel(channelId: string, title: string): Promise<void> {
    const query = `
      INSERT INTO channels (channel_id, title)
      VALUES (?, ?)
      ON CONFLICT(channel_id) DO UPDATE SET title = excluded.title, is_active = 1
    `;
    await this.db.prepare(query).bind(channelId, title).run();
  }

  async getChannels(): Promise<Array<{ channel_id: string; title: string }>> {
    const result = await this.db
      .prepare(`SELECT channel_id, title FROM channels WHERE is_active = 1`)
      .all<{ channel_id: string; title: string }>();
    return result.results || [];
  }
      }
  
