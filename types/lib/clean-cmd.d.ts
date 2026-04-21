export type CleanCmdResult = {
    cleaned: string[];
    skipped: string[];
    errored: string[];
};
/**
 * @param {string} input - File path, directory path, or glob pattern
 * @returns {Promise<CleanCmdResult>}
 */
export function runCleanCmd(input: string): Promise<CleanCmdResult>;
