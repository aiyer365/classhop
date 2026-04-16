import fs from "node:fs/promises";
import path from "node:path";

import type { CatalogEntry, Course, OfferingRow, Semester } from "./types";

export async function loadJoinedCourses(): Promise<Course[]> {
  const root = process.cwd();
  const [catalogRaw, offeringsRaw] = await Promise.all([
    fs.readFile(path.join(root, "data", "catalog.json"), "utf8"),
    fs.readFile(path.join(root, "data", "offerings.json"), "utf8")
  ]);

  const catalog: CatalogEntry[] = JSON.parse(catalogRaw);
  const offerings: OfferingRow[] = JSON.parse(offeringsRaw);

  const byCatalogId = new Map(catalog.map((c) => [c.id, c]));

  return offerings.map((o) => {
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
      lat: o.lat,
      lng: o.lng,
      walkingMinutes: o.walkingMinutes,
      startTime: o.startTime,
      endTime: o.endTime,
      meetDays: o.meetDays,
      semester: o.semester as Semester
    };
  });
}
