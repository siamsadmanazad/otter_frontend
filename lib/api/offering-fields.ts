// TripOtter · bussinesstemplate.md Phase B.4 · per-type field rules for services
//
// "Never show a field the type doesn't need" (business_mode.md 3.1) is the
// composer's rule. This is the same rule at the API, and the DB constraints
// added in B.1/B.2 are the layer under it.
//
// WHY THIS IS A TABLE AND NOT A CHAIN OF ifs: the interesting fact about each
// field is which types accept it, and that is one column of data. Written as
// a table it can be read in ten seconds and audited against §5.2's matrix;
// written as branching code the same information is spread over ninety lines
// and nobody ever checks it again.
//
// WHY IT DUPLICATES THE DB CONSTRAINTS ON PURPOSE: the constraint is the layer
// that cannot be bypassed, but it surfaces as
// `violates check constraint "offerings_stay_fields_chk"`, which is not a
// sentence anyone should read. This layer exists to say "Only a stay has
// bedrooms" instead. Same defence-in-depth reasoning as every other rule in
// this project (cp_insert_self: never rely on one layer).

export const OFFERING_TYPES = [
  "TOUR", "STAY", "EVENT", "CLASS", "RENTAL", "GUIDE", "TRANSPORT", "TABLE",
] as const;
export type OfferingType = (typeof OFFERING_TYPES)[number];

const ALL = OFFERING_TYPES;
const STAY_ONLY: readonly OfferingType[] = ["STAY"];

/** Which types accept each field, plus the message shown when they don't. */
const FIELD_RULES: {
  key: string;
  column: string;
  types: readonly OfferingType[];
  reason: string;
}[] = [
  // Shared depth — every type may carry these.
  { key: "amenities",   column: "amenities",   types: ALL, reason: "" },
  { key: "inclusions",  column: "inclusions",  types: ALL, reason: "" },
  { key: "exclusions",  column: "exclusions",  types: ALL, reason: "" },
  { key: "houseRules",  column: "house_rules", types: ALL, reason: "" },
  { key: "minParty",    column: "min_party",   types: ALL, reason: "" },
  { key: "maxParty",    column: "max_party",   types: ALL, reason: "" },
  { key: "cancellationPolicy", column: "cancellation_policy", types: ALL, reason: "" },
  { key: "instantBook", column: "instant_book", types: ALL, reason: "" },
  { key: "specNotes",   column: "spec_notes",  types: ALL, reason: "" },
  { key: "licenceNumber", column: "licence_number", types: ALL, reason: "" },
  { key: "pickupNotes", column: "pickup_notes", types: ALL, reason: "" },
  { key: "meetingPoint", column: "meeting_point", types: ALL, reason: "" },

  // Type-scoped. These mirror offerings_stay_fields_chk /
  // offerings_duration_type_chk / offerings_validate_itinerary exactly.
  { key: "checkInTime",  column: "check_in_time",  types: STAY_ONLY, reason: "Only a stay has a check-in time" },
  { key: "checkOutTime", column: "check_out_time", types: STAY_ONLY, reason: "Only a stay has a check-out time" },
  { key: "minNights",    column: "min_nights",     types: STAY_ONLY, reason: "Only a stay has a nights minimum" },
  { key: "maxNights",    column: "max_nights",     types: STAY_ONLY, reason: "Only a stay has a nights maximum" },
  { key: "bedrooms",     column: "bedrooms",       types: STAY_ONLY, reason: "Only a stay has bedrooms" },
  { key: "beds",         column: "beds",           types: STAY_ONLY, reason: "Only a stay has beds" },
  { key: "bathrooms",    column: "bathrooms",      types: STAY_ONLY, reason: "Only a stay has bathrooms" },
  {
    key: "durationMinutes", column: "duration_minutes",
    types: ["TOUR", "EVENT", "CLASS", "GUIDE", "TRANSPORT"],
    reason: "This kind of service doesn't have a duration",
  },
  {
    key: "itinerary", column: "itinerary", types: ["TOUR"],
    reason: "Only a tour has a day-by-day itinerary",
  },
  {
    key: "languages", column: "languages",
    types: ["TOUR", "GUIDE", "CLASS", "EVENT", "TRANSPORT"],
    reason: "This kind of service doesn't list languages",
  },
];

const CANCELLATION_POLICIES = new Set([
  "FLEXIBLE", "MODERATE", "STRICT", "NON_REFUNDABLE",
]);

