# RagAlgo: Dynamic RAG Engine for AI Reliability

> **AI 신뢰성을 위한 다이내믹 RAG 엔진**

RagAlgo는 변동성이 큰 한국 금융(주식/코인) 데이터를 **'태그(Tag)'**와 **'점수(Score)'**로 표준화하여 제공하는 **AI 전용 MCP 서버**입니다.
여러분의 AI 에이전트가 인터넷을 헤매지 않고, 가장 효율적으로 시장의 "진실(State-of-Truth)"을 파악할 수 있도록 돕습니다.

- **핵심 기능:** KOSPI/KOSDAQ 및 업비트(Upbit) 기반의 실시간 차트 점수, 뉴스 감정 분석
- **무료 테스트:** 지금 바로 설치하여 **1,000회 무료 호출**로 충분히 테스트해보세요.
- **상세 문서:** 웹소켓 연동 및 비즈니스 플랜 등 자세한 내용은 [공식 웹사이트(ragalgo.com)](https://www.ragalgo.com)에서 확인하실 수 있습니다.

---

## 🚀 설치 및 실행

### 1. 직접 실행 (npx)

```bash
# 별도 설치 없이 바로 실행 (API Key 필요)
npx -y @ragalgo/server
```

### 2. Claude Desktop 설정

`%APPDATA%\Claude\claude_desktop_config.json` (Windows) 또는 `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) 파일에 추가하세요.

```json
{
  "mcpServers": {
    "ragalgo": {
      "command": "npx",
      "args": ["-y", "@ragalgo/server", "--stdio"],
      "env": {
        "RAGALGO_API_KEY": "비즈니스_또는_테스트_키_입력"
      }
    }
  }
}
```

> **Tip:** 테스트용 API Key는 [RagAlgo 대시보드](https://www.ragalgo.com/dashboard)에서 즉시 발급 가능합니다.

---



## 🛠️ 제공 도구 (Tools)

| 도구 | 설명 |
|------|------|
| `get_news_scored` | **[핵심]** 감정 점수(Sentiment Score)가 포함된 금융 뉴스 조회 |
| `get_chart_stock` | **[핵심]** 한국 주식(KOSPI/KOSDAQ) 기술적 분석 점수 조회 |
| `get_chart_coin` | **[핵심]** 한국 가상화폐(Upbit) 기술적 분석 점수 조회 |
| `get_snapshots` | 시장 전체 요약 스냅샷 (뉴스 + 차트 + 트렌드) |
| `get_financials` | 기업 재무제표 (분기/연간 실적) |
| `search_tags` | 텍스트(종목명)를 RagAlgo 고유 태그로 변환 |

---

## 📡 Real-time WebSocket (Business Only)

실시간 주가/코인 점수 데이터를 웹소켓으로 수신할 수 있습니다.

- **대상:** Business Plan 사용자 (월 30개 연결 포함)
- **주소:** `wss://ragalgo-relay-server-1-production.up.railway.app`
- **구현 방법:** `socket.io-client` 라이브러리 사용 (자세한 코드는 [공식 문서](https://www.ragalgo.com/docs) 참조)

---

## 💬 Community & Support

- **Website:** [ragalgo.com](https://www.ragalgo.com)
- **Email:** support@ragalgo.com
