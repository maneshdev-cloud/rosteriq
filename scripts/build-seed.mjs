// Builds src/lib/data/seed.json + fixtures from the compact blueprint below.
// The blueprint in this file is the SINGLE SOURCE for canonical names.
// seed.json, tests, UI copy and the demo script must copy names from here —
// never retype them from memory (that is how name drift happens).
// Run: node scripts/build-seed.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const out = (path, data) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  console.log("wrote", path);
};

// --- Pods & employees -------------------------------------------------------
// Layout (varied pods, NOT symmetric):
//  A Beauty : 4 solo owners, 3-person multi brand, 1 floater          = 8
//  B Fashion: 5 solo owners (one holds TWO brands), 2-person multi,
//             1 floater                                               = 8
//  C Health : 4 solo owners, 3-person multi brand, 1 floater          = 8
//  D Home   : 5 solo owners, 2-person multi brand, 1 floater          = 8
// Totals: 32 employees, 23 brands, 19 solo (82.6%), 4 multi.
const pods = [
  { id: "pod-a", name: "Beauty & Wellness", leadEmployeeId: "aarav-mehta" },
  { id: "pod-b", name: "Fashion & Lifestyle", leadEmployeeId: "meera-joshi" },
  { id: "pod-c", name: "Health & Fitness", leadEmployeeId: "aditya-rao" },
  { id: "pod-d", name: "Home & General D2C", leadEmployeeId: "sanjay-gupta" },
];

const E = (id, name, podId, weeklyOffPref) => ({
  id,
  name,
  podId,
  isPodLead: pods.find((p) => p.id === podId).leadEmployeeId === id,
  weeklyOffPref,
  maxConsecutiveDays: 6,
});

const employees = [
  // Pod A
  E("aarav-mehta", "Aarav Mehta", "pod-a", [0]),
  E("priya-nair", "Priya Nair", "pod-a", [0]),
  E("kavya-reddy", "Kavya Reddy", "pod-a", [3]),
  E("rohan-patil", "Rohan Patil", "pod-a", [0]),
  E("sneha-kulkarni", "Sneha Kulkarni", "pod-a", [0]),
  E("vikram-shah", "Vikram Shah", "pod-a", [6]),
  E("ananya-iyer", "Ananya Iyer", "pod-a", [0]),
  E("ishaan-verma", "Ishaan Verma (Floater)", "pod-a", [2]),
  // Pod B
  E("meera-joshi", "Meera Joshi", "pod-b", [0]),
  E("arjun-malhotra", "Arjun Malhotra", "pod-b", [0]),
  E("divya-pillai", "Divya Pillai", "pod-b", [4]),
  E("kabir-singh", "Kabir Singh", "pod-b", [0]),
  E("naina-kapoor", "Naina Kapoor", "pod-b", [6]),
  E("rahul-deshmukh", "Rahul Deshmukh", "pod-b", [0]),
  E("sara-khan", "Sara Khan", "pod-b", [0]),
  E("dev-patel", "Dev Patel (Floater)", "pod-b", [3]),
  // Pod C
  E("aditya-rao", "Aditya Rao", "pod-c", [0]),
  E("pooja-menon", "Pooja Menon", "pod-c", [0]),
  E("kiran-bhat", "Kiran Bhat", "pod-c", [5]),
  E("leela-nambiar", "Leela Nambiar", "pod-c", [0]),
  E("nikhil-verma", "Nikhil Verma", "pod-c", [0]),
  E("riya-sharma", "Riya Sharma", "pod-c", [6]),
  E("varun-nair", "Varun Nair", "pod-c", [0]),
  E("tara-bhatt", "Tara Bhatt (Floater)", "pod-c", [2]),
  // Pod D
  E("sanjay-gupta", "Sanjay Gupta", "pod-d", [0]),
  E("anita-desai", "Anita Desai", "pod-d", [3]),
  E("manoj-kumar", "Manoj Kumar", "pod-d", [0]),
  E("geeta-rao", "Geeta Rao", "pod-d", [0]),
  E("farhan-sheikh", "Farhan Sheikh", "pod-d", [6]),
  E("neha-patil", "Neha Patil", "pod-d", [0]),
  E("amit-joshi", "Amit Joshi", "pod-d", [0]),
  E("rashmi-iyer", "Rashmi Iyer (Floater)", "pod-d", [4]),
];

