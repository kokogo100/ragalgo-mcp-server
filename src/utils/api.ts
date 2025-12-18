/**
 * RagAlgo API 유틸리티
 * Supabase Edge Functions 호출
 */

const SUPABASE_URL = 'https://xunrsikkybgxkybjzrgz.supabase.co/functions/v1';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1bnJzaWtreWJneGt5Ymp6cmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NTExNTgsImV4cCI6MjA4MDAyNzE1OH0.SsXri828-Rf0gHlu4Bls-pewhfMNNII4mbiuLnc9ACs';

// 환경변수에서 API 키 가져오기
const getApiKey = (): string => {
    const key = process.env.RAGALGO_API_KEY;
    if (!key) {
        throw new Error('RAGALGO_API_KEY 환경변수가 설정되지 않았습니다.');
    }
    return key;
};

// API 호출 기본 함수
export async function callApi<T>(
    endpoint: string,
    params?: Record<string, string | number | undefined>
): Promise<T> {
    const apiKey = getApiKey();

    // 쿼리 파라미터 생성
    const url = new URL(\`\${SUPABASE_URL}/\${endpoint}\`);
    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) {
                url.searchParams.append(key, String(value));
            }
        });
    }

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            'Authorization': \`Bearer \${SUPABASE_ANON_KEY}\`,
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(\`API 호출 실패: \${response.status} - \${error}\`);
    }

    return response.json();
}

// POST API 호출
export async function callApiPost<T>(
    endpoint: string,
    body: Record<string, unknown>
): Promise<T> {
    const apiKey = getApiKey();
    const url = \`\${SUPABASE_URL}/\${endpoint}\`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': \`Bearer \${SUPABASE_ANON_KEY}\`,
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(\`API 호출 실패: \${response.status} - \${error}\`);
    }

    return response.json();
}
