// Launch feature flags. Keep dead/mock surfaces off for the soft launch without
// deleting their code (fast-follow can flip these back on).

// Shop/products are still mock-data + integer-id based (uuid-unsafe). Off for launch.
export const SHOP_ENABLED = false;