// business_post_polish.md §6.1 — what price_cents is PER, scoped per type
// exactly like every other field in this file (D3: one law, three places —
// this is the API's copy; the DB's is offerings_price_unit_chk, the
// composer's is service_field_spec.dart's PRICE_UNITS). A forged unit for
// the wrong type is rejected here with a sentence, then again by the DB
// constraint if this layer is ever bypassed.
export const PRICE_UNITS_BY_TYPE: Record<OfferingType, readonly string[]> = {
  STAY: ["NIGHT", "GROUP"],
  TOUR: ["PERSON", "GROUP"],
  EVENT: ["PERSON", "GROUP"],
  CLASS: ["PERSON", "SESSION"],
  GUIDE: ["HOUR", "DAY", "GROUP"],
  TRANSPORT: ["TRIP", "DAY", "KM"],
  RENTAL: ["HOUR", "DAY", "WEEK"],
  TABLE: ["PERSON", "GROUP"],
};

export const DEFAULT_PRICE_UNIT_BY_TYPE: Record<OfferingType, string> = {
  STAY: "NIGHT",
  TOUR: "PERSON",
  EVENT: "PERSON",
  CLASS: "PERSON",
  GUIDE: "DAY",
  TRANSPORT: "TRIP",
  RENTAL: "DAY",
  TABLE: "PERSON",
};

/**
 * Validates `priceUnit` against §6.1's per-type set. Only called when
 * `priceMode` is FIXED/FROM (route.ts) — a FREE or absent price has no unit
 * to validate. `unit` defaults to the type's own §6.1 default rather than
 * failing when omitted, matching offerings_price_chk's own "price_unit is
 * not null" requirement without forcing every existing composer/client call
 * site to learn a new required field the same day this ships.
 */
export function validatePriceUnit(
  unit: unknown,
  type: OfferingType
): { error: string } | { value: string } {
  const allowed = PRICE_UNITS_BY_TYPE[type];
  if (unit === undefined || unit === null || unit === "") {
    return { value: DEFAULT_PRICE_UNIT_BY_TYPE[type] };
  }
  if (typeof unit !== "string" || !allowed.includes(unit)) {
    return { error: `priceUnit must be one of: ${allowed.join(", ")}` };
  }
  return { value: unit };
}

function strArray(v: unknown, max: number, maxLen: number): string[] | { error: string } {
  if (!Array.isArray(v)) return { error: "must be a list" };
  const out = v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean);
  if (out.length > max) return { error: `at most ${max} entries` };
  if (out.some((x) => x.length > maxLen)) return { error: `each entry must be under ${maxLen} characters` };
  return out;
}

function intIn(v: unknown, lo: number, hi: number): number | null | { error: string } {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) return { error: `must be a whole number between ${lo} and ${hi}` };
  return n;
}

/**
 * Validates the B.1/B.2 depth fields for `type` and returns the column patch
 * to merge into an insert/update. Any field belonging to another type is
 * rejected by name, so the host is told which field is wrong rather than
 * being handed a constraint name.
 */
