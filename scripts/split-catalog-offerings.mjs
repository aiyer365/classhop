/**
 * One-off / utility: split legacy flat courses.json into catalog.json + offerings.json.
 * Usage: node scripts/split-catalog-offerings.mjs
 */
import fs from "node:fs";

const root = process.cwd();
const coursesPath = `${root}/data/courses.json`;
const catalogPath = `${root}/data/catalog.json`;
const offeringsPath = `${root}/data/offerings.json`;

const rows = JSON.parse(fs.readFileSync(coursesPath, "utf8"));

function catalogIdFromCode(code) {
  const p = code.trim().split(/\s+/);
  if (p.length < 2) return code.replace(/\s+/g, "-");
  return `${p[0]}-${p.slice(1).join("-")}`;
}

const catalogMap = new Map();
for (const r of rows) {
  const cid = catalogIdFromCode(r.code);
  if (!catalogMap.has(cid)) {
    const parts = r.code.trim().split(/\s+/);
    catalogMap.set(cid, {
      id: cid,
      subject: parts[0],
      courseNumber: parts.slice(1).join(" "),
      title: r.title,
      description: r.description,
      department: r.department,
      interests: r.interests
    });
  }
}

const offerings = rows.map((r) => ({
  id: String(r.id),
  catalogId: catalogIdFromCode(r.code),
  semester: r.semester || "Spring 2026",
  instructor: r.instructor,
  building: r.building,
  room: r.room,
  lat: r.lat,
  lng: r.lng,
  walkingMinutes: r.walkingMinutes,
  startTime: r.startTime,
  endTime: r.endTime,
  meetDays: r.meetDays
}));

fs.writeFileSync(catalogPath, JSON.stringify([...catalogMap.values()], null, 2));
fs.writeFileSync(offeringsPath, JSON.stringify(offerings, null, 2));
console.log(`Wrote ${catalogMap.size} catalog rows, ${offerings.length} offerings.`);