// --- Brands -----------------------------------------------------------------
const B = (id, name, podId) => ({ id, name, podId });
const brands = [
  B("novaskin", "NovaSkin", "pod-a"),
  B("pureglow", "PureGlow", "pod-a"),
  B("auracare", "AuraCare", "pod-a"),
  B("bloomessentials", "BloomEssentials", "pod-a"),
  B("luxebeauty", "LuxeBeauty", "pod-a"),
  B("urbanthread", "UrbanThread", "pod-b"),
  B("stylenest", "StyleNest", "pod-b"),
  B("modecraft", "ModeCraft", "pod-b"),
  B("trendlane", "TrendLane", "pod-b"),
  B("chickart", "ChicKart", "pod-b"),
  B("voguenest", "VogueNest", "pod-b"),
  B("luxewear", "LuxeWear", "pod-b"),
  B("fitfuel", "FitFuel", "pod-c"),
  B("vitacore", "VitaCore", "pod-c"),
  B("nutrinest", "NutriNest", "pod-c"),
  B("wellspring", "WellSpring", "pod-c"),
  B("activelife", "ActiveLife", "pod-c"),
  B("casabloom", "CasaBloom", "pod-d"),
  B("homeease", "HomeEase", "pod-d"),
  B("dailynest", "DailyNest", "pod-d"),
  B("ecoliving", "EcoLiving", "pod-d"),
  B("kitchenkart", "KitchenKart", "pod-d"),
  B("primeliving", "PrimeLiving", "pod-d"),
];
const MULTI = new Set(["luxebeauty", "luxewear", "activelife", "primeliving"]);

// --- Brand processes & calendars -------------------------------------------
// [brandId, processCode, calendarType, overrides?]
const BP = [
  ["novaskin", "CS", "ALL_365"], ["novaskin", "ACC", "ALL_365"], ["novaskin", "NDR", "DAILY_EXCEPT_HOLIDAYS"],
  ["pureglow", "CS", "ALL_365"], ["pureglow", "ACC", "DAILY_EXCEPT_HOLIDAYS"],
  ["auracare", "CS", "SUN_AND_HOLIDAYS_OFF"], ["auracare", "NDR", "SUN_AND_HOLIDAYS_OFF"],
  ["bloomessentials", "CS", "SUN_AND_HOLIDAYS_OFF"], ["bloomessentials", "ACC", "SUN_AND_HOLIDAYS_OFF"],
  ["luxebeauty", "CS", "ALL_365", { "2026-12-19": 2 }], ["luxebeauty", "ACC", "DAILY_EXCEPT_HOLIDAYS"], ["luxebeauty", "NDR", "SUN_AND_HOLIDAYS_OFF"],
  ["urbanthread", "CS", "ALL_365"], ["urbanthread", "ACC", "ALL_365"],
  ["stylenest", "CS", "SUN_AND_HOLIDAYS_OFF"],
  ["modecraft", "CS", "SUN_AND_HOLIDAYS_OFF"], ["modecraft", "ACC", "SUN_AND_HOLIDAYS_OFF"],
  ["trendlane", "CS", "ALL_365"], ["trendlane", "NDR", "DAILY_EXCEPT_HOLIDAYS"],
  ["chickart", "CS", "SUN_AND_HOLIDAYS_OFF"], ["chickart", "RET", "SUN_AND_HOLIDAYS_OFF"],
  ["voguenest", "CS", "DAILY_EXCEPT_HOLIDAYS"], ["voguenest", "ACC", "DAILY_EXCEPT_HOLIDAYS"],
  ["luxewear", "CS", "ALL_365"], ["luxewear", "ACC", "DAILY_EXCEPT_HOLIDAYS"], ["luxewear", "NDR", "SUN_AND_HOLIDAYS_OFF"],
  ["fitfuel", "CS", "ALL_365"], ["fitfuel", "ACC", "DAILY_EXCEPT_HOLIDAYS"],
  ["vitacore", "CS", "SUN_AND_HOLIDAYS_OFF"], ["vitacore", "NDR", "SUN_AND_HOLIDAYS_OFF"],
  ["nutrinest", "CS", "SUN_AND_HOLIDAYS_OFF"], ["nutrinest", "RET", "SUN_AND_HOLIDAYS_OFF"],
  ["wellspring", "CS", "ALL_365"], ["wellspring", "ACC", "ALL_365"],
  ["activelife", "CS", "ALL_365", { "2026-12-12": 2 }], ["activelife", "ACC", "DAILY_EXCEPT_HOLIDAYS"], ["activelife", "NDR", "SUN_AND_HOLIDAYS_OFF"],
  ["casabloom", "CS", "SUN_AND_HOLIDAYS_OFF"], ["casabloom", "ACC", "SUN_AND_HOLIDAYS_OFF"],
  ["homeease", "CS", "SUN_AND_HOLIDAYS_OFF"], ["homeease", "NDR", "SUN_AND_HOLIDAYS_OFF"],
  ["dailynest", "CS", "ALL_365"], ["dailynest", "RET", "SUN_AND_HOLIDAYS_OFF"],
  ["ecoliving", "CS", "ALL_365"], ["ecoliving", "ACC", "DAILY_EXCEPT_HOLIDAYS"],
  ["kitchenkart", "CS", "DAILY_EXCEPT_HOLIDAYS"], ["kitchenkart", "ACC", "DAILY_EXCEPT_HOLIDAYS"],
  ["primeliving", "CS", "ALL_365"], ["primeliving", "ACC", "DAILY_EXCEPT_HOLIDAYS"], ["primeliving", "NDR", "SUN_AND_HOLIDAYS_OFF"],
];
const brandProcesses = BP.map(([brandId, processCode, calendarType]) => ({
  id: `${brandId}:${processCode}`, brandId, processCode, calendarType,
}));
const coverageRules = BP.map(([brandId, processCode, , overrides]) => ({
  brandProcessId: `${brandId}:${processCode}`,
  minStaff: 1,
  minAllocationPct: 20,
  ...(overrides ? { overrides } : {}),
}));

