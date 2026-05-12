const chalk = require('chalk');

const logger = {
    // Intro line: "Running Lighthouse audit for: https://example.com"
    action(message) {
        console.log(chalk.cyan(message));
    },

    // Result line: "Lab results saved to: results/lab/..."
    success(message) {
        console.log(chalk.green(message));
    },

    // Fatal error: "Error: something went wrong"
    error(message) {
        console.error(chalk.red(message));
    },

    // Non-fatal warning: "No CrUX data found for..."
    warn(message) {
        console.warn(chalk.yellow(`Warning: ${message}`));
    },

    // Config detail: "  Using profile: low", "  Categories: performance, seo"
    info(message) {
        console.log(chalk.dim(`  ${message}`));
    },

    // Batch header: "Started at 12:00:00" / "Processing 5 URLs..."
    header(message) {
        console.log(chalk.bold(message));
    },

    // Batch result summary: "Results: 3 succeeded, 1 failed"
    summary(succeeded, failed) {
        const parts = [
            `Results: ${chalk.green(`${succeeded} succeeded`)}`,
            `${failed > 0 ? chalk.red(`${failed} failed`) : chalk.dim(`${failed} failed`)}`,
        ];
        console.log(parts.join(', '));
    },

    // Batch footer: "Finished at 12:00:00 (2m 5s)"
    footer(message) {
        console.log(chalk.dim(message));
    },

    // Progress line (stderr, overwritten): "50% [3/6] https://example.com"
    progress(pct, current, total, detail) {
        const pctStr = chalk.yellow(`${pct}%`);
        const counter = chalk.dim(`[${current}/${total}]`);
        process.stderr.write(`\x1B[2K\r${pctStr} ${counter} ${detail}`);
    },

    // Inline failure during batch (stderr)
    fail(message) {
        process.stderr.write(chalk.red(`\n  Failed: ${message}\n`));
    },

    // Batch succeeded output paths
    outputPath(filePath) {
        console.log(`  ${filePath}`);
    },

    // Batch failed list
    failedList(items) {
        console.error(chalk.red('\nFailed:'));
        items.forEach((item) => console.error(chalk.red(`  - ${item}`)));
    },
};

module.exports = logger;
