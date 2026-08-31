import { DifficultyLevel, LanguageOption, GeneratedQuizItem } from "../types";

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

  /**
   * Saves generated questions to quiz_bank and queues them for target channel
   */
  async saveAndQueueQuestions(
    targetChannelId: string,
    questions: Array<GeneratedQuizItem & { hash: string }>
  ): Promise<{ inserted: number; duplicates: number }> {
    let inserted = 0;
    let duplicates = 0;

    for (const q of questions) {
      try {
        // Insert into quiz_bank (ignore if duplicate hash exists)
        const bankStmt = await this.db
          .prepare(
            `INSERT INTO quiz_bank (question_hash, question_text, option_a, option_b, option_c, option_d, correct_option_index, explanation, topic, difficulty, language, source_reference)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(question_hash) DO NOTHING
             RETURNING id`
          )
          .bind(
            q.hash,
            q.question,
            q.options[0],
            q.options[1],
            q.options[2],
            q.options[3],
            q.correct_option_index,
            q.explanation,
            q.topic || "General",
            q.difficulty || "medium",
            "bangla",
            q.source_reference || null
          )
          .first<{ id: number }>();

        let questionId: number | undefined = bankStmt?.id;

        if (!questionId) {
          // Question already exists in master bank
          const existing = await this.db
            .prepare(`SELECT id FROM quiz_bank WHERE question_hash = ?`)
            .bind(q.hash)
            .first<{ id: number }>();
          questionId = existing?.id;
          duplicates++;
        } else {
          inserted++;
        }

        // Add to active dispatch queue if a question ID was resolved
        if (questionId) {
          await this.db
            .prepare(
              `INSERT INTO quiz_queue (channel_id, question_id, status)
               VALUES (?, ?, 'pending')`
            )
            .bind(targetChannelId, questionId)
            .run();
        }
      } catch (err) {
        console.error("Failed to insert question:", err);
      }
    }

    return { inserted, duplicates };
  }

  async getQueueStats(channelId?: string): Promise<{ pending: number; sent: number }> {
    const filter = channelId ? `WHERE channel_id = '${channelId}'` : "";
    const pending = await this.db
      .prepare(`SELECT COUNT(*) as count FROM quiz_queue WHERE status = 'pending' ${channelId ? `AND channel_id = ?` : ""}`)
      .bind(...(channelId ? [channelId] : []))
      .first<{ count: number }>();

    const sent = await this.db
      .prepare(`SELECT COUNT(*) as count FROM quiz_queue WHERE status = 'sent' ${channelId ? `AND channel_id = ?` : ""}`)
      .bind(...(channelId ? [channelId] : []))
      .first<{ count: number }>();

    return {
      pending: pending?.count || 0,
      sent: sent?.count || 0,
    };
  }

  async clearQueue(channelId?: string): Promise<void> {
    if (channelId) {
      await this.db.prepare(`DELETE FROM quiz_queue WHERE channel_id = ? AND status = 'pending'`).bind(channelId).run();
    } else {
      await this.db.prepare(`DELETE FROM quiz_queue WHERE status = 'pending'`).run();
    }
  }
                            }
