// Every subpath in package.json "exports" must resolve to declarations, not to untyped JS.
import { runPsiAudit } from '@hugoer/web-perf-cli/psi';
import { runSitemap, resolveSitemapUrl } from '@hugoer/web-perf-cli/sitemap';
import { runLinks } from '@hugoer/web-perf-cli/links';
import { PROFILES, resolveProfileSettings } from '@hugoer/web-perf-cli/profiles';
import { buildFilename, withRetry, runBatch } from '@hugoer/web-perf-cli/utils';
import { selectMedianRun, assessStability } from '@hugoer/web-perf-cli/variance';
import type { PsiReport } from '@hugoer/web-perf-cli/psi';

export const psi: Promise<PsiReport> = runPsiAudit('https://example.com', 'KEY', ['PERFORMANCE'], 'mobile');
export const sitemap = runSitemap('https://example.com', 2, 0);
export const origin: string = resolveSitemapUrl('example.com').origin;
export const links = runLinks('https://example.com');
export const profileNames: string[] = Object.keys(PROFILES);
export const settings = resolveProfileSettings({ profile: 'low' });
export const name: string = buildFilename('https://example.com', 'lab', 'low');
export const retried = withRetry(async () => 1, { maxRetries: 1 });
export const batched = runBatch(['a'], async () => 1, { maxRequestsPerSecond: 1 });
export const medianIndex: number = selectMedianRun([0.5, 0.6]);
export const stability: { stable: boolean; warnings: string[] } = assessStability([1000, 1100]);
