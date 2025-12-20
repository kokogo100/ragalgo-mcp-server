import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// 1. 에러 로그 강제 출력 (Logs unavailable 해결용)
process.on('uncaughtException', (err) => {
    console.error('SERVER CRASHED:', err);
});

const app = express();
app.use(express.json()); // POST 메시지 처리를 위해 필수

const server = new Server(
    { name: "ragalgo-mcp-server", version: "1.0.0" },
    { capabilities: { tools: {} } }
);

// 2. 도구 등록 (샘플 도구 하나 추가하여 스캔 성공 유도)
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "ping",
                description: "A simple ping tool to verify server health",
                inputSchema: { type: "object", properties: {} }
            }
        ]
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "ping") {
        return {
            content: [{ type: "text", text: "pong" }]
        };
    }
    throw new Error("Tool not found");
});

// 3. SSE 세션 관리
let transport: SSEServerTransport | null = null;

app.get("/sse", async (req, res) => {
    console.log("New SSE session started");
    transport = new SSEServerTransport("/messages", res);
    await server.connect(transport);
});

app.post("/messages", async (req, res) => {
    if (transport) {
        await transport.handlePostMessage(req, res);
    } else {
        res.status(400).json({ error: "No active SSE session" });
    }
});

// 4. Smithery가 찾는 핵심 엔드포인트 (반드시 필요)
app.get("/.well-known/mcp-server-card", (req, res) => {
    res.json({
        mcp_id: "ragalgo-mcp-server",
        name: "RagAlgo",
        capabilities: { tools: true }
    });
});

app.get("/health", (req, res) => res.send("ok"));

// 5. 포트 바인딩 (Smithery는 8080을 선호)
const PORT = 8080;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`MCP Server running on port ${PORT}`);
});
