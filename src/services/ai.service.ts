import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GeneratedQuizItem, QuizGenerationConfig, MediaInput } from "../types";

// Enforce strict JSON output matching Telegram Quiz specifications
const quizResponseSchema: Schema = {
  type: Type.ARRAY,
  description: "A list of multiple choice quiz questions generated strictly based on provided materials.",
  items: {
    type: Type.OBJECT,
    properties: {
      question: {
        type: Type.STRING,
        description: "The question text. Must be concise (maximum 300 characters).",
      },
      options: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
          description: "Answer option (maximum 100 characters each).",
        },
        description: "Exactly 4 options.",
      },
      correct_option_index: {
        type: Type.INTEGER,
        description: "Zero-based index of the correct answer (0, 1, 2, or 3).",
      },
      explanation: {
        type: Type.STRING,
        description: "Clear explanation of the correct answer. Keep under 200 characters for Telegram native tooltips.",
      },
      topic: {
        type: Type.STRING,
        description: "Topic or chapter name extracted from the content.",
      },
      difficulty: {
        type: Type.STRING,
        description: "Difficulty: easy, medium, or hard.",
      },
      source_reference: {
        type: Type.STRING,
        description: "Optional page or chapter reference from source.",
      },
    },
    required: ["question", "options", "correct_option_index", "explanation"],
  },
};

export class AIService {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Generates MCQs from text, PDF, or images using Gemini 1.5 Flash
   */
  async generateQuiz(
    config: QuizGenerationConfig,
    textContext?: string,
    mediaInputs: MediaInput[] = []
  ): Promise<GeneratedQuizItem[]> {
    const systemInstruction = `
You are an expert exam setter specializing in competitive and university admission exams.
Your task is to analyze the provided study materials (PDFs, images, or text) and generate high-quality Multiple Choice Questions (MCQs).

Strict Rules:
1. Base all questions strictly on facts found in the provided context. Avoid hallucinations.
2. Formulate exactly 4 plausible options for each question.
3. Mark the single correct answer index correctly (0 for 1st option, 1 for 2nd, 2 for 3rd, 3 for 4th).
4. Language Requirement: ${
      config.language === "bangla"
        ? "Generate everything in authentic Bangla (বাংলা)."
        : config.language === "english"
        ? "Generate everything in English."
        : "Match the language of the source text."
    }
5. Difficulty: ${config.difficulty.toUpperCase()}.
6. Question Count: Generate exactly ${config.count} distinct questions.
7. Explanations: ${
      config.explanationEnabled
        ? "Provide a clear, factual explanation under 200 characters."
        : "Provide a brief one-line answer rationale."
    }
8. Keep question length $\le 300$ characters and each option $\le 100$ characters to strictly adhere to Telegram Quiz constraints.
${config.customPrompt ? `Additional custom instruction: ${config.customPrompt}` : ""}
`;

    const contents: any[] = [];

    // Add media inputs (PDFs or Images)
    for (const media of mediaInputs) {
      contents.push({
        inlineData: {
          mimeType: media.inlineData.mimeType,
          data: media.inlineData.data,
        },
      });
    }

    // Add prompt & text context
    const promptText = `Please generate ${config.count} MCQs based on the attached materials. ${
      textContext ? `\n\nText Context:\n${textContext}` : ""
    }`;
    contents.push({ text: promptText });

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: quizResponseSchema,
          temperature: 0.2, // Low temperature for factual accuracy
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Empty response received from Gemini API.");
      }

      const parsedQuestions: GeneratedQuizItem[] = JSON.parse(responseText);

      // Sanitize and validate output
      return this.sanitizeQuestions(parsedQuestions);
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      throw new Error(`Failed to generate quiz: ${error.message || error}`);
    }
  }

  /**
   * Enforces field limits and structural validity for Telegram native polls
   */
  private sanitizeQuestions(questions: GeneratedQuizItem[]): GeneratedQuizItem[] {
    return questions
      .filter((q) => q.question && Array.isArray(q.options) && q.options.length === 4)
      .map((q) => ({
        question: q.question.trim().slice(0, 300),
        options: q.options.map((opt) => opt.trim().slice(0, 100)),
        correct_option_index: Math.min(Math.max(q.correct_option_index, 0), 3),
        explanation: (q.explanation || "").trim().slice(0, 200),
        topic: q.topic ? q.topic.trim().slice(0, 50) : "General",
        difficulty: q.difficulty || "medium",
        source_reference: q.source_reference ? q.source_reference.trim().slice(0, 100) : undefined,
      }));
  }
      }
        
