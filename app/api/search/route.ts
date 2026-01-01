import { NextResponse } from 'next/server';
import { DDGS } from "@phukon/duckduckgo-search";
// If the package exports the type, you can import it. 
// Otherwise, we define it based on the library's documentation requirements.
type TimeLimit = 'd' | 'w' | 'm' | 'y';

import { 
  search as fallbackSearch, 
  currency, 
  dictionaryDefinition, 
  SafeSearchType 
} from 'duck-duck-scrape';

/**
 * Handles search with @phukon/duckduckgo-search as primary and duck-duck-scrape as fallback.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'search';
  const query = searchParams.get('q');
  const safe = searchParams.get('safe') !== 'false';
  
  // Extract and cast time parameter to satisfy the DDGS type definition
  const time = (searchParams.get('time') || 'm') as TimeLimit;

  try {
    if (type === 'currency') {
      const result = await currency(
        searchParams.get('from') || 'USD', 
        searchParams.get('to') || 'EUR', 
        parseFloat(searchParams.get('amount') || '1')
      );
      return NextResponse.json({ success: true, data: result });
    }

    if (type === 'define') {
      const word = searchParams.get('word');
      if (!word) throw new Error("Word required");
      const result = await dictionaryDefinition(word);
      return NextResponse.json({ success: true, data: result });
    }

    if (!query) throw new Error("Search query 'q' is required");

    try {
      // Primary attempt
      const ddgs = new DDGS();
      const primaryResults = await ddgs.text({
        keywords: query,
        maxResults: 20,
        timelimit: time, // Now correctly typed
      });

      if (primaryResults?.length > 0) {
        return NextResponse.json({
          success: true,
          source: 'primary',
          data: primaryResults.map((r: any) => ({
            title: r.title,
            url: r.href,
            description: r.body,
          })),
        });
      }
      throw new Error("No primary results");
    } catch (err) {
      // Fallback attempt (Note: duck-duck-scrape has limited time support in standard text search)
      const fallbackResults = await fallbackSearch(query, {
        safeSearch: safe ? SafeSearchType.STRICT : SafeSearchType.OFF,
      });

      return NextResponse.json({
        success: true,
        source: 'fallback',
        data: fallbackResults.results.map(r => ({
          title: r.title,
          url: r.url,
          description: r.description,
        })),
      });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}