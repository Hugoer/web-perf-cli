module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [2, 'always', ['build', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'test']],
        'scope-enum': [1, 'always', ['lab', 'rum', 'collect', 'sitemap', 'links', 'cli', 'prompts', 'profiles', 'utils']],
        'scope-empty': [0],
        'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
        'subject-full-stop': [2, 'never', '.'],
        'header-max-length': [2, 'always', 100],
    },
};
