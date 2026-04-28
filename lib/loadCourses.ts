import fs from "node:fs/promises";
import path from "node:path";

import type { CatalogEntry, Course, OfferingRow, Semester } from "./types";

let _cache: Course[] | null = null;

export async function loadJoinedCourses(): Promise<Course[]> {
  if (_cache) return _cache;
  _cache = await _load();
  return _cache;
}

async function _load(): Promise<Course[]> {
  const root = process.cwd();
  const [catalogRaw, offeringsRaw] = await Promise.all([
    fs.readFile(path.join(root, "data", "catalog.json"), "utf8"),
    fs.readFile(path.join(root, "data", "offerings.json"), "utf8")
  ]);

  const catalog: CatalogEntry[] = JSON.parse(catalogRaw);
  const offerings: OfferingRow[] = JSON.parse(offeringsRaw);

  const byCatalogId = new Map(catalog.map((c) => [c.id, c]));

  const isUndergrad = (entry: CatalogEntry) => {
    const m = entry.courseNumber.match(/^[A-Za-z]*(\d+)/);
    return m ? parseInt(m[1], 10) <= 199 : false;
  };

  const isNotProject = (entry: CatalogEntry) =>
    !/\bprojects?\b/i.test(entry.title) && !/\bcapstone\b/i.test(entry.title);

  const isNotLab = (entry: CatalogEntry) =>
    !/\blab(oratory|s)?\b/i.test(entry.title);

  const isNotBootcamp = (entry: CatalogEntry) =>
    !/\bbootcamps?\b/i.test(entry.title);

  return offerings
    .filter((o) => !/internet|online/i.test(o.building ?? ""))
    .filter((o) => {
      const cat = byCatalogId.get(o.catalogId);
      return cat ? isUndergrad(cat) && isNotProject(cat) && isNotLab(cat) && isNotBootcamp(cat) : false;
    })
    .map((o) => {
    const cat = byCatalogId.get(o.catalogId);
    if (!cat) {
      throw new Error(`Offering ${o.id} references unknown catalogId ${o.catalogId}`);
    }
    return {
      id: String(o.id),
      code: `${cat.subject} ${cat.courseNumber}`,
      title: cat.title,
      description: cat.description,
      department: cat.department,
      interests: cat.interests,
      instructor: o.instructor,
      building: o.building,
      room: o.room,
      startTime: o.startTime,
      endTime: o.endTime,
      meetDays: o.meetDays,
      semester: o.semester as Semester
    };
  });
}

