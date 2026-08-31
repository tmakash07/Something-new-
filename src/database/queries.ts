  /**
   * Retrieves pending questions ready to be published across active channels
   */
  async getNextPendingQuiz(): Promise<{
    queue_id: number;
    channel_id: string;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option_index: number;
    explanation: string | null;
    topic: string | null;
    difficulty: string | null;
    header_branding: string | null;
    footer_branding: string | null;
  } | null> {
    const query = `
      SELECT 
        q.id AS queue_id,
        q.channel_id,
        b.question_text,
        b.option_a,
        b.option_b,
        b.option_c,
        b.option_d,
        b.correct_option_index,
        b.explanation,
        b.topic,
        b.difficulty,
        c.header_branding,
        c.footer_branding
      FROM quiz_queue q
      JOIN quiz_bank b ON q.question_id = b.id
      JOIN channels c ON q.channel_id = c.channel_id
      WHERE q.status = 'pending' AND c.is_active = 1
      ORDER BY q.id ASC
      LIMIT 1
    `;
    return await this.db.prepare(query).first();
  }

  /**
   * Marks a queue item as sent or failed
   */
  async updateQueueStatus(queueId: number, status: 'sent' | 'failed'): Promise<void> {
    const query = `
      UPDATE quiz_queue 
      SET status = ?, sent_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;
    await this.db.prepare(query).bind(status, queueId).run();
  }
