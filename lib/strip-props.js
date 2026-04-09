const STRIP_KEYS = ['i18n', 'timing'];

// Today: shallow — removes only root-level keys.
// Future: add { deep: true } option to recurse into nested objects/arrays.
function stripJsonProps(obj, keys = STRIP_KEYS) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return obj;
    const result = { ...obj };
    for (const key of keys) {
        delete result[key];
    }
    return result;
}

module.exports = { stripJsonProps, STRIP_KEYS };