// --- Assignments -------------------------------------------------------------
// [employeeId, brandId, processCode, role, allocationPct]
// allocationPct = contribution WHEN covering that process on a day.
// Daily cap applies to roster_coverage sums, not to this config table.
const A = [
  ["aarav-mehta", "novaskin", "CS", "primary", 50], ["aarav-mehta", "novaskin", "ACC", "primary", 30], ["aarav-mehta", "novaskin", "NDR", "primary", 20],
  ["priya-nair", "pureglow", "CS", "primary", 60], ["priya-nair", "pureglow", "ACC", "primary", 40],
  ["kavya-reddy", "auracare", "CS", "primary", 60], ["kavya-reddy", "auracare", "NDR", "primary", 40],
  ["rohan-patil", "bloomessentials", "CS", "primary", 60], ["rohan-patil", "bloomessentials", "ACC", "primary", 40],
  ["sneha-kulkarni", "luxebeauty", "CS", "shared", 50],
  ["vikram-shah", "luxebeauty", "ACC", "primary", 50],
  ["ananya-iyer", "luxebeauty", "NDR", "primary", 50], ["ananya-iyer", "luxebeauty", "CS", "shared", 30],
  ["sneha-kulkarni", "luxebeauty", "ACC", "shared", 20], ["vikram-shah", "luxebeauty", "CS", "shared", 20],
  // Floater A: designated backup for every Pod A solo brand
  ["ishaan-verma", "novaskin", "CS", "backup", 50], ["ishaan-verma", "novaskin", "ACC", "backup", 30], ["ishaan-verma", "novaskin", "NDR", "backup", 20],
  ["ishaan-verma", "pureglow", "CS", "backup", 60], ["ishaan-verma", "pureglow", "ACC", "backup", 40],
  ["ishaan-verma", "auracare", "CS", "backup", 60], ["ishaan-verma", "auracare", "NDR", "backup", 40],
  ["ishaan-verma", "bloomessentials", "CS", "backup", 60], ["ishaan-verma", "bloomessentials", "ACC", "backup", 40],
  ["ishaan-verma", "luxebeauty", "CS", "backup", 50], ["ishaan-verma", "luxebeauty", "ACC", "backup", 50], ["ishaan-verma", "luxebeauty", "NDR", "backup", 50],
  // Pod B — Meera holds TWO solo brands: UrbanThread (365) + StyleNest (Sun/hol off)
  ["meera-joshi", "urbanthread", "CS", "primary", 40], ["meera-joshi", "urbanthread", "ACC", "primary", 20], ["meera-joshi", "stylenest", "CS", "primary", 40],
  ["arjun-malhotra", "modecraft", "CS", "primary", 60], ["arjun-malhotra", "modecraft", "ACC", "primary", 40],
  ["divya-pillai", "trendlane", "CS", "primary", 50], ["divya-pillai", "trendlane", "NDR", "primary", 50],
  ["kabir-singh", "chickart", "CS", "primary", 60], ["kabir-singh", "chickart", "RET", "primary", 40],
  ["naina-kapoor", "voguenest", "CS", "primary", 60], ["naina-kapoor", "voguenest", "ACC", "primary", 40],
  ["rahul-deshmukh", "luxewear", "CS", "primary", 60], ["rahul-deshmukh", "luxewear", "ACC", "shared", 20], ["sara-khan", "luxewear", "CS", "shared", 20],
  ["sara-khan", "luxewear", "ACC", "primary", 40], ["sara-khan", "luxewear", "NDR", "primary", 40],
  ["dev-patel", "urbanthread", "CS", "backup", 40], ["dev-patel", "urbanthread", "ACC", "backup", 20], ["dev-patel", "stylenest", "CS", "backup", 40],
  ["dev-patel", "modecraft", "CS", "backup", 60], ["dev-patel", "modecraft", "ACC", "backup", 40],
  ["dev-patel", "trendlane", "CS", "backup", 50], ["dev-patel", "trendlane", "NDR", "backup", 50],
  ["dev-patel", "chickart", "CS", "backup", 60], ["dev-patel", "chickart", "RET", "backup", 40],
  ["dev-patel", "voguenest", "CS", "backup", 60], ["dev-patel", "voguenest", "ACC", "backup", 40],
  ["dev-patel", "luxewear", "CS", "backup", 60], ["dev-patel", "luxewear", "ACC", "backup", 50], ["dev-patel", "luxewear", "NDR", "backup", 50],
  // Pod C
  ["aditya-rao", "fitfuel", "CS", "primary", 60], ["aditya-rao", "fitfuel", "ACC", "primary", 40],
  ["pooja-menon", "vitacore", "CS", "primary", 50], ["pooja-menon", "vitacore", "NDR", "primary", 50],
  ["kiran-bhat", "nutrinest", "CS", "primary", 60], ["kiran-bhat", "nutrinest", "RET", "primary", 40],
  ["leela-nambiar", "wellspring", "CS", "primary", 60], ["leela-nambiar", "wellspring", "ACC", "primary", 40],
  ["nikhil-verma", "activelife", "CS", "shared", 50],
  ["riya-sharma", "activelife", "CS", "shared", 30], ["riya-sharma", "activelife", "ACC", "primary", 40],
  ["varun-nair", "activelife", "NDR", "primary", 60], ["nikhil-verma", "activelife", "ACC", "shared", 20], ["riya-sharma", "activelife", "NDR", "shared", 20],
  ["tara-bhatt", "fitfuel", "CS", "backup", 60], ["tara-bhatt", "fitfuel", "ACC", "backup", 40],
  ["tara-bhatt", "vitacore", "CS", "backup", 50], ["tara-bhatt", "vitacore", "NDR", "backup", 50],
  ["tara-bhatt", "nutrinest", "CS", "backup", 60], ["tara-bhatt", "nutrinest", "RET", "backup", 40],
  ["tara-bhatt", "wellspring", "CS", "backup", 60], ["tara-bhatt", "wellspring", "ACC", "backup", 40],
  ["tara-bhatt", "activelife", "CS", "backup", 50], ["tara-bhatt", "activelife", "ACC", "backup", 40], ["tara-bhatt", "activelife", "NDR", "backup", 60],
  // Pod D — Geeta Rao is EcoLiving's sole assignee; Rashmi Iyer is its designated backup
  ["sanjay-gupta", "casabloom", "CS", "primary", 60], ["sanjay-gupta", "casabloom", "ACC", "primary", 40],
  ["anita-desai", "homeease", "CS", "primary", 50], ["anita-desai", "homeease", "NDR", "primary", 50],
  ["manoj-kumar", "dailynest", "CS", "primary", 60], ["manoj-kumar", "dailynest", "RET", "primary", 40],
  ["geeta-rao", "ecoliving", "CS", "primary", 70], ["geeta-rao", "ecoliving", "ACC", "primary", 30],
  ["farhan-sheikh", "kitchenkart", "CS", "primary", 60], ["farhan-sheikh", "kitchenkart", "ACC", "primary", 40],
  ["neha-patil", "primeliving", "CS", "primary", 50], ["neha-patil", "primeliving", "ACC", "primary", 30],
  ["amit-joshi", "primeliving", "NDR", "primary", 60], ["amit-joshi", "primeliving", "CS", "shared", 20],
  ["amit-joshi", "primeliving", "ACC", "shared", 20], ["neha-patil", "primeliving", "NDR", "shared", 20],
  ["rashmi-iyer", "casabloom", "CS", "backup", 60], ["rashmi-iyer", "casabloom", "ACC", "backup", 40],
  ["rashmi-iyer", "homeease", "CS", "backup", 50], ["rashmi-iyer", "homeease", "NDR", "backup", 50],
  ["rashmi-iyer", "dailynest", "CS", "backup", 60], ["rashmi-iyer", "dailynest", "RET", "backup", 40],
  ["rashmi-iyer", "ecoliving", "CS", "backup", 70], ["rashmi-iyer", "ecoliving", "ACC", "backup", 30],
  ["rashmi-iyer", "kitchenkart", "CS", "backup", 60], ["rashmi-iyer", "kitchenkart", "ACC", "backup", 40],
  ["rashmi-iyer", "primeliving", "CS", "backup", 50], ["rashmi-iyer", "primeliving", "ACC", "backup", 30], ["rashmi-iyer", "primeliving", "NDR", "backup", 60],
];
const assignments = A.map(([employeeId, brandId, code, role, allocationPct]) => ({
  employeeId, brandProcessId: `${brandId}:${code}`, role, allocationPct,
}));
// Eligibility = every assigned pair, plus two eligible-but-not-designated
// candidates (suggested-only in the simulator, never auto-applied).
const eligibilityMap = new Map(assignments.map((a) => [`${a.employeeId}|${a.brandProcessId}`, a]));
for (const [employeeId, bp] of [["amit-joshi", "kitchenkart:CS"], ["varun-nair", "fitfuel:CS"]]) {
  eligibilityMap.set(`${employeeId}|${bp}`, { employeeId, brandProcessId: bp });
}
const eligibility = [...eligibilityMap.values()].map(({ employeeId, brandProcessId }) => ({ employeeId, brandProcessId }));

