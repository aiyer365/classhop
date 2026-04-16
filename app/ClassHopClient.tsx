"use client";

import { useMemo, useState } from "react";

import type { Course, Interest, Semester } from "../lib/types";

const INTEREST_OPTIONS: Interest[] = [
  "Science",
  "Arts",
  "Philosophy",
  "Tech",
  "History",
  "Business",
  "Social Science",
  "Environment"
];

const EARLIEST_MINUTES = 7 * 60; // 7:00 AM
const LATEST_MINUTES = 19 * 60; // 7:00 PM

type WeekdayToken = "M" | "T" | "W" | "Tr" | "F";

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

function getDisplayDepartment(department: string): string {
  const map: Record<string, string> = {
    "Electrical Eng & Computer Sci": "Electrical Engineering & Computer Sciences"
  };
  return map[department] ?? department;
}

function getDisplayCollege(course: Course): string {
  const dept = getDisplayDepartment(course.department);
  const subject = (course.code.split(" ")[0] || "").toUpperCase();

  const bySubject: Record<string, string> = {
    // College of Engineering
    AEROENG: "College of Engineering",
    BIOENG: "College of Engineering",
    CE: "College of Engineering",
    COMPSCI: "College of Engineering",
    EECS: "College of Engineering",
    ELENG: "College of Engineering",
    ENGIN: "College of Engineering",
    INDENG: "College of Engineering",
    ME: "College of Engineering",

    // Rausser College of Natural Resources
    ESPM: "Rausser College of Natural Resources",
    PLANTBI: "Rausser College of Natural Resources",
    INTEGBI: "Rausser College of Natural Resources",
    ENVECON: "Rausser College of Natural Resources",
    AGRS: "Rausser College of Natural Resources",

    // Haas
    UGBA: "Haas School of Business",

    // Other schools/colleges
    INFO: "School of Information",
    PBHLTH: "School of Public Health",
    GPP: "Goldman School of Public Policy",
    CYPLAN: "College of Environmental Design",
    ARCH: "College of Environmental Design",
    EDUC: "Berkeley School of Education"
  };

  if (bySubject[subject]) return bySubject[subject];

  const byDepartment: Array<[RegExp, string]> = [
    [/Electrical Engineering & Computer Sciences|Engineering|Bioengineering|Industrial Eng|Mechanical/i, "College of Engineering"],
    [/Env Sci, Policy, & Mgmt|Plant & Microbial Biology|Integrative Biology|Ag & Resource Econ/i, "Rausser College of Natural Resources"],
    [/Haas School of Business/i, "Haas School of Business"],
    [/School of Information/i, "School of Information"],
    [/School of Public Health/i, "School of Public Health"],
    [/Goldman School Public Policy/i, "Goldman School of Public Policy"],
    [/Architecture|City & Regional Planning|Environmental Design/i, "College of Environmental Design"],
    [/Berkeley School of Education|Grad School of Education/i, "Berkeley School of Education"]
  ];

  for (const [pattern, college] of byDepartment) {
    if (pattern.test(dept)) return college;
  }

  return "College of Letters & Science";
}

function formatInstructor(instructor: string): string {
  if (!instructor || instructor.trim().length === 0) return "Staff";
  if (/^(Prof\.|Professor\b)/i.test(instructor)) return instructor;
  return `Prof. ${instructor}`;
}

