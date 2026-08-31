import { Bot } from "grammy";
import { DatabaseService } from "../database/queries";

export class SchedulerService {
  constructor(private bot: Bot, private db: DatabaseService) {}

  /**
   * Dispatches the next available quiz to its target Telegram channel as a native quiz poll
   */
  async dispatchNextQuiz(): Promise<boolean> {
    const quiz = await this.db.getNextPendingQuiz();
    if (!quiz) {
      return false; // Queue is empty
    }

    const options = [
      quiz.option_a,
      quiz.option_b,
      quiz.option_c,
      quiz.option_d,
    ];

    // Build question text with topic & branding header if space permits (Telegram limit: 300 chars)
    let formattedQuestion = quiz.question_text;
    if (quiz.topic && quiz.topic !== "General") {
      const prefix = `[${quiz.topic}] `;
      if (prefix.length + formattedQuestion.length <= 300) {
        formattedQuestion = `${prefix}${formattedQuestion}`;
      }
    }

    // Truncate explanation safely to 200 chars for native Telegram quiz tooltips
    const explanationText = quiz.explanation ? quiz.explanation.slice(0, 200) : undefined;

    try {
      // Send as native Telegram Quiz Poll
      await this.bot.api.sendPoll(quiz.channel_id, formattedQuestion, options, {
        type: "quiz",
        correct_option_id: quiz.correct_option_index,
        is_anonymous: true,
        explanation: explanationText,
      });

      // Mark status as sent
      await this.db.updateQueueStatus(quiz.queue_id, "sent");
      return true;
    } catch (err: any) {
      console.error(`Failed to post quiz #${quiz.queue_id} to channel ${quiz.channel_id}:`, err);
      await this.db.updateQueueStatus(quiz.queue_id, "failed");
      return false;
    }
  }
}