// --- Calendar facts for December 2026 ---------------------------------------
const holidays = [{ date: "2026-12-25", name: "Christmas Day" }]; // Friday

// Baseline leaves: both are COVERABLE in the baseline (that is the point of
// the baseline — see fixtures/ for the scenarios that are not).
const leaves = [
  { employeeId: "kavya-reddy", startDate: "2026-12-10", endDate: "2026-12-11", type: "planned_leave", status: "approved" },
  { employeeId: "ishaan-verma", startDate: "2026-12-30", endDate: "2026-12-30", type: "comp_off_taken", status: "approved", earnedOn: "2026-12-25" },
];

// Previous-period context: 25-30 Nov 2026 (SIX days, enough to evaluate a
// 6-consecutive-day sequence entering December). Simplified deterministic
// fixture: everyone works 25-28 + 30 Nov, weekly off Sunday 29 Nov.
// If this context is absent at validation time, the validator must report
// BOUNDARY_UNVERIFIED instead of passing or failing the boundary check.
const tailDates = ["2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29", "2026-11-30"];
const previousContext = {
  direction: "previous",
  days: employees.flatMap((e) =>
    tailDates.map((date) => ({
      rosterId: "context-2026-11",
      employeeId: e.id,
      date,
      status: date === "2026-11-29" ? "WEEKLY_OFF" : "WORK",
    })),
  ),
};

