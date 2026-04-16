import fs from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

import { inferInterestsFromCatalogEntry } from "./lib/inferInterests.mjs";

const GRAPHQL_URL = "https://berkeleytime.com/api/graphql";

const EXCLUDED_COURSE_PATTERNS = [
  /\bspecial\s+topics?\b/i,
  /\bseminar\b/i,
  /\bcolloquium\b/i,
  /\bdirected\s+study\b/i,
  /\bindependent\s+study\b/i,
  /\btopics\s+in\b/i
];

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    year: 2026,
    semester: "Spring",
    limit: 120,
    catalogOut: "data/catalog.json",
    offeringsOut: "data/offerings.json"
  };
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    const val = args[i + 1];
    if (key === "--year" && val) out.year = Number(val);
    if (key === "--semester" && val) out.semester = val;
    if (key === "--limit" && val) out.limit = Number(val);
    if (key === "--catalog-out" && val) out.catalogOut = val;
    if (key === "--offerings-out" && val) out.offeringsOut = val;
  }
  return out;
}

function normalizeSemester(semesterRaw) {
  const s = semesterRaw.toLowerCase();
  if (s === "spring") return "Spring";
  if (s === "fall") return "Fall";
  if (s === "summer") return "Summer";
  if (s === "winter") return "Winter";
  throw new Error(`Invalid semester: ${semesterRaw}`);
}

function toMeetDays(daysBooleanArray) {
  if (!Array.isArray(daysBooleanArray) || daysBooleanArray.length < 7) return "MW";
  const dayCodes = [
    "", // Sunday
    "M",
    "T",
    "W",
    "Tr",
    "F",
    "" // Saturday
  ];
  let result = "";
  for (let i = 1; i <= 5; i += 1) {
    if (daysBooleanArray[i]) result += dayCodes[i];
  }
  return result || "MW";
}

function toTimeHHMM(timeRaw) {
  if (!timeRaw || typeof timeRaw !== "string") return null;
  const m = timeRaw.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function splitLocation(locationRaw) {
  if (!locationRaw || typeof locationRaw !== "string") {
    return { building: "Unknown", room: "TBD" };
  }
  const cleaned = locationRaw.trim().replace(/\s+/g, " ");
  const parts = cleaned.split(" ");
  if (parts.length === 1) return { building: cleaned, room: "TBD" };
  const room = parts.at(-1);
  const building = parts.slice(0, -1).join(" ");
  return { building: building || "Unknown", room: room || "TBD" };
}

function buildInstructor(meeting) {
  const instructors = meeting?.instructors ?? [];
  if (!Array.isArray(instructors) || instructors.length === 0) return "Staff";
  const names = instructors
    .map((i) => [i.givenName, i.familyName].filter(Boolean).join(" ").trim())
    .filter(Boolean);
  return names[0] || "Staff";
}

async function graphql(query, variables) {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) {
    throw new Error(`GraphQL HTTP error ${res.status}`);
  }
  const payload = await res.json();
  if (payload.errors?.length) {
    throw new Error(`GraphQL error: ${payload.errors[0].message}`);
  }
  return payload.data;
}

async function scrapeCatalogRows({ year, semester, limit }) {
  const pageSize = 50;
  let page = 1;
  const rows = [];

  const query = `
    query($year:Int!, $semester:Semester!, $page:Int!, $pageSize:Int!, $filters:CatalogFilters) {
      catalogSearch(year:$year, semester:$semester, page:$page, pageSize:$pageSize, search:"", filters:$filters) {
        totalCount
        results {
          subject
          courseNumber
          number
          title
          courseTitle
          courseDescription
          description
          academicOrganizationName
          meetings {
            days
            startTime
            endTime
            location
            instructors { givenName familyName }
          }
        }
      }
    }
  `;

  while (rows.length < limit) {
    const data = await graphql(query, {
      year,
      semester,
      page,
      pageSize,
      filters: {}
    });
    const batch = data.catalogSearch.results ?? [];
    if (batch.length === 0) break;
    rows.push(...batch);
    page += 1;
  }

  return rows.slice(0, limit);
}

function joinCatalogOfferings(catalogList, offeringList) {
  const byId = new Map(catalogList.map((c) => [c.id, c]));
  return offeringList.map((o) => {
    const cat = byId.get(o.catalogId);
    return {
      id: o.id,
      code: `${cat.subject} ${cat.courseNumber}`,
      title: cat.title,
      description: cat.description,
      department: cat.department,
      interests: cat.interests,
      instructor: o.instructor,
      building: o.building,
      room: o.room,
      lat: o.lat,
      lng: o.lng,
      walkingMinutes: o.walkingMinutes,
      startTime: o.startTime,
      endTime: o.endTime,
      meetDays: o.meetDays,
      semester: o.semester
    };
  });
}

