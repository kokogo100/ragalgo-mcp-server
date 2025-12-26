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
import { v4 as uuidv4 } from 'uuid';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

// ------------------------------------------------------------------------------------------------
// 🛠️ SMITHERY & DEPLOYMENT BEST PRACTICES FIX
// ------------------------------------------------------------------------------------------------

/**
 * HTTP POST Transport for single-request JSON-RPC (Stateless)
 * Robust version that handles notifications vs requests and prevents timeouts.
 */
class HttpPostTransport implements Transport {
    private res: express.Response;

    constructor(res: express.Response) {
        this.res = res;
    }

    start(): Promise<void> {
        return Promise.resolve();
    }

    async send(message: JSONRPCMessage): Promise<void> {
        // 🚨 CRITICAL FIX: Only send HTTP response for proper JSON-RPC Responses (which have ID).
        // Notifications (no ID) and Errors without ID should NOT trigger res.json() 
        // because that closes the single HTTP request, potentially before the actual result is ready.
        // OR if it's a notification, we silence it to avoid "headers already sent" errors.

        if ((message as any).id) {
            // This is a response or an error with an ID -> Send it back to HTTP client
            if (!this.res.headersSent) {
                this.res.json(message);
            }
        } else {
            // This is a notification (e.g. logs, progress) -> Log internally but don't reply yet
            // logging to stderr allows Smithery logs to pick it up without corrupting stdout
            console.error(`[Notification] ${(message as any).method}`, message);
        }
    }

    async close(): Promise<void> {
        return Promise.resolve();
    }

    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: (message: JSONRPCMessage) => void;

    handleMessage(message: JSONRPCMessage) {
        if (this.onmessage) {
            this.onmessage(message);
        }
    }
}