const seed = {
  meta: {
    product: "RosterIQ",
    demoMonth: "2026-12",
    generatedBy: "scripts/build-seed.mjs — edit the blueprint there, never seed.json by hand",
    counts: {
      employees: employees.length,
      brands: brands.length,
      soloBrands: brands.filter((b) => !MULTI.has(b.id)).length,
      multiBrands: MULTI.size,
      pods: pods.length,
    },
  },
  pods,
  employees,
  brands,
  processes: [
    { code: "CS", name: "Customer Support" },
    { code: "ACC", name: "Abandoned Cart Conversions" },
    { code: "NDR", name: "Non-Delivery Report Management" },
    { code: "RET", name: "Customer Retention" },
  ],
  brandProcesses,
  coverageRules,
  assignments,
  eligibility,
  holidays,
  leaves,
  previousContext,
  // Forward context (early Jan 2027) does not exist yet: end-of-month
  // consecutive-day checks must report "pending", never "verified".
  nextContext: null,
};

out("src/lib/data/seed.json", seed);

// --- Fixtures ----------------------------------------------------------------
// Fixture 1 — structural risk (Option B kept as a fixture, NOT the baseline):
// PureGlow loses its only designated backup. The audit can then PROVE a
// shortage: CS needs 7 staff-days/week, the sole employee can supply at
// most 6 (mandatory weekly rest). This is a structural claim, not a gap claim.
out("fixtures/structural-risk-pureglow.json", {
  name: "structural-risk-pureglow",
  description: "Remove Ishaan Verma's PureGlow backup designation. Audit must prove a structural shortage before any roster is generated.",
  removeAssignments: [
    { employeeId: "ishaan-verma", brandProcessId: "pureglow:CS" },
    { employeeId: "ishaan-verma", brandProcessId: "pureglow:ACC" },
  ],
  removeEligibility: [
    { employeeId: "ishaan-verma", brandProcessId: "pureglow:CS" },
    { employeeId: "ishaan-verma", brandProcessId: "pureglow:ACC" },
  ],
  expectedAuditFinding: {
    brandProcessId: "pureglow:CS",
    requiredStaffDaysPerWeek: 7,
    maxSupplyStaffDaysPerWeek: 6,
    claimKind: "structural",
  },
});