function transformRows(rows, semesterLabel) {
  const catalogMap = new Map();
  const offerings = [];
  let excludedCount = 0;
  let id = 1;

  for (const row of rows) {
    const titleText = row.title || "";
    const codeText = `${row.subject || ""} ${row.courseNumber || ""}`.trim();
    const shouldExclude = EXCLUDED_COURSE_PATTERNS.some((re) =>
      re.test(`${titleText} ${codeText}`)
    );
    if (shouldExclude) {
      excludedCount += 1;
      continue;
    }

    const meeting = row.meetings?.find((m) => m?.startTime && m?.endTime) ?? row.meetings?.[0];
    if (!meeting) continue;

    const startTime = toTimeHHMM(meeting.startTime);
    const endTime = toTimeHHMM(meeting.endTime);
    if (!startTime || !endTime) continue;

    const { building, room } = splitLocation(meeting.location);
    const subject = (row.subject || "").toUpperCase();
    const courseNumber = String(row.courseNumber ?? "").trim();
    const catalogId = `${subject}-${courseNumber}`;

    const resolvedTitle =
      row.courseTitle ||
      row.title ||
      `${subject} ${courseNumber}`.trim() ||
      "Untitled Course";

    const descriptionText =
      row.courseDescription || row.description || "Description not available.";

    if (!catalogMap.has(catalogId)) {
      catalogMap.set(catalogId, {
        id: catalogId,
        subject,
        courseNumber,
        title: resolvedTitle,
        department: row.academicOrganizationName || subject || "Unknown Department",
        interests: inferInterestsFromCatalogEntry({
          subject,
          title: resolvedTitle,
          description: descriptionText
        }),
        description: descriptionText
      });
    }

    offerings.push({
      id: String(id),
      catalogId,
      semester: semesterLabel,
      instructor: buildInstructor(meeting),
      building,
      room,
      lat: 37.8715,
      lng: -122.273,
      walkingMinutes: 8,
      startTime,
      endTime,
      meetDays: toMeetDays(meeting.days)
    });
    id += 1;
  }

  return { catalog: [...catalogMap.values()], offerings, excludedCount };
}

async function validateCourses(courses, schemaPath) {
  const schemaRaw = await fs.readFile(schemaPath, "utf8");
  const schema = JSON.parse(schemaRaw);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const valid = validate(courses);
  return {
    valid: Boolean(valid),
    errors: validate.errors ?? []
  };
}

async function main() {
  const args = parseArgs();
  const semester = normalizeSemester(args.semester);
  const semesterLabel = semester === "Spring" || semester === "Fall" ? `${semester} ${args.year}` : `${semester} ${args.year}`;

  const rows = await scrapeCatalogRows({
    year: args.year,
    semester,
    limit: args.limit
  });

  const { catalog, offerings, excludedCount } = transformRows(rows, semesterLabel);
  const joined = joinCatalogOfferings(catalog, offerings);

  const root = process.cwd();
  const schemaPath = path.join(root, "data", "courses.schema.json");
  const catalogPath = path.join(root, args.catalogOut);
  const offeringsPath = path.join(root, args.offeringsOut);

  const result = await validateCourses(joined, schemaPath);
  await fs.mkdir(path.dirname(catalogPath), { recursive: true });
  await fs.mkdir(path.dirname(offeringsPath), { recursive: true });
  await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2), "utf8");
  await fs.writeFile(offeringsPath, JSON.stringify(offerings, null, 2), "utf8");

  console.log(`Scraped rows: ${rows.length}`);
  console.log(`Excluded seminar/special-topics rows: ${excludedCount}`);
  console.log(`Catalog entries: ${catalog.length}`);
  console.log(`Offerings: ${offerings.length}`);
  console.log(`Joined rows (validated): ${joined.length}`);
  console.log(`Output: ${args.catalogOut}, ${args.offeringsOut}`);
  console.log(`Schema valid: ${result.valid ? "YES" : "NO"}`);
  if (!result.valid) {
    console.log("Validation errors (first 10):");
    for (const e of result.errors.slice(0, 10)) {
      console.log(`- ${e.instancePath || "/"} ${e.message}`);
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