async function main() {
    try {
        console.error('Initializing Server...');
        // ... (Environment checks remain same) ...
        if (!process.env.RAGALGO_API_KEY) {
            console.error('⚠️  WARNING: RAGALGO_API_KEY is not set.');
        } else {
            console.error('✅ RAGALGO_API_KEY is detected.');
        }

        // Import tools
        const { getNews, getNewsScored, NewsParamsSchema, NewsScoredParamsSchema } = await import('./tools/news.js');
        const { getChartStock, getChartCoin, ChartStockParamsSchema, ChartCoinParamsSchema } = await import('./tools/chart.js');
        const { getFinancials, FinancialsParamsSchema } = await import('./tools/financials.js');
        const { getSnapshots, SnapshotsParamsSchema } = await import('./tools/snapshots.js');
        const { searchTags, SearchTagsParamsSchema, matchTags, MatchTagsParamsSchema } = await import('./tools/tags.js');
        const { getTrends, TrendsParamsSchema } = await import('./tools/trends.js');
        const { getResearch, ResearchParamsSchema } = await import('./tools/research.js');
        const { getAvailableRooms, GetAvailableRoomsSchema } = await import('./tools/rooms.js');

        const isStdio = process.argv.includes('--stdio');

        // Helper to create a fresh MCP Server instance
        const createServer = () => {
            const server = new Server(
                {
                    name: 'RagAlgo',
                    version: '1.0.5', // Bumped version for fix tracking
                },
                {
                    capabilities: {
                        tools: {},
                    },
                }
            );

            // Register Tools (Same as before)
            server.setRequestHandler(ListToolsRequestSchema, async () => {
                return {
                    tools: [
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
                        {
                            name: 'get_available_rooms',
                            description: `📡 [WEBSOCKET DISCOVERY] "The Yellow Pages" for RagAlgo Real-time Channels.
                            
Use this tool to find exactly which WebSocket rooms to subscribe to.
Input "Samsung" -> Returns room_id: "tag:STK005930" and "ticker:005930".

Usage:
1. User asks: "How do I subscribe to Samsung news?"
2. AI calls: get_available_rooms(search="Samsung")
3. Tool returns: [{ room_id: "tag:STK005930", description: "Samsung Electronics" }]
4. AI replies: "You can subscribe using room_id 'tag:STK005930'"`,
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    search: { type: 'string', description: 'Search term (e.g., Samsung, Semiconductor)' },
                                    type: { type: 'string', enum: ['tag', 'ticker', 'keyword'], description: 'Filter by type' },
                                    limit: { type: 'number', description: 'Limit results' }
                                }
                            }
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
                        case 'get_available_rooms': result = await getAvailableRooms(RoomsParamsSchema.parse(args)); break;
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

            // ------------------------------------------------------------------------------------------------
            // 🚀 SMITHERY FIX: Explicit Health & Server Card Endpoints
            // ------------------------------------------------------------------------------------------------
            app.get('/', (req, res) => res.status(200).send('RagAlgo MCP Server Running'));
            app.get('/health', (req, res) => res.status(200).send('OK'));

            app.get("/.well-known/mcp-server-card", (req, res) => {
                res.json({
                    mcp_id: "ragalgo-mcp-server",
                    name: "RagAlgo MCP Server",
                    description: "Your API key for the RagAlgo service",
                    capabilities: {
                        tools: true
                    }
                });
            });
            // ------------------------------------------------------------------------------------------------

            // SSE IMPLEMENTATION: Multi-Session Support (Map-based)
            const server = createServer();
            const transports = new Map<string, SSEServerTransport>();

            app.get('/sse', async (req, res) => {
                // FIX: Disable buffering for Railway/Nginx proxies to allow real-time SSE
                res.setHeader('X-Accel-Buffering', 'no');

                console.log('New SSE connection initiated');
                const sessionId = uuidv4();
                const transport = new SSEServerTransport(`/messages?sessionId=${sessionId}`, res);

                transports.set(sessionId, transport);
                console.error(`Transport created for session: ${sessionId}`); // Log to stderr for Smithery visibility

                try {
                    await server.connect(transport);
                    console.error(`Server connected to transport: ${sessionId}`);

                    // ------------------------------------------------------------------------------------------------
                    // 💓 KEEPALIVE FIX: Send explicit heartbeats for Railway/Glama
                    // MOVED AFTER connect() to avoid ERR_HTTP_HEADERS_SENT (SDK needs to write headers first)
                    // ------------------------------------------------------------------------------------------------
                    // Send immediate "ready" packet to flush buffers
                    res.write(':\n\n');

                    // Send heartbeat every 15 seconds to prevent load balancer timeouts
                    const keepAliveInterval = setInterval(() => {
                        if (res.writable) {
                            res.write(':\n\n');
                        }
                    }, 15000);
                    // ------------------------------------------------------------------------------------------------

                    // Cleanup on close (moved inside/near the interval creation scope for clarity, though logic remains same)
                    req.on('close', () => {
                        console.log(`SSE connection closed for session: ${sessionId}`);
                        clearInterval(keepAliveInterval); // Stop heartbeats
                        transports.delete(sessionId);
                    });

                } catch (error) {
                    console.error(`Error connecting server to transport ${sessionId}:`, error);
                }
            });

            app.post('/messages', async (req, res) => {
                const sessionId = req.query.sessionId as string;
                console.log(`Received message for session: ${sessionId}`);

                const transport = transports.get(sessionId);

                if (!transport) {
                    console.error(`Session not found: ${sessionId}`);
                    res.status(404).json({ error: 'Session not found or inactive' });
                    return;
                }

                try {
                    await transport.handlePostMessage(req, res);
                } catch (error) {
                    console.error(`Error handling post message for session ${sessionId}:`, error);
                    res.status(500).json({ error: 'Internal Server Error' });
                }
            });

            // ------------------------------------------------------------------------------------------------
            // 🛠️ SMITHERY FIX: Handle POST /mcp for stateless scanners
            // ------------------------------------------------------------------------------------------------
            app.post('/mcp', async (req, res) => {
                console.log('Received POST /mcp probe');
                const transport = new HttpPostTransport(res);
                const server = createServer(); // Create a fresh server instance for this stateless request
                await server.connect(transport);
                transport.handleMessage(req.body);
            });
            // ------------------------------------------------------------------------------------------------

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

