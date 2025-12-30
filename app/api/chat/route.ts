import { google } from "@ai-sdk/google";
import { z } from "zod";
import { streamText, UIMessage, convertToModelMessages } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
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
const Google_Provider = google("gemini-2.5-flash-lite-preview-09-2025");
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

  if (model.includes("free")) {
    const result = streamText({
      model: openrouter.chat(model) || Google_Provider, // or gemini-1.5-flash
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
      model: Google_Provider,
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
    });
  }
}
