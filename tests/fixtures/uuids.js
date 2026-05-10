/** Sample UUIDs that must pass route param validation (same style as `app/schemas/common.schema.js`). */
export const validSessionIds = [
    "00000000-0000-0000-0000-000000000000",
    "ffffffff-ffff-ffff-ffff-ffffffffffff",
    "11111111-2222-3333-4444-555555555555",
    "aBcDeF12-3456-7890-aBcD-eF1234567890",
];

export const invalidSessionIds = [
    "",
    "not-a-uuid",
    "12345",
    "11111111-2222-3333-4444-55555555555",
    "11111111-2222-3333-4444-5555555555555",
    "11111111-2222-3333-4444",
    "11111111_2222_3333_4444_555555555555",
    "gggggggg-gggg-gggg-gggg-gggggggggggg",
    "  11111111-2222-3333-4444-555555555555",
];
