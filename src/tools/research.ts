/**
 * 컨설팅 보고서 관련 MCP Tools
 */

import { z } from 'zod';
import { callApi } from '../utils/api.js';

const API_BASE = 'https://ragalgo-research-production.up.railway.app'; // 혹시 몰라 남겨룸, 하지만 callApi 사용시 Supabase Edge Function 호출

// 보고서 조회 파라미터 스키마
export const ResearchParamsSchema = z.object({
    tag_code: z.string().describe('태그 코드 (필수). search_tags로 먼저 조회하세요.'),
    limit: z.number().min(1).max(10).default(5).describe('보고서 수 (기본 5, 최대 10)'),
    source: z.string().optional().describe('출처 필터 (선택): mckinsey, goldman, bcg, lg_research 등'),
});

export type ResearchParams = z.infer<typeof ResearchParamsSchema>;

// 보고서 조회
export async function getResearch(params: ResearchParams) {
    // Supabase Edge Function 호출
    const result = await callApi<{
        tag_code: string;
        tag_name: string | null;
        research_count: number;
        research: Array<{
            id: number;
            title: string;
            source: string;
            content_type: string;
            published_at: string | null;
            chunks: Array<{
                section: string;
                content: string;
            }>;
        }>;
    }>('research', params); // 'research' function 호출

    return result;
}
