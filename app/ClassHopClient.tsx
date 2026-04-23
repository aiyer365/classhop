"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import type { Course, Interest, Semester } from "../lib/types";
import { DEFAULT_SEMESTER } from "../lib/types";

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
const LOCKED_WINDOW_MINUTES = 60;
const EXCLUDED_BUILDINGS = new Set(["Internet/Online", "Off", "Unknown"]);

type WeekdayToken = "M" | "T" | "W" | "Tr" | "F";
type TopTab = "discover" | "saved" | "search" | "editor";
type PreparedCourse = Course & {
  resolvedSemester: Semester;
  startMinutes: number;
  endMinutes: number;
  subjectCode: string;
  searchText: string;
};

const WEEKDAY_BUTTONS: { token: WeekdayToken; label: string }[] = [
  { token: "M", label: "M" },
  { token: "T", label: "T" },
  { token: "W", label: "W" },
  { token: "Tr", label: "Th" },
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
  return course.semester ?? DEFAULT_SEMESTER;
}

/** Scraped schedule text often drops “Hall” / “Building”; normalize for display and maps. */
function formatBuildingLabel(raw: string): string {
  const key = raw.trim().replace(/\s+/g, " ");
  if (!key) return raw;

  const map: Record<string, string> = {
    "2240 Piedmont": "2240 Piedmont Ave",
    "2251 College": "ARF Building (Archaeological Research Facility)",
    "2401 Bancroft": "Bancroft Dance Studio",
    "2547 Bowditch": "Anna Head Alumnae Hall",
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

function BuildingCombobox({
  buildings,
  value,
  onChange
}: {
  buildings: string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return buildings;
    return buildings.filter((b) => formatBuildingLabel(b).toLowerCase().includes(q));
  }, [buildings, query]);

  useEffect(() => { setActiveIdx(-1); }, [filtered]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function select(building: string) {
    onChange(building);
    setQuery("");
    setOpen(false);
    setActiveIdx(-1);
  }

  function clear() {
    onChange(null);
    setQuery("");
    setActiveIdx(-1);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setOpen(false); setActiveIdx(-1); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIdx >= 0 && filtered[activeIdx]) { e.preventDefault(); select(filtered[activeIdx]); }
    }
  }

  const displayValue = value ? formatBuildingLabel(value) : "";

  return (
    <div className="building-combobox" ref={wrapRef}>
      <div className={`building-input-wrap ${open ? "open" : ""} ${value ? "has-value" : ""}`}>
        <svg className="building-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 1.5A4.5 4.5 0 0 0 3.5 6c0 3 4.5 8.5 4.5 8.5S12.5 9 12.5 6A4.5 4.5 0 0 0 8 1.5Zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" fill="currentColor"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="building-search-input"
          placeholder={value ? displayValue : "Search a building…"}
          value={open ? query : (value ? displayValue : query)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (value) onChange(null); }}
          onFocus={() => { setOpen(true); if (value) setQuery(""); }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          autoComplete="off"
        />
        {value && (
          <button type="button" className="building-clear" onClick={clear} aria-label="Clear building">×</button>
        )}
        <svg className={`building-chevron ${open ? "up" : ""}`} width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {open && filtered.length > 0 && (
        <ul className="building-dropdown" ref={listRef} role="listbox">
          {filtered.map((b, i) => (
            <li
              key={b}
              role="option"
              aria-selected={value === b}
              className={`building-option ${value === b ? "selected" : ""} ${activeIdx === i ? "active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); select(b); }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              {formatBuildingLabel(b)}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && (
        <div className="building-dropdown building-no-results">No buildings match</div>
      )}
    </div>
  );
}

function snapToHalfHour(totalMinutes: number): number {
  let total = totalMinutes;
  const remainder = totalMinutes % 30;
  if (remainder < 15) total -= remainder;
  else total += 30 - remainder;
  return total;
}

/** Minutes since midnight from catalog "HH:MM". */
function timeStringToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}


function minutesOverlapWindow(
  courseStartMin: number,
  courseEndMin: number,
  wStartMin: number,
  wEndMin: number
): boolean {
  return courseStartMin < wEndMin && courseEndMin > wStartMin;
}

function formatMinutes12h(totalMinutes: number): string {
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function minutesToBarPercent(m: number, min: number, max: number): number {
  if (max <= min) return 0;
  return ((m - min) / (max - min)) * 100;
}

type TimeRangeBarProps = {
  startMin: number;
  endMin: number;
  onStartChange: (snapped: number) => void;
  onEndChange: (snapped: number) => void;
  min: number;
  max: number;
  formatLabel: (m: number) => string;
  endLocked: boolean;
};

function TimeRangeBar({
  startMin,
  endMin,
  onStartChange,
  onEndChange,
  min,
  max,
  formatLabel,
  endLocked
}: TimeRangeBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<"start" | "end" | "range" | null>(null);
  const dragRangeAnchor = useRef<{ clientX: number; startMin: number; endMin: number } | null>(null);

  const toSnappedFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const t = (clientX - rect.left) / Math.max(1, rect.width);
      const raw = min + t * (max - min);
      return snapToHalfHour(Math.max(min, Math.min(max, raw)));
    },
    [min, max]
  );

  const startRef = useRef(startMin);
  const endRef = useRef(endMin);
  startRef.current = startMin;
  endRef.current = endMin;

  const onBarPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".dual-range-thumb")) return;
    if ((e.target as HTMLElement).closest(".dual-range-fill")) {
      dragRangeAnchor.current = { clientX: e.clientX, startMin, endMin };
      setDrag("range");
      return;
    }
    const snapped = toSnappedFromClientX(e.clientX);
    if (snapped === null) return;
    const distS = Math.abs(snapped - startMin);
    const distE = Math.abs(snapped - endMin);
    if (distS <= distE) {
      if (endLocked) {
        onStartChange(Math.max(min, Math.min(snapped, max - LOCKED_WINDOW_MINUTES)));
      } else {
        onStartChange(Math.max(min, Math.min(snapped, endMin - LOCKED_WINDOW_MINUTES)));
      }
    } else {
      onEndChange(Math.min(max, Math.max(snapped, startMin + LOCKED_WINDOW_MINUTES)));
    }
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      if (drag === "range") {
        const anchor = dragRangeAnchor.current;
        if (!anchor) return;
        const el = trackRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const pxPerMin = rect.width / Math.max(1, max - min);
        const deltaPx = e.clientX - anchor.clientX;
        const rangeWindow = anchor.endMin - anchor.startMin;
        const rawStart = anchor.startMin + deltaPx / pxPerMin;
        const newStart = Math.max(min, Math.min(snapToHalfHour(rawStart), max - rangeWindow));
        const newEnd = newStart + rangeWindow;
        onStartChange(newStart);
        onEndChange(newEnd);
        return;
      }
      const s = toSnappedFromClientX(e.clientX);
      if (s === null) return;
      if (drag === "start") {
        if (endLocked) {
          onStartChange(Math.max(min, Math.min(s, max - LOCKED_WINDOW_MINUTES)));
        } else {
          onStartChange(Math.max(min, Math.min(s, endRef.current - LOCKED_WINDOW_MINUTES)));
        }
      } else {
        onEndChange(Math.min(max, Math.max(s, startRef.current + LOCKED_WINDOW_MINUTES)));
      }
    };
    const onUp = () => { dragRangeAnchor.current = null; setDrag(null); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };
  }, [drag, endLocked, min, max, onStartChange, onEndChange, toSnappedFromClientX]);

  const pct0 = minutesToBarPercent(startMin, min, max);
  const pct1 = minutesToBarPercent(endMin, min, max);
  const w = Math.max(0, pct1 - pct0);

  return (
    <div className="time-range-dual">
      <div
        className="dual-range"
        ref={trackRef}
        onPointerDown={onBarPointerDown}
        style={{ touchAction: "none" }}
        role="group"
        aria-label="Free time window"
      >
        <div className="dual-range-bg" />
        <div
          className="dual-range-fill"
          style={{ left: `${pct0}%`, width: `${w}%` }}
        />
        <button
          type="button"
          className="dual-range-thumb dual-range-thumb--start"
          style={{ left: `${pct0}%` }}
          aria-label="Window starts at"
          aria-valuemin={min}
          aria-valuemax={endLocked ? max - LOCKED_WINDOW_MINUTES : endMin - LOCKED_WINDOW_MINUTES}
          aria-valuenow={startMin}
          role="slider"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              onStartChange(Math.max(min, startMin - 30));
            }
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              onStartChange(
                endLocked
                  ? Math.min(startMin + 30, max - LOCKED_WINDOW_MINUTES)
                  : Math.min(startMin + 30, endMin - LOCKED_WINDOW_MINUTES)
              );
            }
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.currentTarget as HTMLButtonElement).focus();
            setDrag("start");
          }}
        />
        <button
          type="button"
          className={`dual-range-thumb dual-range-thumb--end${endLocked ? " dual-range-thumb--end-locked" : ""}`}
          style={{ left: `${pct1}%` }}
          aria-label="Window ends at"
          title={
            endLocked
              ? "Drag past 1 hour to plan a longer window"
              : "Window end"
          }
          aria-valuemin={startMin + LOCKED_WINDOW_MINUTES}
          aria-valuemax={max}
          aria-valuenow={endMin}
          role="slider"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              onEndChange(Math.max(endMin - 30, startMin + LOCKED_WINDOW_MINUTES));
            }
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              onEndChange(Math.min(max, endMin + 30));
            }
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.currentTarget as HTMLButtonElement).focus();
            setDrag("end");
          }}
        />
      </div>
      <p className="time-range-readout-line" aria-hidden>
        <span className="time-range-time">{formatLabel(startMin)}</span>
        <span className="time-range-sep">—</span>
        <span className="time-range-time">{formatLabel(endMin)}</span>
      </p>
    </div>
  );
}

export function ClassHopClient({ initialCourses }: { initialCourses: Course[] }) {
  const allCourses = useMemo(
    () =>
      initialCourses.map((c) => ({
        ...c,
        id: String(c.id),
        meetDays: c.meetDays ?? "MW",
        resolvedSemester: getCourseSemester(c),
        startMinutes: timeStringToMinutes(c.startTime),
        endMinutes: timeStringToMinutes(c.endTime),
        subjectCode: (c.code.split(" ")[0] || "").toUpperCase(),
        searchText: `${c.title} ${c.code} ${c.instructor} ${c.department} ${c.description}`.toLowerCase()
      })),
    [initialCourses]
  ) as PreparedCourse[];

  const [semester, setSemester] = useState<Semester>(DEFAULT_SEMESTER);
  const [topTab, setTopTab] = useState<TopTab>("discover");
  const [selectedWeekday, setSelectedWeekday] = useState<WeekdayToken>("M");
  const [freeRangeStartMinutes, setFreeRangeStartMinutes] = useState(EARLIEST_MINUTES);
  const [freeRangeEndMinutes, setFreeRangeEndMinutes] = useState(
    EARLIEST_MINUTES + LOCKED_WINDOW_MINUTES
  );
  const [freeRangeUnlocked, setFreeRangeUnlocked] = useState(false);
  const [usingNow, setUsingNow] = useState(true);
  const freeRangeUnlockedRef = useRef(freeRangeUnlocked);
  const freeRangeStartRef = useRef(freeRangeStartMinutes);
  freeRangeUnlockedRef.current = freeRangeUnlocked;
  freeRangeStartRef.current = freeRangeStartMinutes;
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());
  const [currentSearchSection, setCurrentSearchSection] = useState<string | null>(null);
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [lastPool, setLastPool] = useState<Course[]>([]);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;
  const [hasSearched, setHasSearched] = useState(false);
  const [sortCol, setSortCol] = useState<"title" | "code" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [pendingCalendarCourse, setPendingCalendarCourse] = useState<Course | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set<string>());
  const savedStorageReady = useRef(false);

  // Hydration-safe defaults: compute time-based selections only on the client.
  useEffect(() => {
    const weekday = getDefaultWeekdayToken();
    const startM = Math.min(getDefaultMinutes(), LATEST_MINUTES - LOCKED_WINDOW_MINUTES);
    setSelectedWeekday(weekday);
    setFreeRangeUnlocked(false);
    setFreeRangeStartMinutes(startM);
    setFreeRangeEndMinutes(Math.min(LATEST_MINUTES, startM + LOCKED_WINDOW_MINUTES));
    setUsingNow(shouldUseNow(weekday, startM));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("classhop-saved");
      setSavedIds(new Set<string>(raw ? JSON.parse(raw) : []));
    } catch {
      setSavedIds(new Set<string>());
    }
    savedStorageReady.current = true;
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("classhop-dark");
      if (stored !== null) setDarkMode(stored === "true");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem("classhop-dark", String(darkMode)); } catch { /* ignore */ }
    if (darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [darkMode]);

  useEffect(() => {
    if (!savedStorageReady.current) return;
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

  const freeRangeValid = freeRangeStartMinutes < freeRangeEndMinutes;
  const selectedInterestSet = useMemo(() => new Set(selectedInterests), [selectedInterests]);

  function shouldUseNow(weekday: WeekdayToken, startMin: number): boolean {
    return weekday === getDefaultWeekdayToken() && startMin === getDefaultMinutes();
  }

  const applyFreeRangeStart = useCallback(
    (snapped: number) => {
      if (!freeRangeUnlockedRef.current) {
        const s = Math.max(
          EARLIEST_MINUTES,
          Math.min(snapped, LATEST_MINUTES - LOCKED_WINDOW_MINUTES)
        );
        const e = Math.min(LATEST_MINUTES, s + LOCKED_WINDOW_MINUTES);
        setFreeRangeStartMinutes(s);
        setFreeRangeEndMinutes(e);
        setUsingNow(shouldUseNow(selectedWeekday, s));
        return;
      }
      setFreeRangeStartMinutes(snapped);
      setFreeRangeEndMinutes((end) =>
        end <= snapped ? Math.min(LATEST_MINUTES, snapped + LOCKED_WINDOW_MINUTES) : end
      );
      setUsingNow(shouldUseNow(selectedWeekday, snapped));
    },
    [selectedWeekday]
  );

  const applyFreeRangeEnd = useCallback((snapped: number) => {
    if (!freeRangeUnlockedRef.current) {
      if (snapped <= freeRangeStartRef.current + LOCKED_WINDOW_MINUTES) {
        return;
      }
      setFreeRangeUnlocked(true);
    }
    setFreeRangeEndMinutes(snapped);
    setFreeRangeStartMinutes((start) =>
      snapped <= start ? Math.max(EARLIEST_MINUTES, snapped - LOCKED_WINDOW_MINUTES) : start
    );
    setUsingNow(false);
  }, []);

  const availableBuildings = useMemo(
    () =>
      [...new Set(allCourses.map((c) => c.building))]
        .filter((b) => b && !EXCLUDED_BUILDINGS.has(b))
        .sort((a, b) => formatBuildingLabel(a).localeCompare(formatBuildingLabel(b))),
    [allCourses]
  );

  const filteredCourses = useMemo(() => {
    if (!freeRangeValid) return [];
    let wStart = freeRangeStartMinutes;
    let wEnd = freeRangeEndMinutes;
    if (wStart > wEnd) [wStart, wEnd] = [wEnd, wStart];
    return allCourses.filter((course) => {
      if (course.resolvedSemester !== semester) return false;
      if (!meetDaysIncludes(course.meetDays, selectedWeekday)) return false;
      if (selectedInterestSet.size > 0) {
        const intersects = course.interests.some((i) => selectedInterestSet.has(i));
        if (!intersects) return false;
      }
      if (selectedBuilding && course.building !== selectedBuilding) return false;
      return minutesOverlapWindow(course.startMinutes, course.endMinutes, wStart, wEnd);
    });
  }, [
    allCourses,
    freeRangeEndMinutes,
    freeRangeStartMinutes,
    freeRangeValid,
    selectedInterestSet,
    selectedBuilding,
    semester,
    selectedWeekday
  ]);

  const uniqueCourseCount = useMemo(
    () => new Set(allCourses.map((course) => course.code)).size,
    [allCourses]
  );
  const semesterCourses = useMemo(
    () => allCourses.filter((course) => course.resolvedSemester === semester),
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

  const searchGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    const matched = allCourses.filter((c) => {
      if (c.resolvedSemester !== semester) return false;
      return tokens.every((token) => c.searchText.includes(token));
    });
    const map = new Map<string, Course[]>();
    for (const c of matched) {
      const key = c.code || c.title;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).map(([code, sections]) => ({ code, sections }));
  }, [searchQuery, allCourses, semester]);

  function toggleExpandCode(code: string, sections: Course[]) {
    setExpandedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
        setCurrentSearchSection(null);
      } else {
        next.add(code);
        if (sections.length === 1) setCurrentSearchSection(sections[0].id);
      }
      return next;
    });
  }

  function handleNow() {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let startM: number;

    // If current time is 7:30 PM to 9:00 PM, pin to 7:00 PM.
    if (nowMinutes >= 19 * 60 + 30 && nowMinutes <= 21 * 60) {
      startM = LATEST_MINUTES;
    } else if (nowMinutes < EARLIEST_MINUTES || nowMinutes > LATEST_MINUTES) {
      // Any other out-of-range time maps to 7:00 AM.
      startM = EARLIEST_MINUTES;
    } else {
      startM = snapToHalfHour(nowMinutes);
      startM = Math.max(EARLIEST_MINUTES, Math.min(LATEST_MINUTES, startM));
    }

    const weekday = getDefaultWeekdayToken();
    setSelectedWeekday(weekday);
    setFreeRangeUnlocked(false);
    startM = Math.min(startM, LATEST_MINUTES - LOCKED_WINDOW_MINUTES);
    const endM = Math.min(LATEST_MINUTES, startM + LOCKED_WINDOW_MINUTES);
    setFreeRangeStartMinutes(startM);
    setFreeRangeEndMinutes(endM);
    setUsingNow(shouldUseNow(weekday, startM));
  }

  function toggleInterest(interest: Interest) {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  }

  const sortedPool = useMemo(() => {
    if (!sortCol) return lastPool;
    return [...lastPool].sort((a, b) => {
      let va: string, vb: string;
      if (sortCol === "title") {
        va = a.title; vb = b.title;
      } else {
        va = (a as PreparedCourse).subjectCode;
        vb = (b as PreparedCourse).subjectCode;
      }
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [lastPool, sortCol, sortDir]);

  useEffect(() => {
    setPage(0);
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
    const shuffled = [...filteredCourses].sort(() => Math.random() - 0.5);
    if (selectedInterests.length > 0) {
      const interestSet = new Set(selectedInterests);
      const scoreCache = new Map<string, { count: number; pure: boolean }>();
      const getScore = (course: Course) => {
        const cached = scoreCache.get(course.id);
        if (cached) return cached;
        let count = 0;
        let pure = true;
        for (const interest of course.interests) {
          if (interestSet.has(interest)) count += 1;
          else pure = false;
        }
        const score = { count, pure };
        scoreCache.set(course.id, score);
        return score;
      };
      shuffled.sort((a, b) => {
        const aScore = getScore(a);
        const bScore = getScore(b);
        const aCount = aScore.count;
        const bCount = bScore.count;
        if (bCount !== aCount) return bCount - aCount;
        const aPure = aScore.pure ? 0 : 1;
        const bPure = bScore.pure ? 0 : 1;
        return aPure - bPure;
      });
    }
    setLastPool(shuffled);
  }

  function handleDownloadDatabase() {
    downloadJsonFile("classhop-joined-courses.json", allCourses);
  }

  return (
    <>
      <style jsx global>{`
        :root { --navy:#002855; --navy-light:#0a3d6b; --gold:#fdb515; --gold-dim:#c98e00; --cream:#f8f5ef; --cream-dark:#ede8de; --text:#1a1612; --muted:#6b6356; --border:rgba(0,40,85,0.14); --chip-bg:#fff; --surface:#fff; --font-display:var(--font-fraunces),Georgia,serif; --font-body:var(--font-dm-sans),system-ui,sans-serif; --font-mono:var(--font-dm-mono),monospace; --radius-sm:6px; --radius-md:12px; --radius-pill:999px;}

        .redesign-root,.redesign-root *{box-sizing:border-box}.redesign-root{min-height:100vh;display:flex;flex-direction:column;background:var(--cream);color:var(--text);font-family:var(--font-body)}
        body,body *{transition:background-color 300ms ease,color 300ms ease,border-color 300ms ease,box-shadow 300ms ease;}
        .redesign-root nav{display:flex;align-items:center;justify-content:space-between;padding:1.125rem 2.5rem;border-bottom:1px solid var(--border);background:var(--cream);position:sticky;top:0;z-index:10}
        .logo{display:flex;align-items:center;gap:.5rem;text-decoration:none}.logo-mark{width:32px;height:32px;background:var(--navy);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center}.logo-wordmark{font-weight:500;font-size:1rem;color:var(--navy);letter-spacing:-.01em}
        .dark .logo-wordmark{color:var(--text)}
        .theme-toggle{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-pill);border:1px solid var(--border);background:transparent;cursor:pointer;color:var(--muted);transition:color 120ms,border-color 120ms,background 120ms;flex-shrink:0}.theme-toggle:hover{color:var(--text);background:rgba(128,128,128,.1)}
        html.dark{--cream:#0e1520;--cream-dark:#172030;--text:#dde4ed;--muted:#a0b5cc;--border:rgba(255,255,255,0.1);--chip-bg:#172030;--gold-dim:#e0a020}
        html.dark body,html.dark .redesign-root{background:var(--cream);color:var(--text)}
        html.dark .logo-wordmark{color:var(--text)}
        html.dark .results-table{background:var(--cream-dark)}
        html.dark .results-table tbody tr:hover{background:rgba(255,255,255,.04)}
        html.dark .results-table tbody tr.row-active{background:rgba(255,255,255,.06)}
        html.dark .course-card{background:var(--cream-dark);border-color:var(--border)}
        html.dark .card-actions{background:var(--cream);border-color:var(--border)}
        html.dark .expanded-card-wrap{background:rgba(255,255,255,.03);border-top-color:rgba(255,255,255,.1)}
        html.dark .building-dropdown{background:var(--cream-dark);border-color:var(--border)}
        html.dark .building-option:hover,html.dark .building-option.active{background:rgba(255,255,255,.06)}
        html.dark .building-input-wrap{background:var(--cream-dark)}
        html.dark .search-input{background:var(--cream-dark);color:var(--text);border-color:var(--border)}
        html.dark .search-group{background:var(--cream-dark);border-color:var(--border)}
        html.dark .editor-panel{background:var(--cream-dark);border-color:var(--border)}
        html.dark .editor-stat{background:var(--cream);border-color:var(--border)}
        html.dark .top-tab-btn.active{background:rgba(255,255,255,.1);color:var(--text)}
        html.dark .semester-btn.active{background:rgba(255,255,255,.1);color:var(--text);box-shadow:none}
        html.dark .btn-secondary{border-color:var(--border);color:var(--text)}
        html.dark .rt-title,html.dark .hero-title,html.dark .section-title,html.dark .card-college,html.dark .card-title,html.dark .search-group-title,html.dark .prominent-message{color:var(--text)}
        html.dark .cal-modal{background:var(--cream-dark);border-color:var(--border)}
        html.dark .cal-modal h3{color:var(--text)}
        html.dark .cal-modal-btn{background:var(--cream);border-color:var(--border);color:var(--text)}
        html.dark .mobile-menu{background:var(--cream-dark);border-color:var(--border)}
        html.dark .mobile-nav-btn{color:var(--text);border-bottom-color:var(--border)}
        html.dark .hamburger span{background:var(--text)}
        html.dark .dual-range-thumb{border-color:var(--cream-dark)}
        html.dark .card-instructor-link,html.dark .card-location a{color:var(--text);border-bottom-color:rgba(255,255,255,.2)}
        html.dark .time-range-readout-line{color:var(--text);background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.12)}
        html.dark .dual-range-bg{background:rgba(255,255,255,.15)}
        html.dark .time-slider{background:rgba(255,255,255,.15)}
        html.dark .editor-stat-value{color:var(--text)}
        html.dark .building-option.selected{color:var(--text);background:rgba(255,255,255,.07)}
        html.dark .building-input-wrap.has-value{border-color:rgba(255,255,255,.25);background:rgba(255,255,255,.04)}
        html.dark .search-section-active{background:rgba(255,255,255,.06)}
        html.dark .search-section:hover,html.dark .search-group-header:hover{background:rgba(255,255,255,.04)}
        .header-right{display:flex;align-items:center;gap:.75rem}
        .top-tabs{display:flex;align-items:center;gap:2px;border:1px solid var(--border);border-radius:var(--radius-pill);background:rgba(0,40,85,.03);padding:3px}
        .top-tab-btn{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.04em;color:var(--muted);background:transparent;border:none;border-radius:var(--radius-pill);padding:.3rem .75rem;cursor:pointer}
        .top-tab-btn:hover{color:var(--text)}
        .top-tab-btn.active{background:#fff;color:var(--text);box-shadow:0 1px 3px rgba(0,40,85,.1)}
        .semester-toggle{display:flex;align-items:center;gap:2px;border:1px solid var(--border);border-radius:var(--radius-pill);background:rgba(0,40,85,.03);padding:3px}
        .semester-btn{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.04em;color:var(--muted);background:transparent;border:none;border-radius:var(--radius-pill);padding:.3rem .75rem;cursor:pointer}.semester-btn.active{background:#fff;color:var(--text);box-shadow:0 1px 3px rgba(0,40,85,.1)}
        .redesign-main{flex:1;max-width:960px;width:100%;margin:0 auto;padding:0.5rem 2rem 6rem;overflow-x:hidden;transition:max-width 0.2s ease,padding 0.2s ease}.eyebrow{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-dim);margin-bottom:1.5rem}
        .hero-title{font-family:var(--font-display);font-size:clamp(2.6rem,6vw,3.75rem);font-weight:300;line-height:1.08;color:var(--navy);letter-spacing:-.02em;margin-bottom:.75rem}.subheadline{font-family:var(--font-display);font-size:clamp(1.3rem,3vw,1.6rem);font-weight:300;font-style:italic;color:var(--gold-dim);margin-bottom:1.75rem}.description{font-size:1rem;line-height:1.75;color:var(--muted);max-width:520px;margin-bottom:3.5rem}
        .divider{height:1px;background:var(--border);margin:3rem 0}.form-section{margin-bottom:2.5rem}.section-label{display:flex;align-items:center;gap:.75rem;margin-bottom:1rem}.step-number{font-family:var(--font-mono);font-size:.65rem;color:var(--gold-dim);background:rgba(253,181,21,.12);border:1px solid rgba(253,181,21,.3);border-radius:var(--radius-pill);padding:.2rem .6rem;letter-spacing:.06em}.section-title{font-family:var(--font-display);font-size:1.6rem;font-weight:300;letter-spacing:-.01em;text-transform:none;color:var(--navy)}
        .when-section{display:grid;grid-template-columns:1fr auto;grid-template-rows:auto auto;column-gap:1.25rem;row-gap:.75rem}.when-section .section-label{grid-column:1;grid-row:1;align-self:center;margin-bottom:0}.when-section .time-range-block{grid-column:1/-1;grid-row:2}.when-section .day-strip{grid-column:2;grid-row:1;align-self:center}
        .time-range-block{display:flex;align-items:flex-start;gap:.85rem;width:100%;min-width:0;flex:1}
        .time-range-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:.35rem}
        .time-range-now{flex:0 0 auto;align-self:flex-start;margin-top:2px}
        .dual-range-thumb--end-locked{box-shadow:0 0 0 1px rgba(42,143,92,.4)}
        .time-range-dual{flex:1;min-width:0;display:flex;flex-direction:column;gap:.45rem}
        .dual-range{position:relative;height:56px;width:100%;align-self:stretch;cursor:pointer}
        .dual-range-bg{position:absolute;left:0;right:0;top:50%;height:10px;margin-top:-5px;border-radius:999px;background:rgba(0,40,85,.12);pointer-events:none}
        .dual-range-fill{position:absolute;top:50%;height:10px;margin-top:-5px;border-radius:999px;background:#2a8f5c;min-width:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.12);cursor:grab;z-index:1}
        .dual-range-thumb{position:absolute;top:50%;z-index:2;width:18px;height:18px;border-radius:50%;background:var(--navy);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.28);transform:translate(-50%,-50%);cursor:grab;padding:0}
        .dual-range-thumb--end{z-index:3}
        .dual-range-thumb:hover,.dual-range-thumb:focus-visible{z-index:4;outline:2px solid rgba(0,40,85,.2);outline-offset:2px}
        .dual-range-thumb:active{cursor:grabbing}
        .time-range-readout-line{margin:0;font-family:var(--font-mono);font-size:.85rem;letter-spacing:.04em;color:var(--navy);background:rgba(0,40,85,.06);border:1px solid rgba(0,40,85,.14);border-radius:var(--radius-pill);padding:.3rem .85rem;white-space:nowrap;width:fit-content;align-self:center}
        .time-range-sep{opacity:0.45;padding:0 .35rem}
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
        .building-combobox{position:relative;max-width:420px}
        .building-input-wrap{display:flex;align-items:center;gap:.5rem;border:1px solid var(--border);border-radius:var(--radius-md);background:#fff;padding:.6rem 1rem;cursor:text;transition:border-color 120ms,box-shadow 120ms}
        .building-input-wrap:focus-within,.building-input-wrap.open{border-color:var(--navy);box-shadow:0 0 0 3px rgba(0,40,85,.08)}
        .building-input-wrap.has-value{border-color:var(--navy);background:rgba(0,40,85,.03)}
        .building-icon{color:var(--muted);flex-shrink:0}
        .building-search-input{flex:1;border:none;outline:none;background:transparent;font-family:var(--font-body);font-size:.95rem;color:var(--text);min-width:0}
        .building-search-input::placeholder{color:var(--muted)}
        .building-clear{border:none;background:none;cursor:pointer;color:var(--muted);font-size:1.1rem;line-height:1;padding:0 .15rem;flex-shrink:0}
        .building-clear:hover{color:var(--text)}
        .building-chevron{color:var(--muted);flex-shrink:0;transition:transform 150ms}.building-chevron.up{transform:rotate(180deg)}
        .building-dropdown{position:absolute;top:calc(100% + 6px);left:0;right:0;background:#fff;border:1px solid var(--border);border-radius:var(--radius-md);box-shadow:0 8px 24px rgba(0,40,85,.13);z-index:100;max-height:260px;overflow-y:auto;margin:0;padding:.35rem 0;list-style:none}
        .building-option{padding:.55rem 1rem;font-size:.9rem;cursor:pointer;color:var(--text)}
        .building-option:hover,.building-option.active{background:rgba(0,40,85,.05)}
        .building-option.selected{color:var(--navy);font-weight:500;background:rgba(0,40,85,.06)}
        .building-no-results{padding:.75rem 1rem;font-size:.85rem;color:var(--muted);font-style:italic}
        .search-input-wrap{margin:1.5rem 0 1rem}
        .search-input{width:100%;font-family:var(--font-body);font-size:1rem;padding:.75rem 1rem;border:1px solid var(--border);border-radius:var(--radius-md);background:#fff;color:var(--text);outline:none;box-sizing:border-box}
        .search-input:focus{border-color:var(--navy);box-shadow:0 0 0 3px rgba(0,40,85,.08)}
        .search-empty{color:var(--muted);font-size:.9rem;margin-top:1.5rem}
        .search-groups{display:flex;flex-direction:column;gap:.65rem;margin-top:.75rem}
        .search-group{border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;background:#fff}
        .search-group-header{width:100%;display:flex;align-items:center;gap:.75rem;padding:.85rem 1rem;background:none;border:none;cursor:pointer;text-align:left;position:relative}
        .search-group-header:hover{background:rgba(0,40,85,.03)}
        .search-group-title-row{display:flex;align-items:baseline;gap:.5rem;flex:1;flex-wrap:wrap}
        .search-group-title{font-family:var(--font-display);font-size:1.05rem;font-weight:300;color:var(--navy)}
        .search-group-code{font-family:var(--font-mono);font-size:.72rem;color:var(--muted);letter-spacing:.04em}
        .search-group-meta{display:flex;align-items:center;gap:.65rem;flex-shrink:0}
        .search-group-dept{font-size:.78rem;color:var(--muted)}
        .search-group-count{font-family:var(--font-mono);font-size:.72rem;color:var(--gold-dim);background:rgba(253,181,21,.1);border:1px solid rgba(253,181,21,.25);border-radius:var(--radius-pill);padding:.1rem .5rem;white-space:nowrap}
        .search-group-chevron{font-size:.65rem;color:var(--muted);flex-shrink:0}
        .search-sections{border-top:1px solid var(--border)}
        .search-section{padding:.75rem 1rem;border-top:1px solid var(--border);display:flex;align-items:center;gap:.75rem;cursor:pointer;flex-wrap:wrap}
        .search-section:first-child{border-top:none}
        .search-section:hover{background:rgba(0,40,85,.03)}
        .search-section-active{background:rgba(0,40,85,.06)}
        .search-section-instructor{font-size:.88rem;color:var(--text)}
        .search-section-location{font-family:var(--font-mono);font-size:.75rem;color:var(--muted)}
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
          .when-section .time-range-block{order:2;flex-direction:column;align-items:stretch;gap:.75rem}
          .time-range-now{align-self:flex-start}
          .when-section .day-strip{order:3;justify-content:center;width:100%}
          .day-btn,.time-btn,.chip{
            font-size:.82rem;
            line-height:1;
            height:2.15rem;
            padding:.58rem .8rem;
          }
          .day-btn{flex:0 0 auto;text-align:center}
          .time-btn{flex:0 0 auto}
          .time-range-dual{gap:.35rem}
          .time-range-readout-line{font-size:.78rem}
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
          .pagination{display:flex;align-items:center;justify-content:center;margin-top:1.5rem;gap:.6rem}
          .page-btn{padding:.85rem 1.4rem;font-size:.72rem}

          /* ── Footer ── */
          .redesign-root footer{padding:1rem 1.25rem}

          /* ── Calendar modal ── */
          .cal-modal{padding:1.25rem}
        }
      `}</style>
      <div className="redesign-root">
        <nav style={{position:"relative"}}>
          <div style={{display:"flex",alignItems:"center",gap:".75rem"}}>
            <a className="logo" href="#">
              <div className="logo-mark">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <text x="16" y="21" fontFamily="Georgia" fontSize="13" fontWeight="bold" fill="#FDB515" textAnchor="middle">CH</text>
                </svg>
              </div>
              <span className="logo-wordmark">ClassHop</span>
            </a>
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setDarkMode(d => !d)}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              title={darkMode ? "Light mode" : "Dark mode"}
            >
              {darkMode
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              }
            </button>
          </div>
          <div className="header-right">
            <Link href="/categories" className="categories-link" style={{fontFamily:"var(--font-mono)",fontSize:".68rem",letterSpacing:".06em",color:"var(--muted)",textDecoration:"none",border:"1px solid var(--border)",borderRadius:"var(--radius-pill)",padding:".3rem .85rem"}}>
              Categories
            </Link>
            <div className="top-tabs">
              <button className={`top-tab-btn ${topTab === "discover" ? "active" : ""}`} onClick={() => setTopTab("discover")} type="button">Discover</button>
              <button className={`top-tab-btn ${topTab === "search" ? "active" : ""}`} onClick={() => setTopTab("search")} type="button">Search</button>
              <button className={`top-tab-btn ${topTab === "saved" ? "active" : ""}`} onClick={() => setTopTab("saved")} type="button">Saved{savedIds.size > 0 && <span className="saved-badge">{savedIds.size}</span>}</button>
              <button className={`top-tab-btn ${topTab === "editor" ? "active" : ""}`} onClick={() => setTopTab("editor")} type="button">Editor</button>
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
              <button className={`mobile-nav-btn${topTab === "search" ? " active" : ""}`} type="button" onClick={() => { setTopTab("search"); setMenuOpen(false); }}>Search</button>
              <button className={`mobile-nav-btn${topTab === "saved" ? " active" : ""}`} type="button" onClick={() => { setTopTab("saved"); setMenuOpen(false); }}>
                Saved{savedIds.size > 0 && <span className="saved-badge" style={{marginLeft:".5rem"}}>{savedIds.size}</span>}
              </button>
              <a href="/categories" className="mobile-nav-link">Categories</a>
            </div>
          </div>
        </nav>
        <main className="redesign-main">
          {topTab === "discover" ? (
            <>
              <h1 className="hero-title">Got a Free Window?</h1>
              <p className="subheadline">Wander into a class.</p>
              <p className="description">Pick a time range you&apos;re free and what sparks your curiosity. We&apos;ll list Berkeley classes that meet during that window on the day you choose.</p>
              <div className="divider" />
              <div className="form-section when-section">
                  <div className="section-label">
                    <span className="step-number">01</span>
                    <span className="section-title">When are you free?{"\u00a0"}</span>
                  </div>
                  <div className="time-range-block">
                    <button className={`time-btn time-range-now ${usingNow ? "active" : ""}`} type="button" onClick={handleNow}>Now</button>
                    <div className="time-range-main">
                      <TimeRangeBar
                        startMin={freeRangeStartMinutes}
                        endMin={freeRangeEndMinutes}
                        onStartChange={applyFreeRangeStart}
                        onEndChange={applyFreeRangeEnd}
                        min={EARLIEST_MINUTES}
                        max={LATEST_MINUTES}
                        formatLabel={formatMinutes12h}
                        endLocked={!freeRangeUnlocked}
                      />
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
                          setUsingNow(shouldUseNow(token, freeRangeStartMinutes));
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
              <div className="form-section">
                <div className="section-label"><span className="step-number">03</span><span className="section-title">Where are you? <span style={{opacity:0.5}}>(optional)</span></span></div>
                <BuildingCombobox
                  buildings={availableBuildings}
                  value={selectedBuilding}
                  onChange={setSelectedBuilding}
                />
              </div>
              <div className="cta-wrapper">
                <button className="cta-btn" type="button" onClick={handleFindClass} disabled={!freeRangeValid}><span>Find classes</span></button>
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
          ) : topTab === "search" ? (
            <>
              <h1 className="hero-title">Find a Class</h1>
              <p className="subheadline">Search by name, instructor, or topic.</p>
              <div className="search-input-wrap">
                <input
                  className="search-input"
                  type="search"
                  placeholder="e.g. astronomy, history of art, Dacher Keltner…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
              {searchQuery.trim() && searchGroups.length === 0 && (
                <p className="search-empty">No classes found for &ldquo;{searchQuery}&rdquo; in {semester}.</p>
              )}
              {searchGroups.length > 0 && (
                <div className="search-groups">
                  <p className="result-count">{searchGroups.length} {searchGroups.length === 1 ? "course" : "courses"} found</p>
                  {searchGroups.map(({ code, sections }) => {
                    const isOpen = expandedCodes.has(code);
                    const rep = sections[0];
                    return (
                      <div key={code} className="search-group">
                        <button
                          type="button"
                          className="search-group-header"
                          onClick={() => toggleExpandCode(code, sections)}
                          aria-expanded={isOpen}
                        >
                          <div className="search-group-title-row">
                            <span className="search-group-title">{rep.title}</span>
                            <span className="search-group-code">{rep.code}</span>
                          </div>
                          <div className="search-group-meta">
                            <span className="search-group-dept">{rep.department}</span>
                            <span className="search-group-count">{sections.length} {sections.length === 1 ? "section" : "sections"}</span>
                          </div>
                          <span className="search-group-chevron">{isOpen ? "▲" : "▼"}</span>
                        </button>
                        {isOpen && (
                          <div className="search-sections">
                            {sections.length === 1 ? (
                              <div className="expanded-card-wrap">
                                <div className="course-card">
                                  <div className="card-body">
                                    <div className="card-top">
                                      <div>
                                        <p className="card-college">{getDisplayDepartment(sections[0].department, sections[0].code.split(" ")[0])}</p>
                                        <span className="card-dept">{getDisplayCollege(sections[0])}</span>
                                      </div>
                                      <span className="card-time-badge">{sections[0].meetDays} · {formatTimeRange(sections[0].startTime, sections[0].endTime)}</span>
                                    </div>
                                    <h2 className="card-title">{sections[0].title}</h2>
                                    <p className="card-meta">{sections[0].code} · <InstructorWithRmpLink instructor={sections[0].instructor} /></p>
                                    <div className="card-divider" />
                                    <div className="card-location"><a href={buildMapsUrl(sections[0].building)} target="_blank" rel="noreferrer">{formatBuildingLabel(sections[0].building)}, Room {sections[0].room}</a></div>
                                    <p className="card-desc">{stripPrereqText(sections[0].description)}</p>
                                    <div className="card-tags">{sections[0].interests.map((tag) => <span key={tag} className="card-tag">{tag}</span>)}</div>
                                  </div>
                                  <div className="card-actions">
                                    <button className="btn-secondary" type="button" onClick={(e) => toggleSave(sections[0].id, e)}>
                                      <span style={{fontSize:"1.1rem",lineHeight:1,marginRight:".3rem"}}>{savedIds.has(sections[0].id) ? "★" : "☆"}</span>{savedIds.has(sections[0].id) ? "Saved" : "Save"}
                                    </button>
                                    <button className="btn-secondary" type="button" onClick={(e) => { e.stopPropagation(); setPendingCalendarCourse(sections[0]); }}>Add to Calendar</button>
                                    <button className="btn-primary" type="button" onClick={(e) => { e.stopPropagation(); toggleExpandCode(code, sections); }}>Collapse ↑</button>
                                  </div>
                                </div>
                              </div>
                            ) : sections.map((sec) => {
                              const secOpen = currentSearchSection === sec.id;
                              return (
                                <React.Fragment key={sec.id}>
                                  <div
                                    className={`search-section${secOpen ? " search-section-active" : ""}`}
                                    onClick={() => setCurrentSearchSection(secOpen ? null : sec.id)}
                                  >
                                    <span className="card-time-badge">{sec.meetDays} · {formatTimeRange(sec.startTime, sec.endTime)}</span>
                                    <span className="search-section-instructor">{sec.instructor}</span>
                                    <span className="search-section-location">{formatBuildingLabel(sec.building)}{sec.room && sec.room !== "TBD" ? `, ${sec.room}` : ""}</span>
                                  </div>
                                  {secOpen && (
                                    <div className="expanded-card-wrap">
                                      <div className="course-card">
                                        <div className="card-body">
                                          <div className="card-top">
                                            <div>
                                              <p className="card-college">{getDisplayDepartment(sec.department, sec.code.split(" ")[0])}</p>
                                              <span className="card-dept">{getDisplayCollege(sec)}</span>
                                            </div>
                                            <span className="card-time-badge">{sec.meetDays} · {formatTimeRange(sec.startTime, sec.endTime)}</span>
                                          </div>
                                          <h2 className="card-title">{sec.title}</h2>
                                          <p className="card-meta">{sec.code} · <InstructorWithRmpLink instructor={sec.instructor} /></p>
                                          <div className="card-divider" />
                                          <div className="card-location"><a href={buildMapsUrl(sec.building)} target="_blank" rel="noreferrer">{formatBuildingLabel(sec.building)}, Room {sec.room}</a></div>
                                          <p className="card-desc">{stripPrereqText(sec.description)}</p>
                                          <div className="card-tags">{sec.interests.map((tag) => <span key={tag} className="card-tag">{tag}</span>)}</div>
                                        </div>
                                        <div className="card-actions">
                                          <button className="btn-secondary" type="button" onClick={(e) => toggleSave(sec.id, e)}>
                                            <span style={{fontSize:"1.1rem",lineHeight:1,marginRight:".3rem"}}>{savedIds.has(sec.id) ? "★" : "☆"}</span>{savedIds.has(sec.id) ? "Saved" : "Save"}
                                          </button>
                                          <button className="btn-secondary" type="button" onClick={(e) => { e.stopPropagation(); setPendingCalendarCourse(sec); }}>Add to Calendar</button>
                                          <button className="btn-primary" type="button" onClick={(e) => { e.stopPropagation(); setCurrentSearchSection(null); }}>Collapse ↑</button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
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

