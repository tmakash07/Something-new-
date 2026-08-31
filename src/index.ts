import { webhookCallback } from "grammy";
import { Env } from "./types";
import { createBot } from "./bot";
import { DatabaseService } from "./database/queries";
import { SchedulerService } from "./services/scheduler.service";

export default {
  /**
   * HTTP Webhook Entrypoint (Receives Telegram events)
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Verify webhook secret token from headers
    const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (env.WEBHOOK_SECRET && secretHeader !== env.WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 403 });
    }

    if (request.method === "POST") {
      const bot = createBot(env);
      return webhookCallback(bot, "cloudflare-mod")(request);
    }

    return new Response("AI Telegram Quiz Bot is operational.", { status: 200 });
  },

  /**
   * Cloudflare Cron Trigger Entrypoint (Fires every minute to post queued polls)
   */
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const bot = createBot(env);
    const db = new DatabaseService(env.DB);
    const scheduler = new SchedulerService(bot, db);

    ctx.waitUntil(scheduler.dispatchNextQuiz());
  },
};
  
