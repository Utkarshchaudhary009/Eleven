import { tool } from "ai";
import { z } from "zod";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://humble-potato-wp4xpvq64w93547-3000.app.github.dev/';

/**
 * Agentic tools mapping to the dual-backend Search API
 */
export const tools = {
  webSearch: tool({
    description: "Search the web for current information, news, or specific facts.",
    parameters: z.object({
      query: z.string().describe("The search query to look up."),
      time: z.enum(["d", "w", "m", "y"]).optional().describe("Time limit: d (day), w (week), m (month), y (year)"),
    }),
    execute: async ({ query, time }) => {
      try {
        const url = new URL('/api/search', baseUrl);
        url.searchParams.set('q', query);
        if (time) url.searchParams.set('time', time);

        const response = await fetch(url.toString());
        const result = await response.json();
        return result.success ? result.data : { error: result.error };
      } catch (error: any) {
        return { error: error.message };
      }
    },
  }),

  convertCurrency: tool({
    description: "Convert currency amounts between different denominations.",
    parameters: z.object({
      from: z.string().describe("Source currency code (e.g., USD)"),
      to: z.string().describe("Target currency code (e.g., EUR)"),
      amount: z.number().optional().describe("Amount to convert"),
    }),
    execute: async ({ from, to, amount = 1 }) => {
      try {
        const url = new URL('/api/search', baseUrl);
        url.searchParams.set('type', 'currency');
        url.searchParams.set('from', from);
        url.searchParams.set('to', to);
        url.searchParams.set('amount', amount.toString());

        const response = await fetch(url.toString());
        const result = await response.json();
        return result.success ? result.data : { error: result.error };
      } catch (error: any) {
        return { error: error.message };
      }
    },
  })
};