import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const chalk = require('chalk');

const logger = require('./logger');

describe('logger', () => {
    let stdoutSpy;
    let stderrSpy;
    let stderrWriteSpy;

    beforeEach(() => {
        stdoutSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        stderrWriteSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('action', () => {
        it('should log message in cyan to stdout', () => {
            logger.action('Running audit');
            expect(stdoutSpy).toHaveBeenCalledWith(chalk.cyan('Running audit'));
        });
    });

    describe('success', () => {
        it('should log message in green to stdout', () => {
            logger.success('Results saved');
            expect(stdoutSpy).toHaveBeenCalledWith(chalk.green('Results saved'));
        });
    });

    describe('error', () => {
        it('should log message in red to stderr', () => {
            logger.error('Something failed');
            expect(stderrSpy).toHaveBeenCalledWith(chalk.red('Something failed'));
        });
    });

    describe('info', () => {
        it('should log indented dim message to stdout', () => {
            logger.info('Using profile: low');
            expect(stdoutSpy).toHaveBeenCalledWith(chalk.dim('  Using profile: low'));
        });
    });

    describe('header', () => {
        it('should log bold message to stdout', () => {
            logger.header('Started at 12:00:00');
            expect(stdoutSpy).toHaveBeenCalledWith(chalk.bold('Started at 12:00:00'));
        });
    });

    describe('summary', () => {
        it('should show green succeeded and dim failed when no failures', () => {
            logger.summary(5, 0);
            expect(stdoutSpy).toHaveBeenCalledWith(
                `Results: ${chalk.green('5 succeeded')}, ${chalk.dim('0 failed')}`
            );
        });

        it('should show green succeeded and red failed when there are failures', () => {
            logger.summary(3, 2);
            expect(stdoutSpy).toHaveBeenCalledWith(
                `Results: ${chalk.green('3 succeeded')}, ${chalk.red('2 failed')}`
            );
        });
    });

    describe('footer', () => {
        it('should log dim message to stdout', () => {
            logger.footer('Finished at 12:05:00');
            expect(stdoutSpy).toHaveBeenCalledWith(chalk.dim('Finished at 12:05:00'));
        });
    });

    describe('progress', () => {
        it('should write progress line to stderr with ANSI clear', () => {
            logger.progress(50, 3, 6, 'https://example.com');
            const expected = `\x1B[2K\r${chalk.yellow('50%')} ${chalk.dim('[3/6]')} https://example.com`;
            expect(stderrWriteSpy).toHaveBeenCalledWith(expected);
        });

        it('should show 100% at completion', () => {
            logger.progress(100, 6, 6, 'https://example.com');
            const expected = `\x1B[2K\r${chalk.yellow('100%')} ${chalk.dim('[6/6]')} https://example.com`;
            expect(stderrWriteSpy).toHaveBeenCalledWith(expected);
        });
    });

    describe('fail', () => {
        it('should write red failure message to stderr with newlines', () => {
            logger.fail('https://bad.com — timeout');
            expect(stderrWriteSpy).toHaveBeenCalledWith(
                chalk.red('\n  Failed: https://bad.com — timeout\n')
            );
        });
    });

    describe('outputPath', () => {
        it('should log indented file path to stdout', () => {
            logger.outputPath('results/lab/lab-example.json');
            expect(stdoutSpy).toHaveBeenCalledWith('  results/lab/lab-example.json');
        });
    });

    describe('failedList', () => {
        it('should log header and each item in red to stderr', () => {
            logger.failedList(['url1: error1', 'url2: error2']);
            expect(stderrSpy).toHaveBeenCalledWith(chalk.red('\nFailed:'));
            expect(stderrSpy).toHaveBeenCalledWith(chalk.red('  - url1: error1'));
            expect(stderrSpy).toHaveBeenCalledWith(chalk.red('  - url2: error2'));
        });

        it('should log only header when list is empty', () => {
            logger.failedList([]);
            expect(stderrSpy).toHaveBeenCalledWith(chalk.red('\nFailed:'));
            expect(stderrSpy).toHaveBeenCalledTimes(1);
        });
    });
});
