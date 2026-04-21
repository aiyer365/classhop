"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { Course, Interest, Semester } from "../lib/types";

const INTEREST_OPTIONS: Interest[] = [
  "Business & Economics",
  "Society & Politics",
  "History & Culture",
  "Health & Environment",
  "Arts & Design",
  "Science & Nature",
  "Tech & Engineering",
  "Math & Data"
];

const EARLIEST_MINUTES = 7 * 60; // 7:00 AM
const LATEST_MINUTES = 19 * 60; // 7:00 PM

type WeekdayToken = "M" | "T" | "W" | "Tr" | "F";
type TopTab = "discover" | "saved" | "editor";

const WEEKDAY_BUTTONS: { token: WeekdayToken; label: string }[] = [
  { token: "M", label: "M" },
  { token: "T", label: "T" },
  { token: "W", label: "W" },
  { token: "Tr", label: "Tr" },
  { token: "F", label: "F" }
];

function getDefaultWeekdayToken(): WeekdayToken {
  const d = new Date().getDay();
  if (d === 1) return "M";
  if (d === 2) return "T";
  if (d === 3) return "W";
  if (d === 4) return "Tr";
  if (d === 5) return "F";
  return "M";
}

function getDefaultMinutes(): number {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes >= 19 * 60 + 30 && nowMinutes <= 21 * 60) return LATEST_MINUTES;
  if (nowMinutes < EARLIEST_MINUTES || nowMinutes > LATEST_MINUTES) return EARLIEST_MINUTES;
  return Math.max(EARLIEST_MINUTES, Math.min(LATEST_MINUTES, snapToHalfHour(nowMinutes)));
}

/** Parse meetDays string (e.g. MW, TTr) into tokens; Thursday is always Tr. */
function tokenizeMeetDays(meetDays: string): WeekdayToken[] {
  const s = (meetDays || "").trim();
  const out: WeekdayToken[] = [];
  let i = 0;
  while (i < s.length) {
    if (s.slice(i, i + 2) === "Tr") {
      out.push("Tr");
      i += 2;
      continue;
    }
    const c = s[i];
    if (c === "M" || c === "T" || c === "W" || c === "F") {
      out.push(c as WeekdayToken);
    }
    i += 1;
  }
  return out;
}

function meetDaysIncludes(meetDays: string, day: WeekdayToken): boolean {
  return tokenizeMeetDays(meetDays).includes(day);
}

