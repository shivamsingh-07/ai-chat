/** Pino-compatible stub: `.child()` returns loggers with no-op methods (tests stay quiet). */
export function createSilentLogger() {
    const noop = () => {};
    const child = () => ({ info: noop, error: noop, warn: noop, debug: noop });
    return { child, info: noop, error: noop, warn: noop, debug: noop };
}
