#!/usr/bin/env node

// ------------------------------------------------------------------------------------------------
// CRASH GUARD: Register error handlers BEFORE any other imports to catch initialization errors
// ------------------------------------------------------------------------------------------------
process.on('uncaughtException', (err) => {
    console.error('FATAL CLOUD CRASH (Uncaught Exception):', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('FATAL CLOUD CRASH (Unhandled Rejection) at:', promise, 'reason:', reason);
    process.exit(1);
});

console.error('Process started. Registered crash guards.'); // Use stderr for visibility
// ------------------------------------------------------------------------------------------------

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';

// Start server logic
async function main() {
    try {
        console.error('Initializing Server...');

        // DYNAMIC IMPORTS: Load tools only after main starts
        // This isolates import errors to the try-catch block
        const { getNews, getNewsScored, NewsParamsSchema, NewsScoredParamsSchema } = await import('./tools/news.js');
        const { getChartStock, getChartCoin, ChartStockParamsSchema, ChartCoinParamsSchema } = await import('./tools/chart.js');
        const { getFinancials, FinancialsParamsSchema } = await import('./tools/financials.js');
        const { getSnapshots, SnapshotsParamsSchema } = await import('./tools/snapshots.js');
        const { searchTags, matchTags, TagsSearchParamsSchema, TagsMatchParamsSchema } = await import('./tools/tags.js');
        const { getTrends, TrendsParamsSchema } = await import('./tools/trends.js');
        const { getResearch, ResearchParamsSchema } = await import('./tools/research.js');

        const isStdio = process.argv.includes('--stdio');

        // Factory for Server with Tools
        const createServer = () => {
            const server = new Server(
                {
                    name: 'RagAlgo',
                    version: '1.0.4',
                },
                {
                    capabilities: {
                        tools: {},
                    },
                }
            );

            // Register Tool Listing
            server.setRequestHandler(ListToolsRequestSchema, async () => {
                return {
                    tools: [
                        {
                            name: 'search_tags',
                            description: `🔍 [TAG LOOKUP - USE FIRST] ALWAYS use this BEFORE other RagAlgo tools when user mentions any Korean stock, coin, or theme by NAME.
PRIMARY TOOL for converting names to tag_codes. Without correct tag_code, other tools will return inaccurate or empty results.

ALWAYS use when you see:
- Korean stock names: 삼성전자, SK하이닉스, 네이버, 카카오, LG에너지솔루션
- Crypto names: 비트코인, 이더리움, 리플, 솔라나
- Theme/sector names: 반도체, AI, 2차전지, 바이오

Examples: "삼성전자" → STK005930, "비트코인" → CRY_BTC, "반도체" → THM_반도체

CRITICAL: Call this first, then use the returned tag_code in other tools.`,
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    q: { type: 'string', description: 'Search query (e.g., 삼성, Samsung, 반도체, AI, Bitcoin)' },
                                    type: { type: 'string', enum: ['STOCK', 'SECTOR', 'THEME', 'CRYPTO'], description: 'Tag type filter (optional)' },
                                    limit: { type: 'number', description: 'Result count (default: 20)' },
                                },
                                required: ['q'],
                            },
                        },
                        {
                            name: 'get_snapshots',
                            description: `📊 [DAILY SUMMARY - MOST EFFICIENT] PRIMARY TOOL for Korean market overview. ALWAYS use this FIRST for general market questions.

This is the ONLY tool that returns news + chart + sentiment COMBINED in one call.
Prefer this over calling get_news + get_chart separately - much more efficient!

ALWAYS use when user asks:
- "오늘 시장 어때?" / "how's the market today?"
- "시장 요약해줘" / "market summary"
- "오늘 뉴스 좋은 거 뭐 있어?" / "what's hot today?"
- "전체적인 분위기 어때?" / "market sentiment"

[IMPORTANT] Snapshots are generated daily at 17:00 KST (market close).
If you request 'today' and get no results (because it's morning in KST), you MUST:
1. Fetch 'yesterday's snapshot for context.
2. Call 'get_news_scored' to get REAL-TIME news for the current day.

Returns per asset: news_count, avg_sentiment, bullish/bearish counts, chart_score, zone, price.

🔗 BEST PRACTICE - Combine with web_search:
1. Use get_snapshots FIRST for Korean market sentiment & chart data
2. Then use web_search for latest breaking news or global context
Example: get_snapshots → "시장 하락세" → web_search "한국 증시 하락 원인" → 종합 분석`,
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    tag_code: { type: 'string', description: 'Tag code for specific asset (e.g., STK005930, CRY_BTC). Leave empty for market-wide overview.' },
                                    date: { type: 'string', description: 'Date (YYYY-MM-DD). Default: today' },
                                    days: { type: 'number', description: 'Recent N days for time-series (default: 7)' },
                                    limit: { type: 'number', description: 'Result count' },
                                },
                            },
                        },
                        {
                            name: 'get_news_scored',
                            description: `📰 [KOREAN NEWS WITH SENTIMENT] PRIMARY news tool for Korean market. Returns news WITH AI sentiment scores (-10 to +10).

Use for Korean stock/crypto news with sentiment analysis.

[NOTE] This tool AUTOMATICALLY filters out 0-score (Neutral/Noise) news to provide clear signals.
If you need raw/neutral news, use 'get_news' instead.

Use when user asks:
- "삼성전자 뉴스" / "Samsung news"
- "호재 뉴스 보여줘" / "show me bullish news"  
- "비트코인 악재 있어?" / "any bearish news on Bitcoin?"
- "오늘 좋은 뉴스" / "today's positive news"

Filter by: tag, verdict (bullish/bearish/neutral), score range
Returns: title, summary, sentiment_score, verdict, tags

🔗 BEST PRACTICE - Combine with web_search:
- RagAlgo: Sentiment-analyzed Korean market news (structured data)
- web_search: Real-time breaking news, global context, additional sources
Example workflow:
1. get_news_scored(tag="삼성전자") → 감정 분석된 뉴스 목록
2. web_search("삼성전자 최신 뉴스") → 실시간 속보
3. Combine both for comprehensive analysis!

TIP: For market overview, use get_snapshots instead (more efficient).
TIP: Use search_tags first to get exact tag name.`,
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    tag: { type: 'string', description: 'Tag CODE (e.g., STK005930). Use search_tags first to get this code!' },
                                    source: { type: 'string', description: 'Source filter' },
                                    search: { type: 'string', description: 'Title search keyword' },
                                    min_score: { type: 'number', description: 'Min sentiment score (-10 to 10)' },
                                    max_score: { type: 'number', description: 'Max sentiment score (-10 to 10)' },
                                    verdict: { type: 'string', enum: ['bullish', 'bearish', 'neutral'], description: 'Sentiment verdict filter' },
                                    limit: { type: 'number', description: 'Result count (default: 20)' },
                                },
                            },
                        },
                        {
                            name: 'get_news',
                            description: `📰 [KOREAN NEWS - NO SCORES] Basic news without sentiment analysis. Use only when sentiment scores are not needed or for non-scored tier users.

Prefer get_news_scored over this for most use cases unless you want raw data including 0-score items.

Filter by: tag, source, date range
Returns: title, summary, url, tags, source`,
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    tag: { type: 'string', description: 'Tag filter (e.g., 삼성전자, 비트코인, 반도체)' },
                                    source: { type: 'string', description: 'Source filter (e.g., 한경, 매경)' },
                                    search: { type: 'string', description: 'Title search keyword' },
                                    from_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
                                    to_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
                                    limit: { type: 'number', description: 'Result count (default: 20, max: 100)' },
                                },
                            },
                        },
                        {
                            name: 'get_chart_stock',
                            description: `📈 [KOREAN STOCK CHARTS] PRIMARY tool for Korean stock technical analysis. Returns momentum scores and trend zones.

ALWAYS use for Korean stock chart/technical questions.

[IMPORTANT] You MUST use 'search_tags' first to get the correct ticker (e.g., STK005930).

Use when user asks:
- "차트 강한 종목" / "stocks with strong momentum"
- "상승 추세 종목" / "uptrending stocks"
- "삼성전자 차트 어때?" / "how's Samsung's chart?"
- "기술적 분석" / "technical analysis"

Filter by: zone (STRONG_UP/UP_ZONE/NEUTRAL/DOWN_ZONE/STRONG_DOWN), market (KOSPI/KOSDAQ)
Returns: ticker, name, zone, oscillator_state, 5-day scores (d0-d4), last_price

🔗 COMBINE with web_search for deeper analysis:
1. get_chart_stock → "삼성전자 DOWN_ZONE"
2. web_search "삼성전자 주가 하락 이유" → 하락 원인 파악
3. Provide comprehensive technical + fundamental analysis!

TIP: Use search_tags first to get ticker from stock name.`,
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    ticker: { type: 'string', description: 'Stock ticker (e.g., 005930 for Samsung)' },
                                    market: { type: 'string', enum: ['KOSPI', 'KOSDAQ'], description: 'Market type' },
                                    zone: { type: 'string', enum: ['STRONG_UP', 'UP_ZONE', 'NEUTRAL', 'DOWN_ZONE', 'STRONG_DOWN'], description: 'Chart zone filter - use this to find strong/weak stocks' },
                                    limit: { type: 'number', description: 'Result count' },
                                },
                            },
                        },
                        {
                            name: 'get_chart_coin',
                            description: `🪙 [CRYPTO CHARTS] PRIMARY tool for Korean crypto (Upbit) technical analysis. Returns momentum scores and trend zones.

ALWAYS use for Korean crypto chart questions.

[IMPORTANT] You MUST use 'search_tags' first to get the correct ticker (e.g., CRY_BTC).

Use when user asks:
- "비트코인 차트" / "Bitcoin chart"
- "상승 중인 코인" / "pumping coins"
- "코인 기술적 분석" / "crypto technical analysis"

Filter by: zone (STRONG_UP/UP_ZONE/NEUTRAL/DOWN_ZONE/STRONG_DOWN)
Returns: ticker, name, zone, oscillator_state, 10-candle scores (c0-c9, 12h intervals), last_price

🔗 COMBINE with web_search for context:
1. get_chart_coin → "비트코인 UP_ZONE"
2. web_search "비트코인 상승 이유" → 상승 배경 파악`,
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    ticker: { type: 'string', description: 'Coin ticker (e.g., KRW-BTC for Bitcoin)' },
                                    zone: { type: 'string', enum: ['STRONG_UP', 'UP_ZONE', 'NEUTRAL', 'DOWN_ZONE', 'STRONG_DOWN'], description: 'Chart zone filter' },
                                    limit: { type: 'number', description: 'Result count' },
                                },
                            },
                        },
                        {
                            name: 'get_research',
                            description: `📑 [RESEARCH] Get consulting firm reports (McKinsey, BCG, etc.)

Use for: "long-term trends", "sector outlook", "industry analysis"
Filter by: source, tag_code, market_outlook

Returns: AI summary in Korean, investment insights
Includes tag_codes for cross-referencing with news/charts.

⚠️ This tool returns FULL chunked text. Analyze it to answer user questions.`,
                            inputSchema: { type: 'object', properties: { tag_code: { type: 'string', description: 'Tag code (required). Use search_tags first.' }, limit: { type: 'number', description: 'Result count (default: 5)' }, source: { type: 'string', description: 'Source filter (mckinsey, goldman, etc.)' } }, required: ['tag_code'] },
                        },
                        {
                            name: 'get_financials',
                            description: `💰 [KOREAN STOCK FUNDAMENTALS] PRIMARY tool for Korean stock financial data. Returns quarterly financial statements.

ALWAYS use for Korean stock fundamental analysis.

Use when user asks:
- "삼성전자 재무제표" / "Samsung financials"
- "PER 낮은 종목" / "low PER stocks"
- "ROE 높은 기업" / "high ROE companies"
- "저평가 종목" / "undervalued stocks"

Returns: PER, PBR, ROE, ROA, revenue, operating_income, net_income, debt_ratio, dividend_yield

🔗 COMBINE with web_search:
1. get_financials → "PER 5.2, ROE 15%"
2. web_search "삼성전자 실적 전망" → 미래 실적 예측`,
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    ticker: { type: 'string', description: 'Stock ticker (e.g., 005930)' },
                                    period: { type: 'string', description: 'Quarter (e.g., 2024Q3)' },
                                    market: { type: 'string', enum: ['KOSPI', 'KOSDAQ'], description: 'Market type' },
                                    periods: { type: 'number', description: 'Recent N quarters (default: 4)' },
                                    limit: { type: 'number', description: 'Result count' },
                                },
                            },
                        },
                        {
                            name: 'get_trends',
                            description: `📉 [SENTIMENT TRENDS] Get historical sentiment trend for a specific asset over time.

Use when user asks:
- "삼성전자 지난주 분위기" / "Samsung sentiment last week"
- "비트코인 추세" / "Bitcoin trend"
- "최근 7일간 뉴스 동향" / "news trend over 7 days"

REQUIRES tag_code - use search_tags first!
Returns: daily news_count and avg_sentiment_score over N days

🔗 COMBINE with web_search:
1. get_trends → "지난주 감정 -2.5로 하락"
2. web_search "삼성전자 지난주 이슈" → 하락 원인 파악`,
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    tag_code: { type: 'string', description: 'Tag code (e.g., STK005930, CRY_BTC) - REQUIRED. Use search_tags to find this first!' },
                                    days: { type: 'number', description: 'Recent N days (default: 7, max: 30)' },
                                },
                                required: ['tag_code'],
                            },
                        },
                        {
                            name: 'match_tags',
                            description: `🏷️ [AUTO-TAG EXTRACTION] Extract stock/crypto/theme tags from any text. Useful for categorizing news or analyzing what topics a text mentions.

Use when:
- Analyzing what stocks/themes a news title mentions
- Auto-categorizing text content
- Finding related tags from a sentence

Input: any text (e.g., "삼성전자 HBM 대박 소식")
Returns: matched tags with confidence scores`,
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    text: { type: 'string', description: 'Text to analyze (e.g., "삼성전자 HBM 대박 소식")' },
                                    types: { type: 'array', items: { type: 'string' }, description: 'Tag type filter (optional)' },
                                    limit: { type: 'number', description: 'Result count (default: 10)' },
                                },
                                required: ['text'],
                            },
                        },
                    ],
                };
            });

            server.setRequestHandler(CallToolRequestSchema, async (request) => {
                const { name, arguments: args } = request.params;
                try {
                    let result: unknown;
                    switch (name) {
                        case 'get_news': result = await getNews(NewsParamsSchema.parse(args)); break;
                        case 'get_news_scored': result = await getNewsScored(NewsScoredParamsSchema.parse(args)); break;
                        case 'get_chart_stock': result = await getChartStock(ChartStockParamsSchema.parse(args)); break;
                        case 'get_chart_coin': result = await getChartCoin(ChartCoinParamsSchema.parse(args)); break;
                        case 'get_research': result = await getResearch(ResearchParamsSchema.parse(args)); break;
                        case 'get_financials': result = await getFinancials(FinancialsParamsSchema.parse(args)); break;
                        case 'get_snapshots': result = await getSnapshots(SnapshotsParamsSchema.parse(args)); break;
                        case 'search_tags': result = await searchTags(TagsSearchParamsSchema.parse(args)); break;
                        case 'match_tags': result = await matchTags(TagsMatchParamsSchema.parse(args)); break;
                        case 'get_trends': result = await getTrends(TrendsParamsSchema.parse(args)); break;
                        default: throw new Error(`Unknown tool: ${name}`);
                    }
                    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    return { content: [{ type: 'text', text: `Error: ${errorMessage}` }], isError: true };
                }
            });
            return server;
        };

        if (isStdio) {
            const server = createServer();
            const transport = new StdioServerTransport();
            await server.connect(transport);
            console.error('RagAlgo MCP Server started (Stdio Mode)');
        } else {
            console.error('Starting in HTTP/SSE Mode');
            const port = process.env.PORT || 8080;
            const app = express();

            app.use(cors());
            app.use(express.json());

            app.use((req, res, next) => {
                console.log(`[${req.method}] ${req.originalUrl}`);
                next();
            });

            app.get('/', (req, res) => res.status(200).send('RagAlgo MCP Server Running'));
            app.get('/health', (req, res) => res.status(200).json({ status: 'ok', version: '1.0.4' }));
            app.get('/.well-known/mcp-server-card', (req, res) => {
                res.json({ name: "RagAlgo MCP Server", description: "Korean Stock & Crypto Analysis", version: "1.0.4" });
            });

            // SINGLE Global Server Instance
            const server = createServer();
            let currentTransport: SSEServerTransport | null = null;

            app.get('/sse', async (req, res) => {
                console.log('New SSE connection initiated');
                const transport = new SSEServerTransport('/messages', res);
                currentTransport = transport;

                try {
                    await server.connect(transport);
                    console.log('Server connected to transport');
                } catch (error) {
                    // Ignore "Already connected" error - checking message or name would be ideal but logging is sufficient
                    // This happens when new connection comes while old one (e.g. scanner) is technically still linked
                    console.error('Re-connecting server (expected if previous session active):', error);
                }
            });

            app.post('/messages', async (req, res) => {
                if (currentTransport) {
                    await currentTransport.handlePostMessage(req, res);
                } else {
                    res.status(404).send('No active connection');
                }
            });

            app.listen(Number(port), '0.0.0.0', () => {
                console.error(`RagAlgo MCP Server listening on port ${port}`);
            });
        }

    } catch (error) {
        console.error('FATAL STARTUP ERROR:', error);
        process.exit(1);
    }
}

main();
