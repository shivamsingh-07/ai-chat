export function now() {
    return new Date();
}

export function toIsoString(value) {
    if (value instanceof Date) {
        return value.toISOString();
    }
    return new Date(value).toISOString();
}
