export type DifficultyLevel = "easy" | "medium" | "hard" | "mixed";
export type LanguageOption = "bangla" | "english" | "mixed";

export interface GeneratedQuizItem {
  question: string;
  options: string[]; // exactly 4 options
  correct_option_index: number; // 0, 1, 2, or 3
  explanation: string;
  topic?: string;
  difficulty?: DifficultyLevel;
  source_reference?: string;
}

export interface QuizGenerationConfig {
  count: number;
  difficulty: DifficultyLevel;
  language: LanguageOption;
  explanationEnabled: boolean;
  topic?: string;
  customPrompt?: string;
}

export interface MediaInput {
  inlineData: {
    data: string; // Base64 encoded string
    mimeType: string; // e.g., 'application/pdf', 'image/jpeg', 'image/png'
  };
}

export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  GEMINI_API_KEY: string;
  ADMIN_USER_IDS: string;
  WEBHOOK_SECRET: string;
  }
