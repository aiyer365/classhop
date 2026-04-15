"use client";

import { useMemo, useState } from "react";
import courses from "../data/courses.json";

type Semester = "Spring 2026" | "Fall 2026";
type Meridiem = "AM" | "PM";
type Interest =
  | "Science"
  | "Arts"
  | "Philosophy"
  | "Tech"
  | "History"
  | "Business"
  | "Social Science"
  | "Environment";

type Course = {
  id: string;
  title: string;
  code: string;
  department: string;
  instructor: string;
  building: string;
  room: string;
  walkingMinutes: number;
  startTime: string;
  endTime: string;
  interests: Interest[];
  description: string;
  semester?: Semester;
};

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

const allCourses: Course[] = (courses as unknown as Course[]).map((c) => ({
  ...c,
  id: String(c.id)
}));

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

function getCourseSemester(course: Course): Semester {
  return course.semester ?? "Spring 2026";
}

function buildMapsUrl(building: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${building}, UC Berkeley`
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
    `LOCATION:${course.building} ${course.room}`,
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

function to24Hour(hourText: string, minuteText: string, meridiem: Meridiem): string | null {
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  let h24 = hour % 12;
  if (meridiem === "PM") h24 += 12;
  return `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export default function HomePage() {
  const [semester, setSemester] = useState<Semester>("Spring 2026");
  const [hourText, setHourText] = useState("3");
  const [minuteText, setMinuteText] = useState("00");
  const [meridiem, setMeridiem] = useState<Meridiem>("PM");
  const [usingNow, setUsingNow] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>([]);
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [lastPool, setLastPool] = useState<Course[]>([]);
  const [isFinding, setIsFinding] = useState(false);

  const selectedTime24 = useMemo(
    () => to24Hour(hourText, minuteText, meridiem),
    [hourText, minuteText, meridiem]
  );

  const filteredCourses = useMemo(() => {
    if (!selectedTime24) return [];
    const selectedMoment = parseTimeToday(selectedTime24);
    return allCourses.filter((course) => {
      if (getCourseSemester(course) !== semester) return false;
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
  }, [selectedTime24, selectedInterests, semester]);

  function handleNow() {
    const now = new Date();
    let hour24 = now.getHours();
    const minutes = now.getMinutes();
    let roundedMinute = 0;
    if (minutes < 20) roundedMinute = 0;
    else if (minutes < 50) roundedMinute = 30;
    else {
      roundedMinute = 0;
      hour24 = (hour24 + 1) % 24;
    }
    let h12 = hour24 % 12;
    if (h12 === 0) h12 = 12;
    setHourText(String(h12));
    setMinuteText(String(roundedMinute).padStart(2, "0"));
    setMeridiem(hour24 >= 12 ? "PM" : "AM");
    setUsingNow(true);
  }

  function toggleInterest(interest: Interest) {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  }

  function handleFindClass() {
    setCurrentCourse(null);
    if (filteredCourses.length === 0) {
      setLastPool([]);
      return;
    }
    setIsFinding(true);
    setLastPool(filteredCourses);
    window.setTimeout(() => {
      const idx = Math.floor(Math.random() * filteredCourses.length);
      setCurrentCourse(filteredCourses[idx]);
      setIsFinding(false);
    }, 300);
  }

  function handleFindAnother() {
    if (lastPool.length === 0) return;
    if (lastPool.length === 1) {
      setCurrentCourse(lastPool[0]);
      return;
    }
    let next: Course | null = null;
    for (let i = 0; i < 10; i += 1) {
      const candidate = lastPool[Math.floor(Math.random() * lastPool.length)];
      if (!currentCourse || candidate.id !== currentCourse.id) {
        next = candidate;
        break;
      }
    }
    if (next) setCurrentCourse(next);
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
        .redesign-main{flex:1;max-width:680px;width:100%;margin:0 auto;padding:4rem 2rem 6rem}.eyebrow{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-dim);margin-bottom:1.5rem}
        .hero-title{font-family:var(--font-display);font-size:clamp(2.6rem,6vw,3.75rem);font-weight:300;line-height:1.08;color:var(--navy);letter-spacing:-.02em;margin-bottom:.75rem}.subheadline{font-family:var(--font-display);font-size:clamp(1.3rem,3vw,1.6rem);font-weight:300;font-style:italic;color:var(--gold-dim);margin-bottom:1.75rem}.description{font-size:1rem;line-height:1.75;color:var(--muted);max-width:520px;margin-bottom:3.5rem}
        .divider{height:1px;background:var(--border);margin:3rem 0}.form-section{margin-bottom:2.5rem}.section-label{display:flex;align-items:center;gap:.75rem;margin-bottom:1rem}.step-number{font-family:var(--font-mono);font-size:.65rem;color:var(--gold-dim);background:rgba(253,181,21,.12);border:1px solid rgba(253,181,21,.3);border-radius:var(--radius-pill);padding:.2rem .6rem;letter-spacing:.06em}.section-title{font-family:var(--font-mono);font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
        .time-row{display:flex;align-items:center;gap:.5rem}.time-btn,.chip{font-size:.9rem;border:1px solid var(--border);background:var(--chip-bg);color:var(--text);padding:.55rem 1rem;border-radius:var(--radius-pill);cursor:pointer}.time-btn.active,.chip.active{background:var(--navy);color:var(--gold);border-color:var(--navy)}
        .time-input{font-family:var(--font-mono);font-size:.95rem;width:48px;text-align:center;border:1px solid var(--border);background:var(--chip-bg);color:var(--text);padding:.55rem .4rem;border-radius:var(--radius-sm);outline:none}.time-sep{font-family:var(--font-mono);color:var(--muted);font-size:1.1rem;margin:0 -.1rem}
        .ampm-group{display:flex;border:1px solid var(--border);border-radius:var(--radius-pill);overflow:hidden;background:var(--chip-bg);margin-left:.25rem}.ampm-btn{font-family:var(--font-mono);font-size:.75rem;letter-spacing:.06em;padding:.5rem .85rem;border:none;background:transparent;color:var(--muted);cursor:pointer}.ampm-btn.active{background:var(--navy);color:var(--gold)}
        .chips{display:flex;flex-wrap:wrap;gap:.5rem}.cta-wrapper{margin-top:3rem}.cta-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:.75rem;background:var(--navy);color:var(--gold);border:none;border-radius:var(--radius-md);padding:1.05rem 2rem;font-family:var(--font-mono);font-size:.8rem;letter-spacing:.2em;text-transform:uppercase;cursor:pointer}.cta-btn:disabled{opacity:.6;cursor:not-allowed}
        .empty-state{margin-top:3rem;font-family:var(--font-mono);font-size:.78rem;color:var(--muted);letter-spacing:.04em;line-height:1.6}.result-section{margin-top:3rem}.result-label{font-family:var(--font-mono);font-size:.65rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:1rem}
        .course-card{background:#fff;border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden}.card-body{padding:1.5rem 1.75rem}.card-top{display:flex;justify-content:space-between;gap:1rem;margin-bottom:1rem}.card-dept{font-family:var(--font-mono);font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
        .card-time-badge{font-family:var(--font-mono);font-size:.7rem;color:var(--gold-dim);background:rgba(253,181,21,.12);border:1px solid rgba(253,181,21,.3);border-radius:var(--radius-pill);padding:.25rem .7rem;white-space:nowrap}.card-title{font-family:var(--font-display);font-size:clamp(1.3rem,3vw,1.65rem);font-weight:300;line-height:1.2;color:var(--navy);margin-bottom:.4rem}
        .card-meta,.card-desc{color:var(--muted);font-size:.86rem;line-height:1.65;margin-bottom:1rem}.card-divider{height:1px;background:var(--border);margin:1.25rem 0}.card-location{margin-bottom:1.25rem}.card-location a{color:var(--navy);text-decoration:none;font-weight:500}
        .card-tags{display:flex;flex-wrap:wrap;gap:.4rem}.card-tag{font-family:var(--font-mono);font-size:.65rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);background:var(--cream);border:1px solid var(--border);border-radius:var(--radius-pill);padding:.25rem .65rem}
        .card-actions{display:flex;justify-content:flex-end;gap:.6rem;padding:1rem 1.75rem;border-top:1px solid var(--border);background:var(--cream)}.btn-secondary,.btn-primary{font-family:var(--font-mono);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;border-radius:var(--radius-sm);padding:.6rem 1.1rem;cursor:pointer}.btn-secondary{color:var(--navy);background:transparent;border:1px solid var(--border)}.btn-primary{color:var(--gold);background:var(--navy);border:1px solid var(--navy)}
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
          <div className="eyebrow">Serendipitous learning</div>
          <h1 className="hero-title">Got a free hour?</h1>
          <p className="subheadline">Wander into a class.</p>
          <p className="description">Tell us when you&apos;re free and what sparks your curiosity. We&apos;ll find a real Berkeley class happening right now that you can quietly sit in on.</p>
          <div className="divider" />
          <div className="form-section">
            <div className="section-label"><span className="step-number">01</span><span className="section-title">When are you free?</span></div>
            <div className="time-row">
              <button className={`time-btn ${usingNow ? "active" : ""}`} type="button" onClick={handleNow}>Now</button>
              <input className="time-input" type="text" maxLength={2} value={hourText} onChange={(e)=>{setHourText(e.target.value.replace(/\D/g,"").slice(0,2));setUsingNow(false);}} />
              <span className="time-sep">:</span>
              <input className="time-input" type="text" maxLength={2} value={minuteText} onChange={(e)=>{setMinuteText(e.target.value.replace(/\D/g,"").slice(0,2));setUsingNow(false);}} />
              <div className="ampm-group">
                <button className={`ampm-btn ${meridiem === "AM" ? "active" : ""}`} type="button" onClick={()=>setMeridiem("AM")}>AM</button>
                <button className={`ampm-btn ${meridiem === "PM" ? "active" : ""}`} type="button" onClick={()=>setMeridiem("PM")}>PM</button>
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
          {!isFinding && !currentCourse && filteredCourses.length === 0 && <div className="empty-state">No classes match that combo. Try a different time or fewer interests.</div>}
          {currentCourse && (
            <div className="result-section">
              <p className="result-label">Here&apos;s one for you</p>
              <div className="course-card">
                <div className="card-body">
                  <div className="card-top"><span className="card-dept">{currentCourse.department}</span><span className="card-time-badge">{formatTimeRange(currentCourse.startTime, currentCourse.endTime)}</span></div>
                  <h2 className="card-title">{currentCourse.title}</h2>
                  <p className="card-meta">{currentCourse.code} - {currentCourse.instructor}</p>
                  <div className="card-divider" />
                  <div className="card-location"><a href={buildMapsUrl(currentCourse.building)} target="_blank" rel="noreferrer">{currentCourse.building}, room {currentCourse.room}</a><p className="card-meta">~{currentCourse.walkingMinutes} min walk from Sather Gate</p></div>
                  <p className="card-desc">{currentCourse.description}</p>
                  <div className="card-tags">{currentCourse.interests.map((tag)=><span key={tag} className="card-tag">{tag}</span>)}</div>
                </div>
                <div className="card-actions">
                  <button className="btn-secondary" type="button" onClick={() => downloadIcs(currentCourse)}>Add to Calendar</button>
                  <button className="btn-primary" type="button" onClick={handleFindAnother}>Find Another</button>
                </div>
              </div>
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

