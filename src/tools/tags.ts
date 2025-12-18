/**
 * 태그 관련 MCP Tools
 */

import { z } from 'zod';
import { callApi, callApiPost } from '../utils/api.js';

// 태그 검색 파라미터 스키마
export const TagsSearchParamsSchema = z.object({
    q: z.string().describe('검색어 (예: 삼성, 반도체)'),
    type: z.enum(['STOCK', 'SECTOR', 'THEME', 'CRYPTO']).optional().describe('태그 타입'),
    limit: z.number().min(1).max(50).default(20).describe('결과 수'),
});

// 태그 매칭 파라미터 스키마
export const TagsMatchParamsSchema = z.object({
    text: z.string().describe('매칭할 텍스트 (예: 삼성전자 HBM 대박)'),
    types: z.array(z.enum(['STOCK', 'SECTOR', 'THEME', 'CRYPTO'])).optional().describe('태그 타입 필터'),
    limit: z.number().min(1).max(20).default(10).describe('결과 수'),
});

export type TagsSearchParams = z.infer<typeof TagsSearchParamsSchema>;
export type TagsMatchParams = z.infer<typeof TagsMatchParamsSchema>;

// 태그 검색
export async function searchTags(params: TagsSearchParams) {
    const result = await callApi<{
        success: boolean;
        data: Array<{
            tag_code: string;
            tag_type: string;
            name: string;
            name_en?: string;
            match_type: string;
            usage_count: number;
        }>;
        meta: { query: string; count: number };
    }>('tags/search', params);

    return result;
}

// 태그 매칭 (텍스트 → 태그)
export async function matchTags(params: TagsMatchParams) {
    const result = await callApiPost<{
        success: boolean;
        data: {
            matches: Array<{
                tag_code: string;
                tag_type: string;
                name: string;
                match_type: string;
            }>;
            keywords_extracted: string[];
            keywords_matched: string[];
        };
        meta: { input_length: number; keywords_count: number };
    }>('tags-match', params);

    return result;
}
