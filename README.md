# RagAlgo: Dynamic RAG Engine for AI Reliability

> **Global Beta**: Currently specialized in **Korean Finance (Stocks & Crypto)**, but built on a universal "Tag & Score" protocol applicable to any domain.

RagAlgo is not just a data API. It is a **"State-of-Truth" Provider** designed to prevent LLM hallucinations when dealing with **complex static knowledge** and **highly volatile dynamic data**.

### Why RagAlgo?
Traditional RAG (SQL/Vector DB) often fails to capture the "current context" of fast-changing reality. RagAlgo solves this by converting data into **Mathematical Scores** and **Standardized Tags**.

### Core Philosophy
1.  **Sanitized Data:** We filter out noise so AI only ingests high-quality signals.
2.  **Mathematical Scoring:** We translate complex movements into simple scores (e.g., `Chart Score: 9.5`), giving AI a clear ground truth to reason upon.
3.  **Universal Protocol:** Our "Tag & Score" architecture is designed to **systematize and standardize any data domain**—including Legal, Medical, and Tech—into a format that AI can flawlessly understand and judge.


### Flexible Integration: Scored vs. Non-Scored
We respect your freedom to build. Choose the mode that fits your pipeline:

| Mode | Target User | Description |
|------|-------------|-------------|
| **Scored API** (AI-Ready) | Builders & Startups | RagAlgo's math engines sanitize and score everything. Zero hallucinations. |
| **Non-Scored API** (Raw Mode) | Data Scientists & Engineers | Pure, sanitized data feeds for your custom pipelines. Perfect for fine-tuning, **n8n** automation, **LangChain** agents, or **Flowise** workflows. |

---

# RagAlgo MCP Server (KOR)

금융 뉴스 및 데이터 API를 MCP(Model Context Protocol)로 제공하는 서버입니다.

## 설치

```bash
cd mcp-server
npm install
npm run build
```

## 환경변수 설정

```bash
# Windows (PowerShell)
$env:RAGALGO_API_KEY="ragalgo_scored_test_a3ed9bd570436d46"

# Windows (CMD)
set RAGALGO_API_KEY=ragalgo_scored_test_a3ed9bd570436d46

# Mac/Linux
export RAGALGO_API_KEY="ragalgo_scored_test_a3ed9bd570436d46"
```

## Claude Desktop 설정

`%APPDATA%\Claude\claude_desktop_config.json` 파일에 추가:

```json
{
  "mcpServers": {
    "ragalgo": {
      "command": "node",
      "args": ["C:\\coding\\RagAlgo\\mcp-server\\dist\\index.js"],
      "env": {
        "RAGALGO_API_KEY": "ragalgo_scored_test_a3ed9bd570436d46"
      }
    }
  }
}
```

## 제공 도구 (9개)

| 도구 | 설명 |
|------|------|
| `get_news` | 금융 뉴스 조회 (점수 제외) |
| `get_news_scored` | 금융 뉴스 조회 (점수 포함) |
| `get_chart_stock` | 주식 차트 점수 조회 |
| `get_chart_coin` | 코인 차트 점수 조회 |
| `get_financials` | 재무제표 조회 |
| `get_snapshots` | 일별 스냅샷 조회 |
| `search_tags` | 태그 검색 |
| `match_tags` | 텍스트→태그 매칭 |
| `get_trends` | 태그별 트렌드 조회 |

## 사용 예시

### Claude Desktop에서

```
"삼성전자 최근 뉴스 5개 보여줘"
→ get_news_scored(tag="삼성전자", limit=5)

"반도체 관련 호재 뉴스만 찾아줘"
→ get_news_scored(tag="반도체", verdict="bullish")

"005930 재무제표 보여줘"
→ get_financials(ticker="005930")

"비트코인 차트 분석"
→ get_chart_coin(ticker="KRW-BTC")
```

## API 키 종류

| Tier | API Key | 접근 가능 도구 |
|------|---------|---------------|
| nonscored | `ragalgo_nonscored_test_...` | get_news, get_financials, get_chart_*, search_tags, match_tags, get_trends |
| scored | `ragalgo_scored_test_...` | 위 전부 + get_news_scored, get_snapshots |

## 개발

```bash
# 개발 모드 실행
npm run dev

# 빌드
npm run build

# 프로덕션 실행
npm start
```
