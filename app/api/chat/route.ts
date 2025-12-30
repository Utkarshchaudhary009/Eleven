import { google } from "@ai-sdk/google";
import { z } from "zod";
import { streamText, UIMessage, convertToModelMessages } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { cerebras } from "@ai-sdk/cerebras";
import { groq } from "@ai-sdk/groq";
import { xai } from "@ai-sdk/xai";
import { huggingface } from "@ai-sdk/huggingface";
import { perplexity } from "@ai-sdk/perplexity";
import {
  ToolLoopAgent,
  createAgentUIStreamResponse,
  tool,
  InferAgentUIMessage,
} from "ai";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export const maxDuration = 30;
const Openrouter = openrouter.chat("anthropic/claude-3.5-sonnet");
export async function POST(req: Request) {
  const {
    messages,
    model,
    webSearch,
  }: {
    messages: [];
    model: string;
    webSearch: boolean;
  } = await req.json();
  let Agentmodel;
  if (model.includes("qwen")) {
    Agentmodel = cerebras.chat("qwen-3-235b-a22b-thinking-2507");
  } else if (model.includes("llama")) {
    Agentmodel = groq("meta-llama/llama-guard-4-12b");
  } else if (model.includes("grok")) {
    Agentmodel = xai("grok-3-mini-fast");
  } else if (model.includes("oss")) {
    Agentmodel = huggingface("openai/gpt-oss-20b:cheapest");
  } else {
    Agentmodel = google("gemini-2.5-flash-lite-preview-09-2025");
  }
  if (webSearch) {
    const searchModel=["g","g","g","p"];
    if (searchModel[Math.floor(Math.random() * searchModel.length)] === "g") {
    const result = streamText({
      model: google("gemini-2.5-flash-lite-preview-09-2025"),
      messages: await convertToModelMessages(messages),
      tools: {
        google_search: google.tools.googleSearch({}),
        url_context: google.tools.urlContext({}),
      },
      system:
        "You are a helpful assistant that can answer questions and help with tasks",
    });
    // send sources and reasoning back to the client
    return result.toUIMessageStreamResponse({
      sendSources: true,
      sendReasoning: true,
    });}
    else {
    Agentmodel = perplexity("sonar");}
  }
  if (model.includes("free")) {
    const result = streamText({
      model: openrouter.chat(model), // or gemini-1.5-flash
      messages: await convertToModelMessages(messages),
      system:
        "You are a helpful assistant that can answer questions and help with tasks",
    });
    // send sources and reasoning back to the client
    return result.toUIMessageStreamResponse({
      sendSources: true,
      sendReasoning: true,
    });
  } else {
    const technicalWriterAgent = new ToolLoopAgent({
      model: Agentmodel,
      instructions: `You are a technical documentation writer.

  Writing style:
  - Use clear, simple language
  - Avoid jargon unless necessary
  - Structure information with headers and bullet points
  - Include code examples where relevant
  - Write in second person ("you" instead of "the user")

  Always format responses in Markdown.`,
      tools: {
        runCode: tool({
          description: "Execute Python code",
          inputSchema: z.object({
            code: z.string(),
          }),
          execute: async ({ code }) => {
            // Execute code and return result
            return { output: "Code executed successfully" };
          },
        }),
      },
    });

    return createAgentUIStreamResponse({
      agent: technicalWriterAgent as any,
      uiMessages: messages,
      sendSources: true,
      sendReasoning: true,
    });
  }
}