function parseTimeToday(time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function formatTimeRange(start: string, end: string) {
  const to12h = (t: string) => {
    const [hStr, m] = t.split(":");
    let h = Number(hStr);
    const suffix = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${m} ${suffix}`;
  };
  return `${to12h(start)} - ${to12h(end)}`;
}

function stripPrereqText(description: string): string {
  if (!description) return description;
  const compact = description.replace(/\s+/g, " ").trim();

  // Remove trailing prerequisite/corequisite notes commonly appended to catalog descriptions.
  const cutPattern =
    /\b(prerequisites?|prereqs?|prerequisite\(s\)|corequisites?|corequisite\(s\)|pre[- ]?reqs?)\b/i;
  const match = compact.match(cutPattern);
  if (!match || match.index === undefined) return compact;

  return compact.slice(0, match.index).trim().replace(/[;:,.\-–\s]+$/g, "");
}

function getDisplayDepartment(department: string, subject?: string): string {
  // For umbrella departments, resolve to the actual program by subject code
  if (department === "UG Interdisciplinary Studies") {
    const bySubject: Record<string, string> = {
      AMERSTD: "American Studies",
      MEDIAST: "Media Studies",
      DISSTD: "Disability Studies",
      ISF: "Interdisciplinary Studies",
      UGIS: "Interdisciplinary Studies",
      GWS: "Gender and Women's Studies",
      LS: "Letters and Science",
      EPS: "Earth and Planetary Science",
      UGBA: "Business Administration",
    };
    const s = (subject || "").toUpperCase();
    return bySubject[s] ?? "Interdisciplinary Studies";
  }

  const map: Record<string, string> = {
    // Agriculture & Resource
    "Ag & Resource Econ & Pol":        "Agricultural & Resource Economics and Policy",
    "Ag & Resource Economics":         "Agricultural & Resource Economics",
    // Ancient / Classical
    "Anc Hist Med Arc Grad Grp":       "Ancient History and Mediterranean Archaeology",
    "Ancient Greek & Roman Studies":   "Ancient Greek and Roman Studies",
    // Applied / Computational
    "Applied Sci & Tech Grad Grp":     "Applied Science and Technology",
    "Biophysics Grad Grp":             "Biophysics",
    "Buddhist Studies Grad Grp":       "Buddhist Studies",
    "Chem & Biomolecular Eng":         "Chemical and Biomolecular Engineering",
    "City & Regional Planning":        "City and Regional Planning",
    "Civil & Environmental Eng":       "Civil and Environmental Engineering",
    "Clg of Comp Data Sci & Soc":      "Computing, Data Science, and Society",
    "Comp Precision Health Grad Grp":  "Computational Precision Health",
    "Comp Social Science Grad Grp":    "Computational Social Science",
    "Comparative Biochem Grad Grp":    "Comparative Biochemistry",
    "Computational Biology Grad Grp":  "Computational Biology",
    "Data Science Undergrad Studies":  "Data Science",
    "Development Eng Grad Grp":        "Development Engineering",
    "Development Practice Grad Grp":   "Development Practice",
    "Earth & Planetary Science":       "Earth and Planetary Science",
    "East Asian Lang & Culture":       "East Asian Languages and Cultures",
    "Electrical Eng & Computer Sci":   "Electrical Engineering and Computer Sciences",
    "Electrical Eng & Computer Sci":   "Electrical Engineering and Computer Sciences",
    "Energy & Resources Group":        "Energy and Resources",
    "Env Sci, Policy, & Mgmt":         "Environmental Science, Policy, and Management",
    "European Studies Grad Grp":       "European Studies",
    "Folklore Grad Grp":               "Folklore",
    "Gender & Womens Studies":         "Gender and Women's Studies",
    "Global Metro Std Grad Grp":       "Global Metropolitan Studies",
    "Goldman School Public Policy":    "Goldman School of Public Policy",
    "Grad School of Education":        "Graduate School of Education",
    "Grad School of Journalism":       "Graduate School of Journalism",
    "Health & Medical Sci Grad Grp":   "Health and Medical Sciences",
    "IAS Teaching Program":            "Interdisciplinary Arts and Sciences",
    "Industrial Eng & Ops Research":   "Industrial Engineering and Operations Research",
    "Industrial Eng & Operations Res": "Industrial Engineering and Operations Research",
    "Industrial Eng and Ops Research": "Industrial Engineering and Operations Research",
    "Inst of Urban & Reg Dev":         "Institute of Urban and Regional Development",
    "Interdisc Social Science Pgms":   "Interdisciplinary Social Science",
    "L&S Arts & Humanities Division":  "Arts and Humanities",
    "L&S Legal Studies":               "Legal Studies",
    "Landscape Arch & Env Plan":       "Landscape Architecture and Environmental Planning",
    "Materials Science & Eng":         "Materials Science and Engineering",
    "Middle Eastern Lang & Cultures":  "Middle Eastern Languages and Cultures",
    "Molecular & Cell Biology":        "Molecular and Cell Biology",
    "Nano Sci & Eng Grad Grp":         "Nanoscience and Engineering",
    "New Media Grad Grp":              "New Media",
    "Nutritional Sciences & Tox":      "Nutritional Sciences and Toxicology",
    "Optometry & Vision Science":      "Optometry and Vision Science",
    "Other Math & Physical Sci Pgms":  "Mathematics and Physical Sciences",
    "Plant & Microbial Biology":       "Plant and Microbial Biology",
    "Rausser Clg Natural Resources":   "Rausser College of Natural Resources",
    "Scandinavian":                    "Scandinavian Studies",
    "Sci & Tech Stds Grad Grp":        "Science and Technology Studies",
    "Science & Math Educ Grad Grp":    "Science and Mathematics Education",
    "Slavic Languages & Literatures":  "Slavic Languages and Literatures",
    "South & SE Asian Studies":        "South and Southeast Asian Studies",
    "Spanish & Portuguese":            "Spanish and Portuguese",
    "Theater Dance & Perf Stds":       "Theater, Dance, and Performance Studies",
    "Vision Science Grad Grp":         "Vision Science",
  };
  return map[department] ?? department;
}

function getDisplayCollege(course: Course): string {
  const subject = (course.code.split(" ")[0] || "").toUpperCase();
  const rawDept = course.department;

  // Explicit department → college map (raw scraped department names as keys)
  const deptToCollege: Record<string, string> = {
    // Haas School of Business
    "Haas School of Business":            "Haas School of Business",

    // College of Chemistry
    "Chemistry":                          "College of Chemistry",
    "Chem & Biomolecular Eng":            "College of Chemistry",

    // College of Engineering
    "Bioengineering":                     "College of Engineering",
    "Civil & Environmental Eng":          "College of Engineering",
    "Electrical Eng & Computer Sci":      "College of Engineering",
    "Engineering":                        "College of Engineering",
    "Industrial Eng & Ops Research":      "College of Engineering",
    "Industrial Eng & Operations Res":    "College of Engineering",
    "Industrial Eng and Ops Research":    "College of Engineering",
    "Materials Science & Eng":            "College of Engineering",
    "Mechanical Engineering":             "College of Engineering",
    "Nuclear Engineering":                "College of Engineering",

    // College of Computing, Data Science & Society (CDSS)
    "Clg of Comp Data Sci & Soc":         "College of Computing, Data Science & Society",
    "Data Science Undergrad Studies":     "College of Computing, Data Science & Society",
    "School of Information":              "School of Information",

    // College of Environmental Design
    "Architecture":                       "College of Environmental Design",
    "City & Regional Planning":           "College of Environmental Design",
    "Landscape Arch & Env Plan":          "College of Environmental Design",
    "Inst of Urban & Reg Dev":            "College of Environmental Design",

    // Rausser College of Natural Resources
    "Env Sci, Policy, & Mgmt":            "Rausser College of Natural Resources",
    "Plant & Microbial Biology":          "Rausser College of Natural Resources",
    "Nutritional Sciences & Tox":         "Rausser College of Natural Resources",
    "Rausser Clg Natural Resources":      "Rausser College of Natural Resources",
    "Ag & Resource Economics":            "Rausser College of Natural Resources",
    "Ag & Resource Econ & Pol":           "Rausser College of Natural Resources",
    "Energy & Resources Group":           "Rausser College of Natural Resources",

    // Professional schools
    "School of Public Health":            "School of Public Health",
    "Goldman School Public Policy":       "Goldman School of Public Policy",
    "School of Optometry":                "School of Optometry",
    "Optometry & Vision Science":         "School of Optometry",
    "School of Social Welfare":           "School of Social Welfare",
    "Grad School of Education":           "Graduate School of Education",
    "Berkeley School of Education":       "Graduate School of Education",
    "Grad School of Journalism":          "Graduate School of Journalism",
  };

  if (deptToCollege[rawDept]) return deptToCollege[rawDept];

  // Subject-code overrides for ambiguous departments
  const subjectToCollege: Record<string, string> = {
    AEROENG:  "College of Engineering",
    MECENG:   "College of Engineering",
    ENGIN:    "College of Engineering",
    UGBA:     "Haas School of Business",
    ARCH:     "College of Environmental Design",
    CYPLAN:   "College of Environmental Design",
    LDARCH:   "College of Environmental Design",
    ESPM:     "Rausser College of Natural Resources",
    PLANTBI:  "Rausser College of Natural Resources",
    ENVECON:  "Rausser College of Natural Resources",
    NUSCTX:   "Rausser College of Natural Resources",
    COMPSCI:  "College of Computing, Data Science & Society",
    DATA:     "College of Computing, Data Science & Society",
    STAT:     "College of Computing, Data Science & Society",
    CDSS:     "College of Computing, Data Science & Society",
    INFO:     "School of Information",
    PBHLTH:   "School of Public Health",
    GPP:      "Goldman School of Public Policy",
    OPTOM:    "School of Optometry",
    EDUC:     "Graduate School of Education",
    JOURN:    "Graduate School of Journalism",
  };

  if (subjectToCollege[subject]) return subjectToCollege[subject];

  // Everything else is College of Letters & Science
  return "College of Letters & Science";
}

function formatInstructor(instructor: string): string {
  if (!instructor || instructor.trim().length === 0) return "Staff";
  if (/^(Prof\.|Professor\b)/i.test(instructor)) return instructor;
  return `Prof. ${instructor}`;
}

function rateMyProfessorSearchUrl(name: string): string {
  const UC_BERKELEY_RMP_SCHOOL_ID = "1072";
  return `https://www.ratemyprofessors.com/search/professors/${UC_BERKELEY_RMP_SCHOOL_ID}?q=${encodeURIComponent(
    name.trim()
  )}`;
}

function InstructorWithRmpLink({ instructor }: { instructor: string }) {
  const formatted = formatInstructor(instructor);
  if (formatted === "Staff") return <>{formatted}</>;
  const m = formatted.match(/^(Prof\.|Professor)\s+(.+)$/i);
  if (m) {
    const url = rateMyProfessorSearchUrl(m[2]);
    return (
      <>
        {m[1]}{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" className="card-instructor-link">
          {m[2]}
        </a>
      </>
    );
  }
  const url = rateMyProfessorSearchUrl(formatted);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="card-instructor-link">
      {formatted}
    </a>
  );
}

function getCourseSemester(course: Course): Semester {
  return course.semester ?? "Spring 2026";
}

/** Scraped schedule text often drops “Hall” / “Building”; normalize for display and maps. */
function formatBuildingLabel(raw: string): string {
  const key = raw.trim().replace(/\s+/g, " ");
  if (!key) return raw;

  const map: Record<string, string> = {
    "Anthro/Art Practice Bldg": "Anthro/Art Practice Building",
    Barker: "Barker Hall",
    Birge: "Birge Hall",
    Blum: "Blum Hall",
    Cheit: "Cheit Hall",
    "Chou Hall N540 and": "Chou Hall",
    Cory: "Cory Hall",
    Dwinelle: "Dwinelle Hall",
    Etcheverry: "Etcheverry Hall",
    Evans: "Evans Hall",
    GSPP: "Goldman School of Public Policy",
    "Genetics & Plant Bio": "Genetics & Plant Biology Building",
    "Haas Faculty Wing": "Haas Faculty Wing",
    "Hearst Field Annex": "Hearst Field Annex",
    "Hearst Mining": "Hearst Mining Building",
    Hertz: "Hertz Hall",
    "Internet/Online": "Internet/Online",
    "Jacobs Hall": "Jacobs Hall",
    "Joan and Sanford I. Weill": "Joan and Sanford I. Weill Hall",
    Latimer: "Latimer Hall",
    Lewis: "Lewis Hall",
    "Li Ka Shing": "Li Ka Shing Center",
    Morgan: "Morgan Hall",
    Morrison: "Morrison Hall",
    Mulford: "Mulford Hall",
    Off: "Off",
    "Physics Building": "Physics Building",
    Pimentel: "Pimentel Hall",
    "Social Sciences Building": "Social Sciences Building",
    Soda: "Soda Hall",
    Stanley: "Stanley Hall",
    Unknown: "Unknown",
    "Valley Life Sciences": "Valley Life Sciences Building",
    Wheeler: "Wheeler Hall",
    Wurster: "Wurster Hall"
  };

  if (map[key]) return map[key];

  if (
    /\b(Hall|Building|Bldg|Annex|Center|Wing|Plaza|Tower|House|Laboratory|Lab)\b/i.test(key)
  ) {
    return key;
  }

  return key;
}

function buildMapsUrl(building: string) {
  const label = formatBuildingLabel(building);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${label}, UC Berkeley`
  )}`;
}

const BERKELEY_TZ = "America/Los_Angeles";

/** Today’s calendar date in Berkeley (for correct local class times). */
function getBerkeleyYmd(now: Date): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: BERKELEY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = fmt.formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  return { y, m, d };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** ISO weekday for recurrence math: Mon=1 … Sun=7 (same as Temporal PlainDate.dayOfWeek). */
function tokenToIsoWeekday(t: WeekdayToken): number {
  const map: Record<WeekdayToken, number> = { M: 1, T: 2, W: 3, Tr: 4, F: 5 };
  return map[t];
}

function isoWeekdayMon1Sun7ForBerkeleyYmd(y: number, m: number, d: number): number {
  const PlainDate = globalThis.Temporal?.PlainDate;
  if (PlainDate) {
    return PlainDate.from({ year: y, month: m, day: d }).dayOfWeek;
  }
  for (let h = 0; h < 24; h += 1) {
    const trial = new Date(Date.UTC(y, m - 1, d, h, 0, 0));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: BERKELEY_TZ,
      year: "numeric",
      month: "numeric",
      day: "numeric"
    }).formatToParts(trial);
    const yy = Number(parts.find((p) => p.type === "year")?.value);
    const mm = Number(parts.find((p) => p.type === "month")?.value);
    const dd = Number(parts.find((p) => p.type === "day")?.value);
    if (yy !== y || mm !== m || dd !== d) continue;
    const short = new Intl.DateTimeFormat("en-US", {
      timeZone: BERKELEY_TZ,
      weekday: "short"
    }).format(trial);
    const map: Record<string, number> = { Sun: 7, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[short] ?? 1;
  }
  const local = new Date(y, m - 1, d);
  const js = local.getDay();
  return js === 0 ? 7 : js;
}

/**
 * Next time this section meets in Berkeley civil time: first day on/after “now” in LA
 * whose weekday is in meetDays (e.g. MW + Sunday → Monday; MWF + Wednesday → Wednesday same day).
 */
function nextSessionBerkeleyYmd(meetDays: string, ref: Date): { y: number; m: number; d: number } {
  const tokens = tokenizeMeetDays(meetDays);
  const start = getBerkeleyYmd(ref);
  if (tokens.length === 0) {
    return start;
  }

  const want = new Set(tokens.map(tokenToIsoWeekday));
  const seen = new Set<string>();

  for (let i = 0; i < 56; i += 1) {
    const probe = new Date(ref.getTime() + i * 24 * 60 * 60 * 1000);
    const { y, m, d } = getBerkeleyYmd(probe);
    const key = `${y}-${m}-${d}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const dow = isoWeekdayMon1Sun7ForBerkeleyYmd(y, m, d);
    if (want.has(dow)) {
      return { y, m, d };
    }
  }

  return start;
}

