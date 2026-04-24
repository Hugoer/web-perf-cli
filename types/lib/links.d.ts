/**
 * @param {string} url
 * @returns {Promise<{ outputPath: string, links: Array<{ href: string, text: string }> }>}
 */
export function runLinks(url: string): Promise<{
    outputPath: string;
    links: Array<{
        href: string;
        text: string;
    }>;
}>;
