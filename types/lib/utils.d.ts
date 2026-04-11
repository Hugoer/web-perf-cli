export function ensureCommandDir(command: any): void;
export function buildFilename(url: any, command: any, suffix: any, ext?: string): string;
export function formatDate(): string;
export function formatElapsed(ms: any): string;
export function normalizeOrigin(url: any): string;
export function normalizeUrlForAi(url: any): string;
export function writeAiOutput(urls: any, referenceUrl: any, command: any): string;
export function createRateLimiter({ maxRequestsPerSecond }: {
    maxRequestsPerSecond: any;
}): () => Promise<void>;
export function sleep(ms: any): Promise<any>;
export const RESULTS_DIR: string;
