export const DEFAULT_CONCURRENCY: 5;
export const SKIPPABLE_AUDITS: {
    id: string;
    label: string;
    defaultSkip: boolean;
}[];
export function normalizeUrls(urls: any): any[];
export function promptForSubcommand(): Promise<any>;
export function promptLab(url: any, options: any): Promise<{
    urls: never[];
    runs: never[];
}>;
export function promptPsi(url: any, options: any): Promise<{
    apiKey: null;
    urls: never[];
    categories: undefined;
    concurrency: any;
    delay: any;
}>;
export function promptCrux(url: any, options: any): Promise<{
    apiKey: null;
    urls: never[];
    scope: any;
    formFactors: null;
    concurrency: any;
    delay: any;
}>;
export function promptCruxHistory(url: any, options: any): Promise<{
    apiKey: null;
    urls: never[];
    scope: any;
    formFactors: null;
    concurrency: any;
    delay: any;
}>;
export function promptSitemap(url: any, options: any): Promise<{
    url: any;
    depth: any;
    delay: any;
    outputAi: any;
}>;
export function promptLinks(url: any, options?: {}): Promise<{
    url: any;
    outputAi: any;
}>;
export function promptClean(): Promise<{
    input: any;
}>;
export function parseProfileFlag(profileStr: any): any;
export function parsePsiStrategies(strategyStr: any): any[];
export function parseCruxFormFactors(formFactorStr: any): any[];
export function parseLabCategoriesFlag(categoryStr: any): any[];
/**
 * Resolves --runs into a repeat count, rejecting the combination that would make the samples
 * meaningless: repeats on a shared browser measure the connection pool warming up, not the
 * page, because Lighthouse does not clear DNS caches or sockets between runs.
 * @param {number|string|undefined} runsValue
 * @param {{ reuseBrowser?: boolean }} [options]
 * @returns {number} repeats per (url, profile) pair; 1 when --runs was not given
 */
export function parseRunsFlag(runsValue: number | string | undefined, { reuseBrowser }?: {
    reuseBrowser?: boolean;
}): number;
export function parseSkipAuditsFlag(skipAuditsStr: any): any;
export function parseBlockedUrlPatternsFlag(patternsStr: any): any[] | undefined;
export function validateUrl(input: any): true | "Please enter a valid URL (e.g. https://example.com)";
export function validatePositiveInt(input: any): true | "Enter a positive number";
export function validateNonNegativeInt(input: any): true | "Enter a number in milliseconds";
export function validateFilePath(input: any, requiredMsg?: string): string | true;
export function resolvePsiApiKey(options: any): any;
export function resolveCruxApiKey(options: any): any;
