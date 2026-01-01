import { google } from "@ai-sdk/google";
import { streamText, convertToModelMessages, UIMessage,stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { cerebras } from "@ai-sdk/cerebras";
import { groq } from "@ai-sdk/groq";
import { xai } from "@ai-sdk/xai";
import { huggingface } from "@ai-sdk/huggingface";
import { perplexity } from "@ai-sdk/perplexity";
import { PromptTemplates } from "@/lib/PromptTemplates";
import { tools } from "./tool";

export const maxDuration = 30;

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

/**
 * Resolves the appropriate AI model instance.
 */
function getModel(modelName: string, hasAttachment: boolean) {
  if (hasAttachment) return google("gemini-2.5-flash-lite-preview-09-2025");
  
  const name = modelName.toLowerCase();
  if (name.includes("qwen")) return cerebras("qwen-3-32b");
  if (name.includes("llama")) return groq("llama-3.1-8b-instant");
  if (name.includes("grok")) return xai("grok-3-mini-fast");
  if (name.includes("oss")) return huggingface("openai/gpt-oss-20b:cheapest");
  if (name.includes("free")) return openrouter.chat(modelName);
  
  return google("gemini-2.5-flash-lite-preview-09-2025");
}

export async function POST(req: Request) {
  try {
    const { messages, model, webSearch, hasAttachment, system_prompt } = await req.json() as {
      messages: UIMessage[];
      model: string;
      webSearch: boolean;
      hasAttachment: boolean;
      system_prompt: string;
    };

    // Use selected prompt or fallback to a default
    // Safer lookup using optional chaining
const systemPrompt = PromptTemplates[system_prompt]?.system_prompt || 
                     PromptTemplates["casual"]?.system_prompt || 
                     "You are a helpful assistant.";
    const modelInstance = getModel(model, hasAttachment);

    // --- CASE 1: Web Search Flow ---
    if (webSearch) {
      const searchPool = ["google", "perplexity"];
      const selectedSearch = searchPool[Math.floor(Math.random() * searchPool.length)];

      if (selectedSearch === "google") {
        return streamText({
          model: google("gemini-2.5-flash-lite-preview-09-2025"),
          messages: await convertToModelMessages(messages),
          tools: {
            google_search: google.tools.googleSearch({}),
            url_context: google.tools.urlContext({}),
          },
          stopWhen: stepCountIs(20),
          system: systemPrompt,
        }).toUIMessageStreamResponse({ sendSources: true, sendReasoning: true });
      }

      return streamText({
        model: perplexity("sonar"),
        messages: await convertToModelMessages(messages),
        system: systemPrompt,
      }).toUIMessageStreamResponse({ sendSources: true, sendReasoning: true });
    }

    // --- CASE 2: Agentic Stream (Standard Flow) ---
    // Uses maxSteps to allow multi-turn tool calling without ToolLoopAgent
    const result = streamText({
      model: modelInstance,
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools: tools,
      stopWhen: stepCountIs(20), // Enables agentic behavior
    });

    return result.toUIMessageStreamResponse({
      sendSources: true,
      sendReasoning: true,
    });

  } catch (error) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}