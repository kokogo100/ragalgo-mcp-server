/**
 * RagAlgo API 유틸리티
 * Supabase Edge Functions 호출
 */


// [CHANGED] Dynamic URL Support
// If SUPABASE_URL is injected (from Desktop .env), use it. Otherwise fallback to hardcoded (Public default).
const DEFAULT_URL = 'https://xunrsikkybgxkybjzrgz.supabase.co/functions/v1';
const SUPABASE_URL = (process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/functions/v1` : DEFAULT_URL).replace(/\/+$/, ''); // Remove trailing slash if double

// [DEBUG] Log active configuration
console.error(`[API Init] Target URL: ${SUPABASE_URL}`);
console.error(`[API Init] Env Override: ${!!process.env.SUPABASE_URL}`);

// [CHANGED] Get Keys from Environment (Injected by mcp_manager.py)
const getKeys = () => {
    const apiKey = process.env.RAGALGO_API_KEY;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    if (!apiKey) {
        throw new Error('RAGALGO_API_KEY environment variable is missing.');
    }
    if (!anonKey) {
        // Fallback for local testing if not injected, but log warning
        console.error('[API] Warning: SUPABASE_ANON_KEY not found in env. Calls may fail.');
    }
    // [FALLBACK] Hardcoded Anon Key for reliability
    const fallbackAnon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1bnJzaWtreWJneGt5Ymp6cmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NTExNTgsImV4cCI6MjA4MDAyNzE1OH0.SsXri828-Rf0gHlu4Bls-pewhfMNNII4mbiuLnc9ACs";
    return { apiKey, anonKey: anonKey || fallbackAnon };
};

// API 호출 기본 함수
export async function callApi<T>(
    endpoint: string,
    params?: Record<string, string | number | undefined>
): Promise<T> {
    const { apiKey, anonKey } = getKeys();

    // [DEBUG] Log token details to stderr
    // console.error(`[API] User Token Len: ${apiKey?.length}, Anon Key Len: ${anonKey?.length}`);

    // 쿼리 파라미터 생성
    // Use constructed SUPABASE_URL which already includes /functions/v1/ or similar base
    // But wait, the DEFAULT_URL includes /functions/v1
    // The previous code did: new URL(`${SUPABASE_URL}/${endpoint}`);
    // If process.env.SUPABASE_URL is just the base (e.g. https://...co), we need to append /functions/v1

    // Adjusted Logic above: 
    // If process.env.SUPABASE_URL is provided, we assume it is the PROJECT URL (not including /functions/v1).
    // So we append /functions/v1.

    // Ensure we don't duplicate slashes
    const baseUrl = SUPABASE_URL.endsWith('/functions/v1') ? SUPABASE_URL : `${SUPABASE_URL}/functions/v1`;

    // Actually, let's simplify.
    // The previous code had `const SUPABASE_URL = '.../functions/v1';`
    // And usage: `new URL(`${SUPABASE_URL}/${endpoint}`);` which results in `.../functions/v1/snapshots`

    // My replacement above: 
    // const SUPABASE_URL = ... (process.env.SUPABASE_URL ? .../functions/v1 :)

    // So usage here:
    const url = new URL(`${SUPABASE_URL}/${endpoint}`);
    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) {
                url.searchParams.append(key, String(value));
            }
        });
    }

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${anonKey.trim()}`, // [FIX] Use Anon Key (JWT) for Supabase Gateway
        'apikey': anonKey.trim(),
        'x-api-key': apiKey.trim(), // [FIX] Use User API Key for x-api-key header
        'Content-Type': 'application/json',
    };

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: headers,
    });

    if (!response.ok) {
        const error = await response.text();
        const debugInfo = `[DEBUG] keys_present=${!!anonKey}, URL: ${url.toString()}`;

        if (response.status === 429) {
            throw new Error(`[RATE LIMIT EXCEEDED] API 요청 제한에 도달했습니다. 잠시 후 다시 시도하거나 요청량을 줄여주세요. (Plan Quota Exceeded) | ${debugInfo}`);
        }
        throw new Error(`API 호출 실패: ${response.status} - ${error} | ${debugInfo}`);
    }

    return response.json();
}

// POST API 호출
export async function callApiPost<T>(
    endpoint: string,
    body: Record<string, unknown>
): Promise<T> {
    const { apiKey, anonKey } = getKeys();
    const url = `${SUPABASE_URL}/${endpoint}`;

    // [DEBUG]
    console.error(`[API POST] User Token Len: ${apiKey?.length}, Anon Key Len: ${anonKey?.length}`);

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${anonKey.trim()}`, // [FIX] Use Anon Key (JWT)
        'apikey': anonKey.trim(),
        'x-api-key': anonKey.trim(), // [RESTORED]
        'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.text();
        if (response.status === 429) {
            throw new Error(`[RATE LIMIT EXCEEDED] API 요청 제한에 도달했습니다. 잠시 후 다시 시도하거나 요청량을 줄여주세요. (Plan Quota Exceeded)`);
        }
        throw new Error(`API 호출 실패: ${response.status} - ${error}`);
    }

    return response.json();
}
