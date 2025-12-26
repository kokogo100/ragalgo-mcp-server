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
/**
 * HTTP POST Transport for JSON-RPC (Stateless)
 * Robust version that handles Batch Requests, Buffering, and Shims.
 */
class HttpPostTransport implements Transport {
    private res: express.Response;
    private ignoredIds: Set<string | number> = new Set();
    private responseBuffer: JSONRPCMessage[] = [];
    private isBatch: boolean;

    constructor(res: express.Response, isBatch: boolean = false) {
        this.res = res;
        this.isBatch = isBatch;
    }

    ignoreId(id: string | number) {
        this.ignoredIds.add(id);
    }

    start(): Promise<void> {
        return Promise.resolve();
    }

    async send(message: JSONRPCMessage): Promise<void> {
        // Filter out ignored messages (internal shims)
        if ((message as any).id && this.ignoredIds.has((message as any).id)) {
            return;
        }

        // Buffer the response
        this.responseBuffer.push(message);
    }

    // Explicit method to flush responses to HTTP
    async flush(): Promise<void> {
        if (this.res.headersSent) return;

        // If no responses, send 200 OK with empty array (or object) to allow client parsing
        // Smithery seems to error on 204 No Content ("Unexpected content type: null")
        if (this.responseBuffer.length === 0) {
            console.log('Use HttpPostTransport: Buffer empty, sending []');
            this.res.status(200).json([]);
            return;
        }

        // Send Batch or Single response
        if (this.isBatch) {
            this.res.json(this.responseBuffer);
        } else {
            // Strict JSON-RPC: Single Request -> Single Response.
            this.res.json(this.responseBuffer[0]);
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
                    version: '1.0.6', // Bumped version
                },
                {
                    capabilities: {
                        tools: {},
                    },
                }
            );

            // Register Tools (Same as before)
            // Register Tools
            server.setRequestHandler(ListToolsRequestSchema, async () => {
                return {
                    tools: [
                        { name: 'get_news', description: '📰 [KOREAN NEWS - NO SCORES] Basic news without sentiment analysis.', inputSchema: NewsParamsSchema },
                        { name: 'get_news_scored', description: '📰 [KOREAN NEWS WITH SENTIMENT] PRIMARY news tool for Korean market.', inputSchema: NewsScoredParamsSchema },
                        { name: 'get_chart_stock', description: '📈 [KOREAN STOCK CHARTS] PRIMARY tool for Korean stock technical analysis.', inputSchema: ChartStockParamsSchema },
                        { name: 'get_chart_coin', description: '🪙 [CRYPTO CHARTS] PRIMARY tool for Korean crypto technical analysis.', inputSchema: ChartCoinParamsSchema },
                        { name: 'get_financials', description: '💰 [KOREAN STOCK FUNDAMENTALS] PRIMARY tool for Korean stock financial data.', inputSchema: FinancialsParamsSchema },
                        { name: 'get_snapshots', description: '📊 [DAILY SUMMARY] PRIMARY TOOL for Korean market overview.', inputSchema: SnapshotsParamsSchema },
                        { name: 'search_tags', description: '🔍 [TAG LOOKUP] ALWAYS use this FIRST to find tag_code.', inputSchema: SearchTagsParamsSchema },
                        { name: 'match_tags', description: '🏷️ [AUTO-TAG EXTRACTION] Extract stock/crypto tags from text.', inputSchema: MatchTagsParamsSchema },
                        { name: 'get_trends', description: '📉 [SENTIMENT TRENDS] Get historical sentiment trend.', inputSchema: TrendsParamsSchema },
                        { name: 'get_research', description: '📑 [RESEARCH] Get consulting firm reports.', inputSchema: ResearchParamsSchema },
                        { name: 'get_available_rooms', description: '📺 [REALTIME] Get active socket.io rooms.', inputSchema: GetAvailableRoomsSchema },
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
                        case 'search_tags': result = await searchTags(SearchTagsParamsSchema.parse(args)); break;
                        case 'match_tags': result = await matchTags(MatchTagsParamsSchema.parse(args)); break;
                        case 'get_trends': result = await getTrends(TrendsParamsSchema.parse(args)); break;
                        case 'get_available_rooms': result = await getAvailableRooms(GetAvailableRoomsSchema.parse(args)); break;
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
                console.log(`[${req.method}] ${req.originalUrl} `);
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
                const transport = new SSEServerTransport(`/ messages ? sessionId = ${sessionId} `, res);

                transports.set(sessionId, transport);
                console.error(`Transport created for session: ${sessionId} `); // Log to stderr for Smithery visibility

                try {
                    await server.connect(transport);
                    console.error(`Server connected to transport: ${sessionId} `);

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
                        console.log(`SSE connection closed for session: ${sessionId} `);
                        clearInterval(keepAliveInterval); // Stop heartbeats
                        transports.delete(sessionId);
                    });

                } catch (error) {
                    console.error(`Error connecting server to transport ${sessionId}: `, error);
                }
            });

