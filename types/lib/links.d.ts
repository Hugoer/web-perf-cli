/**
 * @param {string} url
 */
export function runLinks(url: string): Promise<{
    outputPath: string;
    links: {
        href: any;
        text: string;
    }[];
}>;
