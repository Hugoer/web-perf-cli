export type CleanCmdResult = {
    cleaned: string[];
    skipped: string[];
    errored: string[];
};
/**
 * @param {string} input - File path, directory path, or glob pattern
 * @returns {Promise<CleanCmdResult>}
 * @throws {Error} when a non-glob input does not exist on disk
 */
export function runCleanCmd(input: string): Promise<CleanCmdResult>;