// Fixture 2 — the unfixable stress case (stress layer, NOT baseline leaves):
// Baseline EcoLiving IS coverable (Rashmi Iyer is the designated backup).
// The stress scenario removes both people on the same date.
out("fixtures/stress-ecoliving-2026-12-14.json", {
  name: "stress-ecoliving-2026-12-14",
  description: "EcoLiving CS (ALL_365) on Monday 2026-12-14: sole assignee Geeta Rao on approved leave AND designated backup Rashmi Iyer on approved leave. No other employee is eligible. The gap is unfixable within this scenario and publish must stay blocked.",
  addLeaves: [
    { employeeId: "geeta-rao", startDate: "2026-12-14", endDate: "2026-12-14", type: "planned_leave", status: "approved" },
    { employeeId: "rashmi-iyer", startDate: "2026-12-14", endDate: "2026-12-14", type: "planned_leave", status: "approved" },
  ],
  expectedIssue: {
    code: "COVERAGE_SHORTFALL",
    severity: "mandatory",
    claimKind: "gap",
    date: "2026-12-14",
    brandId: "ecoliving",
    processCode: "CS",
    required: 1,
    actual: 0,
    message: "14 Dec 2026, EcoLiving, Customer Support: required 1, actual 0. Sole assignee Geeta Rao is on approved leave and designated backup Rashmi Iyer is also on approved leave. No other eligible employee is available. 1 staffing position uncovered.",
  },
  expectedPublish: "blocked",
});