/** Google Calendar template: dates are wall-clock times with ctz (Berkeley). */
function buildGoogleCalendarTemplateUrl(course: Course, repeat: "once" | "weekly"): string {
  const { y, m, d } = nextSessionBerkeleyYmd(course.meetDays || "", new Date());
  const ymd = `${y}${pad2(m)}${pad2(d)}`;
  const [sh, sm] = course.startTime.split(":").map(Number);
  const [eh, em] = course.endTime.split(":").map(Number);
  let endH = eh;
  let endM = em;
  const startMin = sh * 60 + sm;
  let endMin = endH * 60 + endM;
  if (endMin <= startMin) {
    endMin = startMin + 60;
    endH = Math.floor(endMin / 60);
    endM = endMin % 60;
  }

  const startSeg = `${ymd}T${pad2(sh)}${pad2(sm)}00`;
  const endSeg = `${ymd}T${pad2(endH)}${pad2(endM)}00`;
  const dates = `${startSeg}/${endSeg}`;

  const title = `${course.title} (${course.code})`;
  const location =
    `${formatBuildingLabel(course.building)}` +
    (course.room && course.room !== "TBD" ? `, Room ${course.room}` : "");

  const descLines = [
    stripPrereqText(course.description),
    course.instructor && course.instructor !== "Staff" ? `Instructor: ${course.instructor}` : "",
    course.meetDays ? `Scheduled meet pattern: ${course.meetDays}` : "",
    getCourseSemester(course) ? `Term: ${getCourseSemester(course)}` : "",
    "",
    repeat === "once"
      ? "One-time event. Adjust repeat or end date in Google Calendar if needed."
      : "Weekly recurrence suggested from ClassHop. Confirm repeat and end date in Google Calendar before saving."
  ].filter((line) => line !== "");
  const details = descLines.join("\n").slice(0, 3800);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates,
    details,
    location,
    ctz: BERKELEY_TZ
  });

  if (repeat === "weekly") {
    const byDay = meetDaysToRfcByDay(tokenizeMeetDays(course.meetDays));
    if (byDay) {
      params.set("recur", `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`);
    }
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function meetDaysToRfcByDay(tokens: WeekdayToken[]): string | null {
  const map: Record<WeekdayToken, string> = {
    M: "MO",
    T: "TU",
    W: "WE",
    Tr: "TH",
    F: "FR"
  };
  const days = [...new Set(tokens.map((t) => map[t]).filter(Boolean))];
  if (days.length === 0) return null;
  return days.join(",");
}

function openGoogleCalendar(course: Course, repeat: "once" | "weekly") {
  const url = buildGoogleCalendarTemplateUrl(course, repeat);
  window.open(url, "_blank", "noopener,noreferrer");
}

function downloadJsonFile(filename: string, data: unknown) {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], {
    type: "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function snapToHalfHour(totalMinutes: number): number {
  let total = totalMinutes;
  const remainder = totalMinutes % 30;
  if (remainder < 15) total -= remainder;
  else total += 30 - remainder;
  return total;
}

function minutesToTime24(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatMinutes12h(totalMinutes: number): string {
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function ClassHopClient({ initialCourses }: { initialCourses: Course[] }) {
  const allCourses = useMemo(
    () =>
      initialCourses.map((c) => ({
        ...c,
        id: String(c.id),
        meetDays: c.meetDays ?? "MW"
      })),
    [initialCourses]
  );

  const [semester, setSemester] = useState<Semester>("Spring 2026");
  const [topTab, setTopTab] = useState<TopTab>("discover");
  const [selectedWeekday, setSelectedWeekday] = useState<WeekdayToken>(getDefaultWeekdayToken);
  const [selectedMinutes, setSelectedMinutes] = useState(getDefaultMinutes);
  const [usingNow, setUsingNow] = useState(true);
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>([]);
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [lastPool, setLastPool] = useState<Course[]>([]);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;
  const [hasSearched, setHasSearched] = useState(false);
  const [sortCol, setSortCol] = useState<"title" | "code" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [pendingCalendarCourse, setPendingCalendarCourse] = useState<Course | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set<string>();
    try {
      const raw = localStorage.getItem("classhop-saved");
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch { return new Set<string>(); }
  });

  useEffect(() => {
    localStorage.setItem("classhop-saved", JSON.stringify([...savedIds]));
  }, [savedIds]);

  const savedCourses = useMemo(
    () => allCourses.filter((c) => savedIds.has(c.id)),
    [allCourses, savedIds]
  );

  function toggleSave(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selectedTime24 = useMemo(
    () => minutesToTime24(selectedMinutes),
    [selectedMinutes]
  );

  function shouldUseNow(weekday: WeekdayToken, minutes: number): boolean {
    return weekday === getDefaultWeekdayToken() && minutes === getDefaultMinutes();
  }

  const filteredCourses = useMemo(() => {
    if (!selectedTime24) return [];
    const selectedMoment = parseTimeToday(selectedTime24);
    return allCourses.filter((course) => {
      if (getCourseSemester(course) !== semester) return false;
      if (!meetDaysIncludes(course.meetDays, selectedWeekday)) return false;
      if (selectedInterests.length > 0) {
        const intersects = course.interests.some((i) => selectedInterests.includes(i));
        if (!intersects) return false;
      }
      const cStart = parseTimeToday(course.startTime);
      const cEnd = parseTimeToday(course.endTime);
      const startMatches =
        cStart.getHours() === selectedMoment.getHours() &&
        cStart.getMinutes() === selectedMoment.getMinutes();
      const inSession =
        selectedMoment.getTime() >= cStart.getTime() &&
        selectedMoment.getTime() < cEnd.getTime();
      const hasThirtyMinutesLeft =
        inSession && cEnd.getTime() - selectedMoment.getTime() >= 30 * 60 * 1000;
      return startMatches || hasThirtyMinutesLeft;
    });
  }, [allCourses, selectedTime24, selectedInterests, semester, selectedWeekday]);

  const uniqueCourseCount = useMemo(
    () => new Set(allCourses.map((course) => course.code)).size,
    [allCourses]
  );
  const semesterCourses = useMemo(
    () => allCourses.filter((course) => getCourseSemester(course) === semester),
    [allCourses, semester]
  );
  const dayMatchedCourses = useMemo(
    () => semesterCourses.filter((course) => meetDaysIncludes(course.meetDays, selectedWeekday)),
    [semesterCourses, selectedWeekday]
  );
  const interestMatchedCourses = useMemo(() => {
    if (selectedInterests.length === 0) return dayMatchedCourses;
    return dayMatchedCourses.filter((course) =>
      course.interests.some((interest) => selectedInterests.includes(interest))
    );
  }, [dayMatchedCourses, selectedInterests]);

  function handleNow() {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let nextMinutes: number;

    // If current time is 7:30 PM to 9:00 PM, pin to 7:00 PM.
    if (nowMinutes >= 19 * 60 + 30 && nowMinutes <= 21 * 60) {
      nextMinutes = LATEST_MINUTES;
    } else if (nowMinutes < EARLIEST_MINUTES || nowMinutes > LATEST_MINUTES) {
      // Any other out-of-range time maps to 7:00 AM.
      nextMinutes = EARLIEST_MINUTES;
    } else {
      nextMinutes = snapToHalfHour(nowMinutes);
      nextMinutes = Math.max(EARLIEST_MINUTES, Math.min(LATEST_MINUTES, nextMinutes));
    }

    setSelectedMinutes(nextMinutes);
    setSelectedWeekday(getDefaultWeekdayToken());
    setUsingNow(shouldUseNow(getDefaultWeekdayToken(), nextMinutes));
  }

  function toggleInterest(interest: Interest) {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  }

  const sortedPool = useMemo(() => {
    setPage(0);
    if (!sortCol) return lastPool;
    return [...lastPool].sort((a, b) => {
      let va: string, vb: string;
      if (sortCol === "title") {
        va = a.title; vb = b.title;
      } else {
        va = a.code.split(" ")[0]; vb = b.code.split(" ")[0];
      }
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [lastPool, sortCol, sortDir]);

  function handleSort(col: "title" | "code") {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function splatterPool(courses: Course[]): Course[] {
    const PER_BUCKET = 3;
    const seen = new Set<string>();
    const result: Course[] = [];
    for (const interest of INTEREST_OPTIONS) {
      const bucket = courses
        .filter((c) => c.interests.includes(interest))
        .sort(() => Math.random() - 0.5)
        .slice(0, PER_BUCKET);
      for (const course of bucket) {
        if (!seen.has(course.id)) {
          seen.add(course.id);
          result.push(course);
        }
      }
    }
    return result;
  }

  function handleFindClass() {
    setCurrentCourse(null);
    setHasSearched(true);
    setPage(0);
    setLastPool(
      selectedInterests.length === 0 ? splatterPool(filteredCourses) : filteredCourses
    );
  }

  function handleDownloadDatabase() {
    downloadJsonFile("classhop-joined-courses.json", allCourses);
  }

  return (
    <>
      <style jsx global>{`
        :root { --navy:#002855; --navy-light:#0a3d6b; --gold:#fdb515; --gold-dim:#c98e00; --cream:#f8f5ef; --cream-dark:#ede8de; --text:#1a1612; --muted:#6b6356; --border:rgba(0,40,85,0.14); --chip-bg:#fff; --font-display:var(--font-fraunces),Georgia,serif; --font-body:var(--font-dm-sans),system-ui,sans-serif; --font-mono:var(--font-dm-mono),monospace; --radius-sm:6px; --radius-md:12px; --radius-pill:999px;}
        .redesign-root,.redesign-root *{box-sizing:border-box}.redesign-root{min-height:100vh;display:flex;flex-direction:column;background:var(--cream);color:var(--text);font-family:var(--font-body)}
        .redesign-root nav{display:flex;align-items:center;justify-content:space-between;padding:1.125rem 2.5rem;border-bottom:1px solid var(--border);background:var(--cream);position:sticky;top:0;z-index:10}
        .logo{display:flex;align-items:center;gap:.5rem;text-decoration:none}.logo-mark{width:32px;height:32px;background:var(--navy);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center}.logo-wordmark{font-weight:500;font-size:1rem;color:var(--navy);letter-spacing:-.01em}
        .header-right{display:flex;align-items:center;gap:.75rem}
        .top-tabs{display:flex;align-items:center;gap:2px;border:1px solid var(--border);border-radius:var(--radius-pill);background:rgba(0,40,85,.03);padding:3px}
        .top-tab-btn{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.04em;color:var(--muted);background:transparent;border:none;border-radius:var(--radius-pill);padding:.3rem .75rem;cursor:pointer}
        .top-tab-btn.active{background:#fff;color:var(--text);box-shadow:0 1px 3px rgba(0,40,85,.1)}
        .semester-toggle{display:flex;align-items:center;gap:2px;border:1px solid var(--border);border-radius:var(--radius-pill);background:rgba(0,40,85,.03);padding:3px}
        .semester-btn{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.04em;color:var(--muted);background:transparent;border:none;border-radius:var(--radius-pill);padding:.3rem .75rem;cursor:pointer}.semester-btn.active{background:#fff;color:var(--text);box-shadow:0 1px 3px rgba(0,40,85,.1)}
        .redesign-main{flex:1;max-width:680px;width:100%;margin:0 auto;padding:0.5rem 2rem 6rem}.eyebrow{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-dim);margin-bottom:1.5rem}
        .hero-title{font-family:var(--font-display);font-size:clamp(2.6rem,6vw,3.75rem);font-weight:300;line-height:1.08;color:var(--navy);letter-spacing:-.02em;margin-bottom:.75rem}.subheadline{font-family:var(--font-display);font-size:clamp(1.3rem,3vw,1.6rem);font-weight:300;font-style:italic;color:var(--gold-dim);margin-bottom:1.75rem}.description{font-size:1rem;line-height:1.75;color:var(--muted);max-width:520px;margin-bottom:3.5rem}
        .divider{height:1px;background:var(--border);margin:3rem 0}.form-section{margin-bottom:2.5rem}.section-label{display:flex;align-items:center;gap:.75rem;margin-bottom:1rem}.step-number{font-family:var(--font-mono);font-size:.65rem;color:var(--gold-dim);background:rgba(253,181,21,.12);border:1px solid rgba(253,181,21,.3);border-radius:var(--radius-pill);padding:.2rem .6rem;letter-spacing:.06em}.section-title{font-family:var(--font-display);font-size:1.35rem;font-weight:300;letter-spacing:-.01em;text-transform:none;color:var(--navy)}
        .when-section{display:grid;grid-template-columns:1fr auto;grid-template-rows:auto auto;column-gap:1.25rem;row-gap:.75rem}.when-section .section-label{grid-column:1;grid-row:1;align-self:center;margin-bottom:0}.when-section .time-row{grid-column:1/-1;grid-row:2}.when-section .day-strip{grid-column:2;grid-row:1;align-self:center}
        .day-strip{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:.45rem}.day-btn{font-family:var(--font-body);font-size:.9rem;border:1px solid var(--border);background:var(--chip-bg);color:var(--text);padding:.55rem 1rem;border-radius:var(--radius-pill);cursor:pointer}.day-btn.active{background:var(--navy);color:var(--gold);border-color:var(--navy)}
        .time-row{display:flex;align-items:center;gap:.8rem}.time-btn,.chip{font-family:var(--font-body);font-size:.9rem;border:1px solid var(--border);background:var(--chip-bg);color:var(--text);padding:.55rem 1rem;border-radius:var(--radius-pill);cursor:pointer}.time-btn.active,.chip.active{background:var(--navy);color:var(--gold);border-color:var(--navy)}
        .time-slider-wrap{flex:1;display:flex;align-items:center;gap:.75rem;min-width:220px}.time-slider{flex:1;appearance:none;height:6px;border-radius:999px;background:rgba(0,40,85,.15);outline:none}.time-slider::-webkit-slider-thumb{appearance:none;width:16px;height:16px;border-radius:50%;background:var(--navy);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);cursor:pointer}.time-slider::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:var(--navy);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);cursor:pointer}
        .time-readout{font-family:var(--font-mono);font-size:.78rem;color:var(--muted);min-width:72px;text-align:right}
        .chips{display:flex;flex-wrap:wrap;gap:.5rem}.cta-wrapper{margin-top:3rem}.cta-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:.75rem;background:var(--navy);color:var(--gold);border:none;border-radius:var(--radius-md);padding:1.05rem 2rem;font-family:var(--font-mono);font-size:.8rem;letter-spacing:.2em;text-transform:uppercase;cursor:pointer}.cta-btn:disabled{opacity:.6;cursor:not-allowed}
        .prominent-message{text-align:center;font-family:var(--font-display);font-size:clamp(1.35rem,3.6vw,1.9rem);line-height:1.28;color:var(--navy);letter-spacing:-.01em}.prominent-message--form{margin-top:3rem}.prominent-message--result{margin-top:1.25rem}.result-section{margin-top:3rem}.result-label{font-family:var(--font-mono);font-size:.65rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:1rem}
        .course-card{background:#fff;border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden}.card-body{padding:1.5rem 1.75rem}.card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;margin-bottom:1rem}.card-college{font-family:var(--font-display);font-size:1.2rem;line-height:1.25;color:var(--navy);margin:0 0 .3rem}.card-dept{font-family:var(--font-mono);font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
        .card-time-badge{font-family:var(--font-mono);font-size:.7rem;color:var(--gold-dim);background:rgba(253,181,21,.12);border:1px solid rgba(253,181,21,.3);border-radius:var(--radius-pill);padding:.25rem .7rem;white-space:nowrap}.card-title{font-family:var(--font-display);font-size:clamp(1.3rem,3vw,1.65rem);font-weight:300;line-height:1.2;color:var(--navy);margin-bottom:.4rem}
        .card-meta,.card-desc{color:var(--muted);font-size:.86rem;line-height:1.65;margin-bottom:1rem}.card-instructor-link{color:var(--navy);text-decoration:none;font-weight:500;border-bottom:1px solid rgba(0,40,85,.25)}.card-instructor-link:hover{border-bottom-color:var(--navy)}.card-divider{height:1px;background:var(--border);margin:1.25rem 0}.card-location{margin-bottom:1.25rem}.card-location a{color:var(--navy);text-decoration:none;font-weight:500;border-bottom:1px solid rgba(0,40,85,.25)}.card-location a:hover{border-bottom-color:var(--navy)}
        .card-tags{display:flex;flex-wrap:wrap;gap:.4rem}.card-tag{font-family:var(--font-body);font-size:.72rem;letter-spacing:0;text-transform:none;color:var(--muted);background:var(--cream);border:1px solid var(--border);border-radius:var(--radius-pill);padding:.25rem .65rem}
        .card-actions{display:flex;justify-content:flex-end;gap:.6rem;padding:1rem 1.75rem;border-top:1px solid var(--border);background:var(--cream)}.btn-secondary,.btn-primary{font-family:var(--font-mono);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;border-radius:var(--radius-sm);padding:.6rem 1.1rem;cursor:pointer}.btn-secondary{color:var(--navy);background:transparent;border:1px solid var(--border)}.btn-primary{color:var(--gold);background:var(--navy);border:1px solid var(--navy)}
        .save-btn{background:none;border:none;cursor:pointer;padding:.25rem .4rem;line-height:1;color:var(--muted);opacity:.4;transition:opacity 120ms,color 120ms;vertical-align:middle}.save-btn:hover{opacity:1;color:var(--gold-dim)}.save-btn.is-saved{color:var(--gold-dim);opacity:1}
        .saved-badge{display:inline-flex;align-items:center;justify-content:center;background:var(--gold);color:var(--navy);border-radius:var(--radius-pill);font-size:.55rem;font-weight:700;min-width:14px;height:14px;padding:0 3px;margin-left:4px;line-height:1}
        .saved-empty{text-align:center;padding:4rem 2rem;color:var(--muted);font-family:var(--font-display);font-size:1.1rem;font-weight:300;font-style:italic}
        .results-table-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-md)}
        .results-table{width:100%;border-collapse:collapse;background:#fff}
        .results-table thead tr{background:var(--navy)}
        .results-table thead th{font-family:var(--font-mono);font-size:.63rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);padding:.75rem 1rem;text-align:left;font-weight:400;white-space:nowrap}
        .results-table thead th.sortable{cursor:pointer;user-select:none}
        .results-table thead th.sortable:hover{color:#fff}
        .sort-arrow{margin-left:.35rem;opacity:.7}
        .results-table tbody tr{cursor:pointer;border-top:1px solid var(--border);transition:background 100ms}
        .results-table tbody tr:hover{background:rgba(0,40,85,.05)}
        .results-table td{padding:.65rem 1rem;vertical-align:middle}
        .rt-code{font-family:var(--font-mono);font-size:.7rem;color:var(--muted);white-space:nowrap}
        .rt-title{font-size:.85rem;font-weight:500;color:var(--navy)}
        .rt-instructor{font-size:.82rem;color:var(--muted);white-space:nowrap}
        .rt-time{font-family:var(--font-mono);font-size:.7rem;color:var(--muted);white-space:nowrap}
        .rt-location{font-size:.8rem;color:var(--muted)}
        .rt-tags{display:flex;flex-wrap:wrap;gap:.25rem}
        .rt-tag{font-size:.65rem;color:var(--muted);background:var(--cream);border:1px solid var(--border);border-radius:var(--radius-pill);padding:.15rem .5rem;white-space:nowrap}
        .result-count{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.1em;color:var(--muted);margin-bottom:.75rem}
        .results-table tbody tr.row-active{background:rgba(0,40,85,.06)}
        .results-table tbody tr.row-active td{border-bottom:none}
        .expanded-row>td{padding:0;border-bottom:2px solid var(--border)}
        .expanded-card-wrap{padding:1.5rem 2rem;background:rgba(0,40,85,.025);border-top:2px solid rgba(0,40,85,.1)}
        .expanded-card-wrap .course-card{width:100%}
        .editor-panel{background:#fff;border:1px solid var(--border);border-radius:var(--radius-md);padding:1.25rem 1.5rem;margin-top:1.5rem}
        .editor-title{font-family:var(--font-mono);font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:1rem}
        .editor-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem}
        .editor-stat{border:1px solid var(--border);border-radius:var(--radius-sm);padding:.75rem .85rem;background:var(--cream)}
        .editor-stat-label{font-family:var(--font-mono);font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:.4rem}
        .editor-stat-value{font-family:var(--font-display);font-size:1.5rem;line-height:1;color:var(--navy)}
        .editor-actions{display:flex;align-items:center;gap:.65rem;flex-wrap:wrap;margin-top:1rem}
        .editor-button{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;border-radius:var(--radius-sm);padding:.58rem .95rem;cursor:pointer;color:var(--gold);background:var(--navy);border:1px solid var(--navy)}
        .editor-note{font-size:.82rem;line-height:1.5;color:var(--muted);margin-top:.8rem}
        .cal-modal-overlay{position:fixed;inset:0;background:rgba(26,22,18,.45);z-index:40;display:flex;align-items:center;justify-content:center;padding:1.25rem}
        .cal-modal{background:#fff;border:1px solid var(--border);border-radius:var(--radius-md);max-width:420px;width:100%;padding:1.5rem 1.75rem;box-shadow:0 12px 40px rgba(0,40,85,.15)}
        .cal-modal h3{font-family:var(--font-display);font-size:1.35rem;font-weight:300;color:var(--navy);margin:0 0 .5rem}
        .cal-modal p{font-size:.88rem;line-height:1.55;color:var(--muted);margin:0 0 1.25rem}
        .cal-modal-actions{display:flex;flex-direction:column;gap:.5rem}
        .cal-modal-btn{font-family:var(--font-mono);font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;border-radius:var(--radius-sm);padding:.65rem 1rem;cursor:pointer;border:1px solid var(--border);background:var(--cream);color:var(--text)}
        .cal-modal-btn--primary{background:var(--navy);color:var(--gold);border-color:var(--navy)}
        .cal-modal-btn--ghost{background:transparent;color:var(--muted)}
        .cal-modal-btn:disabled{opacity:.45;cursor:not-allowed}
        .redesign-root footer{border-top:1px solid var(--border);padding:1.25rem 2.5rem;display:flex;justify-content:space-between;background:var(--cream)}.footer-left{display:flex;align-items:center;gap:.85rem}.avatar{width:30px;height:30px;background:var(--navy);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:.68rem;color:var(--gold)}.footer-note{font-family:var(--font-mono);font-size:.65rem;color:var(--muted)}

        /* Hamburger + drawer — hidden on desktop */
        .hamburger{display:none}
        .mobile-menu{display:none}

        @media(max-width:640px){
          /* ── Nav ── */
          .redesign-root nav{padding:.875rem 1.25rem;gap:.5rem}
          .header-right{gap:.4rem}
          .semester-toggle{display:none}
          .top-tabs{display:none}
          .categories-link{display:none}
          .logo-wordmark{font-size:.88rem}

          /* ── Hamburger button ── */
          .hamburger{display:flex;flex-direction:column;justify-content:center;gap:5px;background:none;border:none;cursor:pointer;padding:.3rem;margin-left:auto}
          .hamburger span{display:block;width:22px;height:2px;background:var(--navy);border-radius:2px;transition:transform 200ms,opacity 200ms}
          .hamburger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}
          .hamburger.open span:nth-child(2){opacity:0}
          .hamburger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}

          /* ── Mobile drawer ── */
          .mobile-menu{display:block;position:absolute;top:100%;left:0;right:0;background:var(--cream);border-bottom:1px solid var(--border);z-index:9;overflow:hidden;max-height:0;transition:max-height 260ms ease}
          .mobile-menu.open{max-height:280px}
          .mobile-menu-inner{padding:.75rem 1.25rem 1.25rem;display:flex;flex-direction:column;gap:.25rem}
          .mobile-nav-btn{font-family:var(--font-display);font-size:1.35rem;font-weight:300;color:var(--navy);background:none;border:none;text-align:left;padding:.6rem 0;cursor:pointer;letter-spacing:-.01em;border-bottom:1px solid var(--border)}
          .mobile-nav-btn:last-child{border-bottom:none}
          .mobile-nav-btn.active{color:var(--gold-dim)}
          .mobile-nav-link{font-family:var(--font-display);font-size:1.35rem;font-weight:300;color:var(--navy);text-decoration:none;display:block;padding:.6rem 0;border-bottom:1px solid var(--border)}

          /* ── Main ── */
          .redesign-main{padding:.75rem 1.25rem 5rem !important}
          .eyebrow{margin-bottom:1rem}
          .subheadline{margin-bottom:1.25rem}
          .description{font-size:.9rem;line-height:1.65;margin-bottom:2.5rem}
          .divider{margin:1.75rem 0}
          .form-section{margin-bottom:1.75rem}

          /* ── Form: time & day ── */
          .when-section{display:flex;flex-direction:column;align-items:flex-start}
          .when-section .section-label{order:1;width:100%}
          .when-section .time-row{order:2}
          .when-section .day-strip{order:3;justify-content:center;width:100%}
          .day-btn,.time-btn,.chip{
            font-size:.82rem;
            line-height:1;
            height:2.15rem;
            padding:.58rem .8rem;
          }
          .day-btn{flex:0 0 auto;text-align:center}
          .time-row{flex-wrap:nowrap;gap:.5rem;width:100%}
          .time-btn{flex:0 0 auto}
          .time-slider-wrap{flex:1 1 auto;min-width:0;width:100%}
          .time-slider{width:100%}
          .time-readout{min-width:56px;font-size:.72rem}
          .chips{gap:.4rem}
          .cta-wrapper{margin-top:2rem}

          /* ── Results table → stacked rows ── */
          .results-table-wrap{border-radius:var(--radius-md);overflow:hidden}
          .results-table thead{display:none}
          .results-table tbody,
          .results-table tr,
          .results-table td{display:block;width:100%}
          .results-table tbody tr{padding:.85rem 1rem;border-top:1px solid var(--border);position:relative}
          .results-table td{padding:0;border:none}
          /* hide Topic and Instructor columns on mobile */
          .results-table td:nth-child(3),
          .results-table td:nth-child(6){display:none}
          /* Code inline before title */
          .results-table td:nth-child(1){display:inline;vertical-align:middle;margin-right:.4rem}
          .results-table td:nth-child(2){display:inline;vertical-align:middle}
          /* Time and Location stacked below */
          .results-table td:nth-child(4){margin-top:.35rem}
          .results-table td:nth-child(5){margin-top:.1rem}
          .rt-title{font-size:.88rem}
          .rt-time,.rt-location{font-size:.72rem}

          /* ── Expanded card ── */
          .expanded-card-wrap{padding:.875rem 1rem}
          .card-body{padding:1.1rem 1.25rem}
          .card-top{flex-direction:column;gap:.5rem}
          .card-time-badge{align-self:flex-start}
          .card-actions{padding:.85rem 1.25rem;flex-wrap:wrap;gap:.5rem}
          .btn-secondary,.btn-primary{font-size:.68rem;padding:.55rem .85rem}

          /* ── Pagination ── */
          .pagination{margin-top:1.5rem;gap:.6rem}
          .page-btn{padding:.85rem 1.4rem;font-size:.72rem}

          /* ── Footer ── */
          .redesign-root footer{padding:1rem 1.25rem}

          /* ── Calendar modal ── */
          .cal-modal{padding:1.25rem}
        }
      `}</style>
      <div className="redesign-root">
        <nav style={{position:"relative"}}>
          <a className="logo" href="#">
            <div className="logo-mark">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <text x="16" y="21" fontFamily="Georgia" fontSize="13" fontWeight="bold" fill="#FDB515" textAnchor="middle">CH</text>
              </svg>
            </div>
            <span className="logo-wordmark">ClassHop</span>
          </a>
          <div className="header-right">
            <Link href="/categories" className="categories-link" style={{fontFamily:"var(--font-mono)",fontSize:".68rem",letterSpacing:".06em",color:"var(--muted)",textDecoration:"none",border:"1px solid var(--border)",borderRadius:"var(--radius-pill)",padding:".3rem .85rem"}}>
              Categories
            </Link>
            <div className="top-tabs">
              <button
                className={`top-tab-btn ${topTab === "discover" ? "active" : ""}`}
                onClick={() => setTopTab("discover")}
                type="button"
              >
                Discover
              </button>
              <button
                className={`top-tab-btn ${topTab === "saved" ? "active" : ""}`}
                onClick={() => setTopTab("saved")}
                type="button"
              >
                Saved{savedIds.size > 0 && <span className="saved-badge">{savedIds.size}</span>}
              </button>
              <button
                className={`top-tab-btn ${topTab === "editor" ? "active" : ""}`}
                onClick={() => setTopTab("editor")}
                type="button"
              >
                Editor
              </button>
            </div>
            <div className="semester-toggle">
              <button className={`semester-btn ${semester === "Spring 2026" ? "active" : ""}`} onClick={() => setSemester("Spring 2026")} type="button">Spring 2026</button>
              <button className={`semester-btn ${semester === "Fall 2026" ? "active" : ""}`} onClick={() => setSemester("Fall 2026")} type="button">Fall 2026</button>
            </div>
          </div>
          {/* Hamburger — mobile only */}
          <button
            className={`hamburger${menuOpen ? " open" : ""}`}
            type="button"
            aria-label="Menu"
            onClick={() => setMenuOpen(o => !o)}
          >
            <span /><span /><span />
          </button>
          {/* Mobile slide-down drawer */}
          <div className={`mobile-menu${menuOpen ? " open" : ""}`}>
            <div className="mobile-menu-inner">
              <button className={`mobile-nav-btn${topTab === "discover" ? " active" : ""}`} type="button" onClick={() => { setTopTab("discover"); setMenuOpen(false); }}>Discover</button>
              <button className={`mobile-nav-btn${topTab === "saved" ? " active" : ""}`} type="button" onClick={() => { setTopTab("saved"); setMenuOpen(false); }}>
                Saved{savedIds.size > 0 && <span className="saved-badge" style={{marginLeft:".5rem"}}>{savedIds.size}</span>}
              </button>
              <a href="/categories" className="mobile-nav-link">Categories</a>
            </div>
          </div>
        </nav>
        <main className="redesign-main" style={(lastPool.length > 0 || (topTab === "saved" && savedCourses.length > 0)) ? {maxWidth:"none",padding:"2.75rem 2.5rem 6rem"} : undefined}>
          {topTab === "discover" ? (
            <>
              <h1 className="hero-title">Got a Free Hour?</h1>
              <p className="subheadline">Wander into a class.</p>
              <p className="description">Tell us when you&apos;re free and what sparks your curiosity. We&apos;ll find a real Berkeley class happening right now that you can quietly sit in on.</p>
              <div className="divider" />
              <div className="form-section when-section">
                  <div className="section-label">
                    <span className="step-number">01</span>
                    <span className="section-title">When are you free?{"\u00a0"}</span>
                  </div>
                  <div className="time-row">
                  <button className={`time-btn ${usingNow ? "active" : ""}`} type="button" onClick={handleNow}>Now</button>
                  <div className="time-slider-wrap">
                    <input
                      className="time-slider"
                      type="range"
                      min={EARLIEST_MINUTES}
                      max={LATEST_MINUTES}
                      step={30}
                      value={selectedMinutes}
                      onChange={(e) => {
                        const snapped = snapToHalfHour(Number(e.target.value));
                        setSelectedMinutes(snapped);
                        setUsingNow(shouldUseNow(selectedWeekday, snapped));
                      }}
                    />
                    <span className="time-readout">{formatMinutes12h(selectedMinutes)}</span>
                  </div>
                </div>
                  <div className="day-strip">
                    {WEEKDAY_BUTTONS.map(({ token, label }) => (
                      <button
                        key={token}
                        type="button"
                        className={`day-btn ${selectedWeekday === token ? "active" : ""}`}
                        onClick={() => {
                          setSelectedWeekday(token);
                          setUsingNow(shouldUseNow(token, selectedMinutes));
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
              </div>
              <div className="form-section">
                <div className="section-label"><span className="step-number">02</span><span className="section-title">What are you into? <span style={{opacity:0.5}}>(optional)</span></span></div>
                <div className="chips">
                  {INTEREST_OPTIONS.map((interest) => (
                    <button key={interest} type="button" className={`chip ${selectedInterests.includes(interest) ? "active" : ""}`} onClick={() => toggleInterest(interest)}>{interest}</button>
                  ))}
                </div>
              </div>
              <div className="cta-wrapper">
                <button className="cta-btn" type="button" onClick={handleFindClass} disabled={!selectedTime24}><span>Find me a class</span></button>
              </div>
              {hasSearched && lastPool.length === 0 && (
                <div className="prominent-message prominent-message--form">
                  No classes match that combination.
                  <br />
                  Try a different day, time, or interest.
                </div>
              )}
              {lastPool.length > 0 && (
                <div className="result-section">
                  <p className="result-count">{sortedPool.length} {sortedPool.length === 1 ? "class" : "classes"} available · showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sortedPool.length)} · click a row to expand</p>
                  <div className="results-table-wrap">
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th className="sortable" onClick={() => handleSort("code")}>
                            Code <span className="sort-arrow">{sortCol === "code" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
                          </th>
                          <th className="sortable" onClick={() => handleSort("title")}>
                            Title <span className="sort-arrow">{sortCol === "title" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
                          </th>
                          <th>Topic</th>
                          <th>Time</th>
                          <th>Location</th>
                          <th>Instructor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedPool.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((course) => {
                          const isOpen = currentCourse?.id === course.id;
                          return (
                            <React.Fragment key={course.id}>
                              <tr
                                className={isOpen ? "row-active" : ""}
                                onClick={() => setCurrentCourse(isOpen ? null : course)}
                              >
                                <td><span className="rt-code">{course.code}</span></td>
                                <td><span className="rt-title">{course.title}</span></td>
                                <td>
                                  <div className="rt-tags">
                                    {course.interests.map((tag) => <span key={tag} className="rt-tag">{tag}</span>)}
                                  </div>
                                </td>
                                <td><span className="rt-time">{course.meetDays} · {formatTimeRange(course.startTime, course.endTime)}</span></td>
                                <td><span className="rt-location">{formatBuildingLabel(course.building)}{course.room && course.room !== "TBD" ? `, ${course.room}` : ""}</span></td>
                                <td><span className="rt-instructor">{formatInstructor(course.instructor)}</span></td>
                              </tr>
                              {isOpen && (
                                <tr className="expanded-row">
                                  <td colSpan={6}>
                                    <div className="expanded-card-wrap">
                                      <div className="course-card">
                                        <div className="card-body">
                                          <div className="card-top">
                                            <div>
                                              <p className="card-college">{getDisplayDepartment(course.department, course.code.split(" ")[0])}</p>
                                              <span className="card-dept">{getDisplayCollege(course)}</span>
                                            </div>
                                            <span className="card-time-badge">{course.meetDays} · {formatTimeRange(course.startTime, course.endTime)}</span>
                                          </div>
                                          <h2 className="card-title">{course.title}</h2>
                                          <p className="card-meta">{course.code} · <InstructorWithRmpLink instructor={course.instructor} /></p>
                                          <div className="card-divider" />
                                          <div className="card-location"><a href={buildMapsUrl(course.building)} target="_blank" rel="noreferrer">{formatBuildingLabel(course.building)}, Room {course.room}</a></div>
                                          <p className="card-desc">{stripPrereqText(course.description)}</p>
                                          <div className="card-tags">{course.interests.map((tag) => <span key={tag} className="card-tag">{tag}</span>)}</div>
                                        </div>
                                        <div className="card-actions">
                                          <button className="btn-secondary" type="button" onClick={(e) => toggleSave(course.id, e)}>
                                            <span style={{fontSize:"1.1rem",lineHeight:1,marginRight:".3rem"}}>{savedIds.has(course.id) ? "★" : "☆"}</span>{savedIds.has(course.id) ? "Saved" : "Save"}
                                          </button>
                                          <button className="btn-secondary" type="button" onClick={(e) => { e.stopPropagation(); setPendingCalendarCourse(course); }}>Add to Calendar</button>
                                          <button className="btn-primary" type="button" onClick={(e) => { e.stopPropagation(); setCurrentCourse(null); }}>Collapse ↑</button>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {sortedPool.length > PAGE_SIZE && (
                    <div className="pagination">
                      <button
                        className="page-btn"
                        type="button"
                        disabled={page === 0}
                        onClick={() => { setPage(p => p - 1); setCurrentCourse(null); }}
                      >← Prev</button>
                      <span className="page-info">{page + 1} / {Math.ceil(sortedPool.length / PAGE_SIZE)}</span>
                      <button
                        className="page-btn"
                        type="button"
                        disabled={(page + 1) * PAGE_SIZE >= sortedPool.length}
                        onClick={() => { setPage(p => p + 1); setCurrentCourse(null); }}
                      >Next →</button>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : topTab === "saved" ? (
            <>
              <h1 className="hero-title">Saved Classes</h1>
              <p className="subheadline">Your personal shortlist.</p>
              {savedCourses.length === 0 ? (
                <p className="saved-empty">No saved classes yet — bookmark a row from your search results.</p>
              ) : (
                <div className="result-section">
                  <p className="result-count">{savedCourses.length} saved {savedCourses.length === 1 ? "class" : "classes"} · click a row to expand</p>
                  <div className="results-table-wrap">
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Title</th>
                          <th>Topic</th>
                          <th>Time</th>
                          <th>Location</th>
                          <th>Instructor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {savedCourses.map((course) => {
                          const isOpen = currentCourse?.id === course.id;
                          return (
                            <React.Fragment key={course.id}>
                              <tr className={isOpen ? "row-active" : ""} onClick={() => setCurrentCourse(isOpen ? null : course)}>
                                <td><span className="rt-code">{course.code}</span></td>
                                <td><span className="rt-title">{course.title}</span></td>
                                <td>
                                  <div className="rt-tags">
                                    {course.interests.map((tag) => <span key={tag} className="rt-tag">{tag}</span>)}
                                  </div>
                                </td>
                                <td><span className="rt-time">{course.meetDays} · {formatTimeRange(course.startTime, course.endTime)}</span></td>
                                <td><span className="rt-location">{formatBuildingLabel(course.building)}{course.room && course.room !== "TBD" ? `, ${course.room}` : ""}</span></td>
                                <td><span className="rt-instructor">{formatInstructor(course.instructor)}</span></td>
                              </tr>
                              {isOpen && (
                                <tr className="expanded-row">
                                  <td colSpan={6}>
                                    <div className="expanded-card-wrap">
                                      <div className="course-card">
                                        <div className="card-body">
                                          <div className="card-top">
                                            <div>
                                              <p className="card-college">{getDisplayDepartment(course.department, course.code.split(" ")[0])}</p>
                                              <span className="card-dept">{getDisplayCollege(course)}</span>
                                            </div>
                                            <span className="card-time-badge">{course.meetDays} · {formatTimeRange(course.startTime, course.endTime)}</span>
                                          </div>
                                          <h2 className="card-title">{course.title}</h2>
                                          <p className="card-meta">{course.code} · <InstructorWithRmpLink instructor={course.instructor} /></p>
                                          <div className="card-divider" />
                                          <div className="card-location"><a href={buildMapsUrl(course.building)} target="_blank" rel="noreferrer">{formatBuildingLabel(course.building)}, Room {course.room}</a></div>
                                          <p className="card-desc">{stripPrereqText(course.description)}</p>
                                          <div className="card-tags">{course.interests.map((tag) => <span key={tag} className="card-tag">{tag}</span>)}</div>
                                        </div>
                                        <div className="card-actions">
                                          <button className="btn-secondary" type="button" onClick={(e) => toggleSave(course.id, e)}>
                                            <span style={{fontSize:"1.1rem",lineHeight:1,marginRight:".3rem"}}>★</span>Remove
                                          </button>
                                          <button className="btn-secondary" type="button" onClick={(e) => { e.stopPropagation(); setPendingCalendarCourse(course); }}>Add to Calendar</button>
                                          <button className="btn-primary" type="button" onClick={(e) => { e.stopPropagation(); setCurrentCourse(null); }}>Collapse ↑</button>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <h1 className="hero-title">Editor tools</h1>
              <p className="description">Quick testing stats about the currently loaded database.</p>
              <div className="editor-panel">
                <p className="editor-title">Dataset stats</p>
                <div className="editor-grid">
                  <div className="editor-stat">
                    <p className="editor-stat-label">Classes in database</p>
                    <p className="editor-stat-value">{allCourses.length.toLocaleString()}</p>
                  </div>
                  <div className="editor-stat">
                    <p className="editor-stat-label">Unique course codes</p>
                    <p className="editor-stat-value">{uniqueCourseCount.toLocaleString()}</p>
                  </div>
                  <div className="editor-stat">
                    <p className="editor-stat-label">Current filtered matches</p>
                    <p className="editor-stat-value">{filteredCourses.length.toLocaleString()}</p>
                  </div>
                  <div className="editor-stat">
                    <p className="editor-stat-label">Current semester</p>
                    <p className="editor-stat-value">{semester}</p>
                  </div>
                  <div className="editor-stat">
                    <p className="editor-stat-label">Semester matches</p>
                    <p className="editor-stat-value">{semesterCourses.length.toLocaleString()}</p>
                  </div>
                  <div className="editor-stat">
                    <p className="editor-stat-label">Semester + day matches</p>
                    <p className="editor-stat-value">{dayMatchedCourses.length.toLocaleString()}</p>
                  </div>
                  <div className="editor-stat">
                    <p className="editor-stat-label">After interest filter</p>
                    <p className="editor-stat-value">{interestMatchedCourses.length.toLocaleString()}</p>
                  </div>
                </div>
                <div className="editor-actions">
                  <button className="editor-button" type="button" onClick={handleDownloadDatabase}>
                    Download loaded database JSON
                  </button>
                </div>
                <p className="editor-note">
                  Filtered matches include time-in-session logic, so this can be very small even when the
                  total database is large.
                </p>
              </div>
            </>
          )}
        </main>
        <footer>
          <a className="logo" href="#">
            <div className="logo-mark">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <text x="16" y="21" fontFamily="Georgia" fontSize="13" fontWeight="bold" fill="#FDB515" textAnchor="middle">CH</text>
              </svg>
            </div>
            <span className="logo-wordmark">ClassHop <span style={{fontWeight:400,opacity:0.5}}>· UC Berkeley</span></span>
          </a>
        </footer>
        {pendingCalendarCourse && (
          <div
            className="cal-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cal-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPendingCalendarCourse(null);
            }}
          >
            <div className="cal-modal">
              <h3 id="cal-modal-title">Add to Google Calendar</h3>
              <p>
                The event date is the <strong>next day this class meets</strong> in Berkeley time (for example,
                MW on a Sunday starts on the upcoming Monday). Title and class times are pre-filled. Sign in
                with Google if asked. Choose a single session or repeat every week on this pattern—you can
                still edit repeat and end date before saving.
              </p>
              <div className="cal-modal-actions">
                <button
                  type="button"
                  className="cal-modal-btn cal-modal-btn--primary"
                  onClick={() => {
                    openGoogleCalendar(pendingCalendarCourse, "once");
                    setPendingCalendarCourse(null);
                  }}
                >
                  One-time event
                </button>
                <button
                  type="button"
                  className="cal-modal-btn"
                  disabled={meetDaysToRfcByDay(tokenizeMeetDays(pendingCalendarCourse.meetDays)) === null}
                  onClick={() => {
                    openGoogleCalendar(pendingCalendarCourse, "weekly");
                    setPendingCalendarCourse(null);
                  }}
                >
                  Weekly
                  {pendingCalendarCourse.meetDays
                    ? ` (${pendingCalendarCourse.meetDays})`
                    : ""}
                </button>
                <button type="button" className="cal-modal-btn cal-modal-btn--ghost" onClick={() => setPendingCalendarCourse(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

