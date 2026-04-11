export function runLinks(url: any): Promise<{
    outputPath: string;
    links: {
        href: any;
        text: string;
    }[];
}>;
