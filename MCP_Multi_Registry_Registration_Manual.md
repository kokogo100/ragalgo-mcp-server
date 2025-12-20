# RagAlgo MCP 서버 멀티 플랫폼 등록 가이드 🚀

본 문서는 `RagAlgo-MCP-Public` 서버를 전 세계 주요 MCP 디렉토리에 등록하여 **서비스 신뢰도(Social Proof)**를 확보하고, 레몬 스퀴지 심사 통과를 돕기 위한 **공식 등록 가이드**입니다.

## 📋 사전 준비 사항

방금 `smithery.yaml` 설정 파일을 생성했습니다. 등록 전에 이 파일을 GitHub에 **반드시 푸시**해야 합니다.

```bash
cd RagAlgo-MCP-Public
git add smithery.yaml
git commit -m "chore: add smithery.yaml for registry support"
git push
```

---

## 1. Smithery.ai 등록 (가장 중요)
Smithery는 현재 가장 인기 있는 MCP 레지스트리 중 하나입니다. `smithery.yaml`을 추가했으므로 원활하게 등록될 것입니다.

1.  [Smithery.ai](https://smithery.ai/publisher) 접속
2.  **"Publish an MCP Server"** 클릭
3.  **"Continue with GitHub"** 선택 후 로그인
4.  GitHub 권한 요청 시 승인
5.  목록에서 **`RagAlgo-MCP-Public`** 리포지토리 선택
6.  **"Publish"** 버튼 클릭
    *   *자동으로 `smithery.yaml`과 `Dockerfile`을 인식하여 등록됩니다.*

---

## 2. Glama.ai 등록
Glama는 사용자 친화적인 인터페이스를 제공하는 주요 디렉토리입니다.

1.  [Glama.ai/mcp/servers](https://glama.ai/mcp/servers) 접속
2.  우측 상단 **"Add Server"** (또는 로그인 후 진행)
3.  GitHub 계정으로 로그인 (필요시)
4.  **"Import from GitHub"** 선택
5.  **`RagAlgo-MCP-Public`** 리포지토리 선택
6.  설정 화면이 나오면 기본값(Dockerfile 감지됨)을 확인하고 **Deploy/Submit** 클릭

---

## 3. mcp.so 등록 (GitHub Issue 방식)
mcp.so는 개발자들이 많이 찾는 리스트입니다. GitHub Issue를 통해 등록을 요청합니다.

1.  [mcp.so GitHub Issues](https://github.com/mcp-so/mcp-directory/issues) (링크가 다를 수 있으니 웹사이트 하단 'Submit' 확인)
    *   *Tip: 보통 웹사이트 [mcp.so](https://mcp.so)에 "Submit Server" 버튼이 있습니다.*
2.  Submit 양식에 아래 내용을 입력하세요.

**입력 양식 (복사해서 사용하세요):**
*   **Name:** `RagAlgo`
*   **Description:** Dynamic RAG Engine for AI Reliability. Prevents hallucinations in volatile domains (starting with Korean Finance). Provides mathematically scored context & sanitized data.
*   **Repository URL:** `https://github.com/kokogo100/RagAlgo-MCP-Public`
*   **Tags:** `finance`, `rag`, `korea`, `stock`, `crypto`, `analysis`, `search`

---

## 4. 공식 MCP 리스트 (GitHub PR)
Anthropic 및 커뮤니티가 관리하는 공식 리스트입니다.

1.  [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) 리포지토리 방문
2.  **Fork** 버튼을 눌러 내 계정으로 가져오기
3.  `src/data/servers.json` (또는 유사한 목록 파일)을 찾아 편집
4.  아래 내용을 목록에 추가 (알파벳 순서 준수 권장):
    ```json
    {
      "name": "RagAlgo",
      "description": "Dynamic RAG Engine for AI Reliability (Korean Finance & Crypto).",
      "url": "https://github.com/kokogo100/RagAlgo-MCP-Public",
      "tags": ["finance", "korea", "rag"]
    }
    ```
5.  **Pull Request** 생성 (Title: `Add RagAlgo server`)

---

## 💡 레몬 스퀴지 심사 대응 팁

위 사이트(특히 Smithery, Glama)에 등록이 완료되면, 해당 **등록 페이지 URL**을 복사해두세요.
레몬 스퀴지에서 추가 보완 요청이 오거나, 심사가 늦어질 경우 답장에 활용할 수 있습니다.

> "We are now officially listed on major AI platforms like Smithery.ai and Glama.ai as a verified data provider. (Link: ...)"