function rateMyProfessorSearchUrl(name: string): string {
  return `https://www.ratemyprofessors.com/search/professors?q=${encodeURIComponent(name.trim())}`;
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

function downloadIcs(course: Course) {
  const today = new Date();
  const [sh, sm] = course.startTime.split(":").map(Number);
  const [eh, em] = course.endTime.split(":").map(Number);

  const start = new Date(today);
  start.setHours(sh, sm, 0, 0);
  const end = new Date(today);
  end.setHours(eh, em, 0, 0);

  const toIcsDate = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(
      d.getDate()
    )}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  };

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ClassHop//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${course.id}@classhop.berkeley`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${course.title} (${course.code})`,
    `DESCRIPTION:${course.description.replace(/\r?\n/g, " ")}`,
    `LOCATION:${formatBuildingLabel(course.building)} Room ${course.room}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${course.code.replace(/\s+/g, "_")}_ClassHop.ics`;
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
  const [selectedWeekday, setSelectedWeekday] = useState<WeekdayToken>(getDefaultWeekdayToken);
  const [selectedMinutes, setSelectedMinutes] = useState(15 * 60);
  const [usingNow, setUsingNow] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>([]);
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [lastPool, setLastPool] = useState<Course[]>([]);
  const [skippedCourses, setSkippedCourses] = useState<Course[]>([]);
  const [isFinding, setIsFinding] = useState(false);
  const [noMoreMatches, setNoMoreMatches] = useState(false);

  const selectedTime24 = useMemo(
    () => minutesToTime24(selectedMinutes),
    [selectedMinutes]
  );

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
    setUsingNow(true);
  }

  function toggleInterest(interest: Interest) {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  }

  function handleFindClass() {
    setSkippedCourses([]);
    setCurrentCourse(null);
    setNoMoreMatches(false);
    if (filteredCourses.length === 0) {
      setLastPool([]);
      return;
    }
    setIsFinding(true);
    setLastPool(filteredCourses);
    window.setTimeout(() => {
      const idx = Math.floor(Math.random() * filteredCourses.length);
      setCurrentCourse(filteredCourses[idx]);
      setNoMoreMatches(false);
      setIsFinding(false);
    }, 300);
  }

  function handleFindAnother() {
    if (lastPool.length === 0) return;
    const skippedIds = new Set(skippedCourses.map((course) => course.id));
    if (currentCourse) skippedIds.add(currentCourse.id);

    if (currentCourse && !skippedCourses.some((course) => course.id === currentCourse.id)) {
      setSkippedCourses((prev) => [...prev, currentCourse]);
    }

    const candidates = lastPool.filter((course) => !skippedIds.has(course.id));
    if (candidates.length === 0) {
      setCurrentCourse(null);
      setNoMoreMatches(true);
      return;
    }
    const idx = Math.floor(Math.random() * candidates.length);
    setCurrentCourse(candidates[idx]);
    setNoMoreMatches(false);
  }

  return (
    <>
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;1,9..144,300;1,9..144,500&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400&display=swap");
        :root { --navy:#002855; --navy-light:#0a3d6b; --gold:#fdb515; --gold-dim:#c98e00; --cream:#f8f5ef; --cream-dark:#ede8de; --text:#1a1612; --muted:#6b6356; --border:rgba(0,40,85,0.14); --chip-bg:#fff; --font-display:"Fraunces",Georgia,serif; --font-body:"DM Sans",system-ui,sans-serif; --font-mono:"DM Mono",monospace; --radius-sm:6px; --radius-md:12px; --radius-pill:999px;}
        .redesign-root,.redesign-root *{box-sizing:border-box}.redesign-root{min-height:100vh;display:flex;flex-direction:column;background:var(--cream);color:var(--text);font-family:var(--font-body)}
        .redesign-root nav{display:flex;align-items:center;justify-content:space-between;padding:1.125rem 2.5rem;border-bottom:1px solid var(--border);background:var(--cream);position:sticky;top:0;z-index:10}
        .logo{display:flex;align-items:center;gap:.5rem;text-decoration:none}.logo-mark{width:32px;height:32px;background:var(--navy);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center}.logo-wordmark{font-weight:500;font-size:1rem;color:var(--navy);letter-spacing:-.01em}
        .semester-toggle{display:flex;align-items:center;gap:2px;border:1px solid var(--border);border-radius:var(--radius-pill);background:rgba(0,40,85,.03);padding:3px}
        .semester-btn{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.04em;color:var(--muted);background:transparent;border:none;border-radius:var(--radius-pill);padding:.3rem .75rem;cursor:pointer}.semester-btn.active{background:#fff;color:var(--text);box-shadow:0 1px 3px rgba(0,40,85,.1)}
        .redesign-main{flex:1;max-width:680px;width:100%;margin:0 auto;padding:2.75rem 2rem 6rem}.eyebrow{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-dim);margin-bottom:1.5rem}
        .hero-title{font-family:var(--font-display);font-size:clamp(2.6rem,6vw,3.75rem);font-weight:300;line-height:1.08;color:var(--navy);letter-spacing:-.02em;margin-bottom:.75rem}.subheadline{font-family:var(--font-display);font-size:clamp(1.3rem,3vw,1.6rem);font-weight:300;font-style:italic;color:var(--gold-dim);margin-bottom:1.75rem}.description{font-size:1rem;line-height:1.75;color:var(--muted);max-width:520px;margin-bottom:3.5rem}
        .divider{height:1px;background:var(--border);margin:3rem 0}.form-section{margin-bottom:2.5rem}.section-header-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem 1.25rem;margin-bottom:1rem}.section-header-row .section-label{margin-bottom:0;padding-right:.75rem}.section-label{display:flex;align-items:center;gap:.75rem;margin-bottom:1rem}.step-number{font-family:var(--font-mono);font-size:.65rem;color:var(--gold-dim);background:rgba(253,181,21,.12);border:1px solid rgba(253,181,21,.3);border-radius:var(--radius-pill);padding:.2rem .6rem;letter-spacing:.06em}.section-title{font-family:var(--font-mono);font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
        .day-strip{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:.45rem}.day-btn{font-family:var(--font-mono);font-size:.78rem;letter-spacing:.04em;min-width:2.35rem;padding:.45rem .65rem;border-radius:var(--radius-pill);border:1px solid var(--border);background:var(--chip-bg);color:var(--text);cursor:pointer}.day-btn.active{background:var(--navy);color:var(--gold);border-color:var(--navy)}
        .time-row{display:flex;align-items:center;gap:.8rem}.time-btn,.chip{font-family:var(--font-body);font-size:.9rem;border:1px solid var(--border);background:var(--chip-bg);color:var(--text);padding:.55rem 1rem;border-radius:var(--radius-pill);cursor:pointer}.time-btn.active,.chip.active{background:var(--navy);color:var(--gold);border-color:var(--navy)}
        .time-slider-wrap{flex:1;display:flex;align-items:center;gap:.75rem;min-width:220px}.time-slider{flex:1;appearance:none;height:6px;border-radius:999px;background:rgba(0,40,85,.15);outline:none}.time-slider::-webkit-slider-thumb{appearance:none;width:16px;height:16px;border-radius:50%;background:var(--navy);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);cursor:pointer}.time-slider::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:var(--navy);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);cursor:pointer}
        .time-readout{font-family:var(--font-mono);font-size:.78rem;color:var(--muted);min-width:72px;text-align:right}
        .chips{display:flex;flex-wrap:wrap;gap:.5rem}.cta-wrapper{margin-top:3rem}.cta-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:.75rem;background:var(--navy);color:var(--gold);border:none;border-radius:var(--radius-md);padding:1.05rem 2rem;font-family:var(--font-mono);font-size:.8rem;letter-spacing:.2em;text-transform:uppercase;cursor:pointer}.cta-btn:disabled{opacity:.6;cursor:not-allowed}
        .prominent-message{text-align:center;font-family:var(--font-display);font-size:clamp(1.35rem,3.6vw,1.9rem);line-height:1.28;color:var(--navy);letter-spacing:-.01em}.prominent-message--form{margin-top:3rem}.prominent-message--result{margin-top:1.25rem}.result-section{margin-top:3rem}.result-label{font-family:var(--font-mono);font-size:.65rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:1rem}
        .course-card{background:#fff;border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden}.card-body{padding:1.5rem 1.75rem}.card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;margin-bottom:1rem}.card-college{font-family:var(--font-display);font-size:1.2rem;line-height:1.25;color:var(--navy);margin:0 0 .3rem}.card-dept{font-family:var(--font-mono);font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
        .card-time-badge{font-family:var(--font-mono);font-size:.7rem;color:var(--gold-dim);background:rgba(253,181,21,.12);border:1px solid rgba(253,181,21,.3);border-radius:var(--radius-pill);padding:.25rem .7rem;white-space:nowrap}.card-title{font-family:var(--font-display);font-size:clamp(1.3rem,3vw,1.65rem);font-weight:300;line-height:1.2;color:var(--navy);margin-bottom:.4rem}
        .card-meta,.card-desc{color:var(--muted);font-size:.86rem;line-height:1.65;margin-bottom:1rem}.card-instructor-link{color:var(--navy);text-decoration:none;font-weight:500;border-bottom:1px solid rgba(0,40,85,.25)}.card-instructor-link:hover{border-bottom-color:var(--navy)}.card-divider{height:1px;background:var(--border);margin:1.25rem 0}.card-location{margin-bottom:1.25rem}.card-location a{color:var(--navy);text-decoration:none;font-weight:500}
        .card-tags{display:flex;flex-wrap:wrap;gap:.4rem}.card-tag{font-family:var(--font-body);font-size:.72rem;letter-spacing:0;text-transform:none;color:var(--muted);background:var(--cream);border:1px solid var(--border);border-radius:var(--radius-pill);padding:.25rem .65rem}
        .card-actions{display:flex;justify-content:flex-end;gap:.6rem;padding:1rem 1.75rem;border-top:1px solid var(--border);background:var(--cream)}.btn-secondary,.btn-primary{font-family:var(--font-mono);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;border-radius:var(--radius-sm);padding:.6rem 1.1rem;cursor:pointer}.btn-secondary{color:var(--navy);background:transparent;border:1px solid var(--border)}.btn-primary{color:var(--gold);background:var(--navy);border:1px solid var(--navy)}
        .skipped-section{margin-top:1rem;padding:1rem 1.25rem;border:1px solid var(--border);border-radius:var(--radius-md);background:#fff}
        .skipped-title{font-family:var(--font-mono);font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:.6rem}
        .skipped-list{display:flex;flex-wrap:wrap;gap:.4rem}
        .skipped-pill{font-family:var(--font-mono);font-size:.64rem;color:var(--muted);background:var(--cream);border:1px solid var(--border);border-radius:var(--radius-pill);padding:.22rem .55rem;cursor:pointer}
        .skipped-pill:hover{border-color:rgba(0,40,85,.35);color:var(--navy)}
        .redesign-root footer{border-top:1px solid var(--border);padding:1.25rem 2.5rem;display:flex;justify-content:space-between;background:var(--cream)}.footer-left{display:flex;align-items:center;gap:.85rem}.avatar{width:30px;height:30px;background:var(--navy);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:.68rem;color:var(--gold)}.footer-note{font-family:var(--font-mono);font-size:.65rem;color:var(--muted)}
      `}</style>
      <div className="redesign-root">
        <nav>
          <a className="logo" href="#">
            <div className="logo-mark">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <text x="2" y="13" fontFamily="Georgia" fontSize="12" fontWeight="bold" fill="#FDB515">CH</text>
              </svg>
            </div>
            <span className="logo-wordmark">ClassHop</span>
          </a>
          <div className="semester-toggle">
            <button className={`semester-btn ${semester === "Spring 2026" ? "active" : ""}`} onClick={() => setSemester("Spring 2026")} type="button">Spring 2026</button>
            <button className={`semester-btn ${semester === "Fall 2026" ? "active" : ""}`} onClick={() => setSemester("Fall 2026")} type="button">Fall 2026</button>
          </div>
        </nav>
        <main className="redesign-main">
          <h1 className="hero-title">Got a free hour?</h1>
          <p className="subheadline">Wander into a class.</p>
          <p className="description">Tell us when you&apos;re free and what sparks your curiosity. We&apos;ll find a real Berkeley class happening right now that you can quietly sit in on.</p>
          <div className="divider" />
          <div className="form-section">
            <div className="section-header-row">
              <div className="section-label">
                <span className="step-number">01</span>
                <span className="section-title">When are you free?{"\u00a0"}</span>
              </div>
              <div className="day-strip">
                {WEEKDAY_BUTTONS.map(({ token, label }) => (
                  <button
                    key={token}
                    type="button"
                    className={`day-btn ${selectedWeekday === token ? "active" : ""}`}
                    onClick={() => {
                      setSelectedWeekday(token);
                      setUsingNow(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
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
                    setSelectedMinutes(snapToHalfHour(Number(e.target.value)));
                    setUsingNow(false);
                  }}
                />
                <span className="time-readout">{formatMinutes12h(selectedMinutes)}</span>
              </div>
            </div>
          </div>
          <div className="form-section">
            <div className="section-label"><span className="step-number">02</span><span className="section-title">What are you into? <span style={{opacity:0.5,fontSize:"0.65rem"}}>(optional)</span></span></div>
            <div className="chips">
              {INTEREST_OPTIONS.map((interest) => (
                <button key={interest} type="button" className={`chip ${selectedInterests.includes(interest) ? "active" : ""}`} onClick={() => toggleInterest(interest)}>{interest}</button>
              ))}
            </div>
          </div>
          <div className="cta-wrapper">
            <button className="cta-btn" type="button" onClick={handleFindClass} disabled={isFinding || !selectedTime24}><span>{isFinding ? "Finding..." : "Find me a class"}</span></button>
          </div>
          {!isFinding && !currentCourse && filteredCourses.length === 0 && (
            <div className="prominent-message prominent-message--form">
              No classes match that combination.
              <br />
              Try a different day, time, or interest.
            </div>
          )}
          {(currentCourse || noMoreMatches || skippedCourses.length > 0) && (
            <div className="result-section">
              {currentCourse && <p className="result-label">Here&apos;s one for you</p>}
              {currentCourse && (
                <div className="course-card">
                  <div className="card-body">
                    <div className="card-top">
                      <div>
                        <p className="card-college">{getDisplayCollege(currentCourse)}</p>
                        <span className="card-dept">{getDisplayDepartment(currentCourse.department)}</span>
                      </div>
                      <span className="card-time-badge">{currentCourse.meetDays} · {formatTimeRange(currentCourse.startTime, currentCourse.endTime)}</span>
                    </div>
                    <h2 className="card-title">{currentCourse.title}</h2>
                    <p className="card-meta">{currentCourse.code} - <InstructorWithRmpLink instructor={currentCourse.instructor} /></p>
                    <div className="card-divider" />
                    <div className="card-location"><a href={buildMapsUrl(currentCourse.building)} target="_blank" rel="noreferrer">{formatBuildingLabel(currentCourse.building)}, Room {currentCourse.room}</a></div>
                    <p className="card-desc">{currentCourse.description}</p>
                    <div className="card-tags">{currentCourse.interests.map((tag)=><span key={tag} className="card-tag">{tag}</span>)}</div>
                  </div>
                  <div className="card-actions">
                    <button className="btn-secondary" type="button" onClick={() => downloadIcs(currentCourse)}>Add to Calendar</button>
                    <button className="btn-primary" type="button" onClick={handleFindAnother}>Find Another</button>
                  </div>
                </div>
              )}
              {noMoreMatches && (
                <div className="prominent-message prominent-message--result">No more classes match that combination.</div>
              )}
              {skippedCourses.length > 0 && (
                <div className="skipped-section">
                  <p className="skipped-title">Skipped classes</p>
                  <div className="skipped-list">
                    {skippedCourses.map((course) => (
                      <button
                        key={course.id}
                        type="button"
                        className="skipped-pill"
                        onClick={() => {
                          setCurrentCourse(course);
                          setNoMoreMatches(false);
                        }}
                      >
                        {course.code} - {course.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
        <footer>
          <div className="footer-left"><div className="avatar">CH</div><span className="footer-brand"><strong>ClassHop</strong> · UC Berkeley</span></div>
          <span className="footer-note">Times are approximations — verify with the official schedule.</span>
        </footer>
      </div>
    </>
  );
}

