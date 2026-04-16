import { ClassHopClient } from "./ClassHopClient";
import { loadJoinedCourses } from "../lib/loadCourses";

export default async function HomePage() {
  const courses = await loadJoinedCourses();
  return <ClassHopClient initialCourses={courses} />;
}