export function validateTypeFields(
  body: Record<string, unknown>,
  type: OfferingType
): { error: string } | { patch: Record<string, unknown> } {
  const patch: Record<string, unknown> = {};

  for (const rule of FIELD_RULES) {
    const raw = body[rule.key];
    if (raw === undefined) continue;
    if (!rule.types.includes(type)) {
      return { error: rule.reason || `${rule.key} does not apply to this service` };
    }

    switch (rule.key) {
      case "amenities":
      case "inclusions":
      case "exclusions": {
        const max = rule.key === "amenities" ? 40 : 30;
        const r = strArray(raw, max, 80);
        if ("error" in r) return { error: `${rule.key} ${r.error}` };
        patch[rule.column] = r;
        break;
      }
      case "languages": {
        const r = strArray(raw, 12, 40);
        if ("error" in r) return { error: `languages ${r.error}` };
        patch[rule.column] = r;
        break;
      }
      case "minParty":
      case "maxParty": {
        const r = intIn(raw, 1, 500);
        if (r !== null && typeof r === "object") return { error: `${rule.key} ${r.error}` };
        patch[rule.column] = r;
        break;
      }
      case "minNights":
      case "maxNights": {
        const r = intIn(raw, 1, 365);
        if (r !== null && typeof r === "object") return { error: `${rule.key} ${r.error}` };
        patch[rule.column] = r;
        break;
      }
      case "bedrooms": case "beds": {
        const r = intIn(raw, 0, rule.key === "beds" ? 200 : 100);
        if (r !== null && typeof r === "object") return { error: `${rule.key} ${r.error}` };
        patch[rule.column] = r;
        break;
      }
      case "bathrooms": {
        if (raw === null) { patch[rule.column] = null; break; }
        const n = Number(raw);
        // Half-baths are real, so this is the one non-integer count.
        if (!Number.isFinite(n) || n < 0 || n > 100 || Math.round(n * 2) !== n * 2) {
          return { error: "bathrooms must be a number in halves, 0-100" };
        }
        patch[rule.column] = n;
        break;
      }
      case "durationMinutes": {
        const r = intIn(raw, 5, 43200);
        if (r !== null && typeof r === "object") return { error: `durationMinutes ${r.error}` };
        patch[rule.column] = r;
        break;
      }
      case "checkInTime":
      case "checkOutTime": {
        if (raw === null) { patch[rule.column] = null; break; }
        if (typeof raw !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) {
          return { error: `${rule.key} must look like 14:00` };
        }
        patch[rule.column] = raw;
        break;
      }
      case "cancellationPolicy": {
        if (raw === null) { patch[rule.column] = null; break; }
        if (typeof raw !== "string" || !CANCELLATION_POLICIES.has(raw)) {
          return { error: "Invalid cancellation policy" };
        }
        patch[rule.column] = raw;
        break;
      }
      case "instantBook": {
        if (raw !== null && typeof raw !== "boolean") return { error: "instantBook must be true or false" };
        patch[rule.column] = raw;
        break;
      }
      case "houseRules":
      case "specNotes":
      case "pickupNotes":
      case "meetingPoint":
      case "licenceNumber": {
        if (raw === null) { patch[rule.column] = null; break; }
        if (typeof raw !== "string") return { error: `${rule.key} must be text` };
        const caps: Record<string, number> = {
          houseRules: 2048, specNotes: 1000, pickupNotes: 1000,
          meetingPoint: 300, licenceNumber: 80,
        };
        const t = raw.trim();
        if (t.length > caps[rule.key]) return { error: `${rule.key} is too long` };
        patch[rule.column] = t || null;
        break;
      }
      case "itinerary": {
        if (raw === null) { patch[rule.column] = null; break; }
        if (!Array.isArray(raw) || raw.length < 1 || raw.length > 30) {
          return { error: "An itinerary needs 1-30 days" };
        }
        for (const d of raw) {
          const day = d as Record<string, unknown>;
          if (
            typeof day !== "object" || day === null ||
            typeof day.day !== "number" ||
            typeof day.title !== "string" || !day.title.trim() || day.title.length > 120 ||
            (day.detail !== undefined && (typeof day.detail !== "string" || day.detail.length > 1000))
          ) {
            return { error: "Each itinerary day needs a day number and a title" };
          }
        }
        patch[rule.column] = raw;
        break;
      }
    }
  }

  // Cross-field rules the loop can't see, mirroring offerings_party_chk /
  // offerings_nights_chk so the host gets a sentence, not a constraint name.
  const minP = patch.min_party as number | null | undefined;
  const maxP = patch.max_party as number | null | undefined;
  if (typeof minP === "number" && typeof maxP === "number" && maxP < minP) {
    return { error: "The largest party can't be smaller than the smallest" };
  }
  const minN = patch.min_nights as number | null | undefined;
  const maxN = patch.max_nights as number | null | undefined;
  if (typeof minN === "number" && typeof maxN === "number" && maxN < minN) {
    return { error: "The maximum stay can't be shorter than the minimum" };
  }

  // Meeting coordinates are all-or-nothing (offerings_meeting_point_chk).
  const hasMLat = typeof body.meetingLat === "number";
  const hasMLng = typeof body.meetingLng === "number";
  if (hasMLat !== hasMLng) {
    return { error: "A meeting point needs both a latitude and a longitude" };
  }
  if (hasMLat) {
    patch.meeting_lat = body.meetingLat;
    patch.meeting_lng = body.meetingLng;
  }

  return { patch };
}

/**
 * `serviceForm` is validated against the `service_forms` catalogue rather than
 * a hardcoded list — the catalogue is the one source of truth the composer
 * also reads, so a form added there works everywhere without a deploy.
 */
export async function validateServiceForm(
  db: { from: (t: string) => any },
  form: unknown,
  type: OfferingType
): Promise<{ error: string } | { value: string | null }> {
  if (form === undefined || form === null) return { value: null };
  if (typeof form !== "string") return { error: "Invalid service form" };
  const { data } = await db
    .from("service_forms")
    .select("form")
    .eq("type", type)
    .eq("form", form)
    .maybeSingle();
  if (!data) return { error: "That kind doesn't belong to this type of service" };
  return { value: form };
}

