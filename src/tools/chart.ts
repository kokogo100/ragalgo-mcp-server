/**
 * 차트 관련 MCP Tools
 */

import { z } from 'zod';
import { callApi } from '../utils/api.js';

// 주식 차트 파라미터 스키마
export const ChartStockParamsSchema = z.object({
    ticker: z.string().optional().describe('종목 코드 (예: 005930)'),
    market: z.enum(['KOSPI', 'KOSDAQ']).optional().describe('시장 구분'),
    zone: z.enum(['STRONG_UP', 'UP_ZONE', 'NEUTRAL', 'DOWN_ZONE', 'STRONG_DOWN']).optional().describe('차트 구간'),
    limit: z.number().min(1).max(100).default(20).describe('결과 수'),
});

// 코인 차트 파라미터 스키마
export const ChartCoinParamsSchema = z.object({
    ticker: z.string().optional().describe('코인 코드 (예: KRW-BTC)'),
    zone: z.enum(['STRONG_UP', 'UP_ZONE', 'NEUTRAL', 'DOWN_ZONE', 'STRONG_DOWN']).optional().describe('차트 구간'),
    limit: z.number().min(1).max(100).default(20).describe('결과 수'),
});

export type ChartStockParams = z.infer<typeof ChartStockParamsSchema>;
export type ChartCoinParams = z.infer<typeof ChartCoinParamsSchema>;

// 주식 차트 조회
export async function getChartStock(params: ChartStockParams) {
    const endpoint = params.ticker ? \`chart-stock/\${params.ticker}\` : 'chart-stock';
    const { ticker, ...queryParams } = params;

    const result = await callApi<{
        success: boolean;
        data: {
            ticker: string;
            name: string;
            market: string;
            scores: number[];
            zone: string;
            oscillator_state: string;
            last_price: number;
            updated_at: string;
        } | Array<{
            ticker: string;
            name: string;
            market: string;
            zone: string;
            last_price: number;
        }>;
    }>(endpoint, queryParams);

    return result;
}

// 코인 차트 조회
export async function getChartCoin(params: ChartCoinParams) {
    const endpoint = params.ticker ? \`chart-coin/\${params.ticker}\` : 'chart-coin';
    const { ticker, ...queryParams } = params;

    const result = await callApi<{
        success: boolean;
        data: {
            ticker: string;
            name: string;
            scores: number[];
            zone: string;
            oscillator_state: string;
            last_price: number;
            updated_at: string;
        } | Array<{
            ticker: string;
            name: string;
            zone: string;
            last_price: number;
        }>;
    }>(endpoint, queryParams);

    return result;
}