            app.post('/messages', async (req, res) => {
                const sessionId = req.query.sessionId as string;
                console.log(`Received message for session: ${sessionId} `);

                const transport = transports.get(sessionId);

                if (!transport) {
                    console.error(`Session not found: ${sessionId} `);
                    res.status(404).json({ error: 'Session not found or inactive' });
                    return;
                }

                try {
                    await transport.handlePostMessage(req, res);
                } catch (error) {
                    console.error(`Error handling post message for session ${sessionId}: `, error);
                    res.status(500).json({ error: 'Internal Server Error' });
                }
            });

            // ------------------------------------------------------------------------------------------------
            // 🛠️ SMITHERY FIX: Handle POST /mcp for stateless scanners
            // ------------------------------------------------------------------------------------------------
            app.post('/mcp', async (req, res) => {
                // 1. TIMEOUT SAFEGUARD: Prevent hanging requests
                const timeout = setTimeout(() => {
                    if (!res.headersSent) res.status(504).send('Gateway Timeout: MCP Server processing took too long');
                }, 10000);

                try {
                    console.log('Received POST /mcp probe. Body:', JSON.stringify(req.body));
                    const isBatch = Array.isArray(req.body);
                    const messages = isBatch ? (req.body as JSONRPCMessage[]) : [req.body as JSONRPCMessage];

                    // 2. CHECK IF INITIALIZATION IS NEEDED
                    // If any message in the batch is 'initialize', we let the client handle it.
                    // If NO message is 'initialize', we must shim it.
                    const hasInit = messages.some(m => (m as any).method === 'initialize');

                    const transport = new HttpPostTransport(res, isBatch);
                    const server = createServer();
                    await server.connect(transport);

                    // 3. INJECT SHIM IF NEEDED
                    if (!hasInit) {
                        console.log('[Stateless Shim] Injecting auto-initialization...');
                        const shimId = '__auto_init__';
                        transport.ignoreId(shimId);

                        // Inject 'initialize'
                        await transport.handleMessage({
                            jsonrpc: '2.0',
                            id: shimId,
                            method: 'initialize',
                            params: {
                                protocolVersion: '2024-11-05',
                                capabilities: {},
                                clientInfo: { name: 'stateless-shim', version: '1.0.0' }
                            }
                        } as any);

                        // Inject 'notifications/initialized'
                        await transport.handleMessage({
                            jsonrpc: '2.0',
                            method: 'notifications/initialized'
                        } as any);
                    }

                    // 4. PROCESS ACTUAL MESSAGES
                    for (const msg of messages) {
                        await transport.handleMessage(msg);
                    }

                    // 5. FLUSH RESPONSES
                    await transport.flush();

                } catch (error) {
                    console.error('Error in POST /mcp:', error);
                    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error', details: String(error) });
                } finally {
                    clearTimeout(timeout);
                }
            });
            // ------------------------------------------------------------------------------------------------

            app.listen(Number(port), '0.0.0.0', () => {
                console.error(`RagAlgo MCP Server listening on port ${port} `);
            });
        }

    } catch (error) {
        console.error('FATAL STARTUP ERROR:', error);
        process.exit(1);
    }
}

main();

