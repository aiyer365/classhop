"use client";

import { useMemo, useState } from "react";
import courses from "../data/courses.json";

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
  lat: number;
  lng: number;
  walkingMinutes: number;
  startTime: string;
  endTime: string;
  interests: Interest[];
  description: string;
};

const INTEREST_OPTIONS: Interest[] = [
  "Science",
  "Arts",
  "Philosophy",
  "Tech",
  "History",
  "Business",
  "Social Science",
  "Environment",
];

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
  return `${to12h(start)} – ${to12h(end)}`;
}

function buildMapsUrl(building: string) {
  const query = `${building}, UC Berkeley`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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
    return (
      d.getFullYear().toString() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      "T" +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      pad(d.getSeconds())
    );
  };

  const dtStamp = toIcsDate(new Date());
  const dtStart = toIcsDate(start);
  const dtEnd = toIcsDate(end);

  const location = `${course.building} ${course.room}`;
  const summary = `${course.title} (${course.code})`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ClassHop//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${course.id}@classhop.berkeley`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${course.description.replace(/\r?\n/g, " ")}`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR",
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

const allCourses: Course[] = (courses as unknown as Course[]).map((c) => ({
  ...c,
  id: String((c as any).id),
}));

function findNextCourseStart(now: Date): string {
  let next: Date | null = null;

  for (const course of allCourses) {
    const start = parseTimeToday(course.startTime);
    if (start <= now) continue;
    if (!next || start < next) next = start;
  }

  if (!next) {
    for (const course of allCourses) {
      const start = parseTimeToday(course.startTime);
      if (!next || start < next) next = start;
    }
  }

  if (!next) next = now;

  const h = String(next.getHours()).padStart(2, "0");
  const m = String(next.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export default function HomePage() {
  const defaultTime = useMemo(() => findNextCourseStart(new Date()), []);
  const [timeValue, setTimeValue] = useState<string>(defaultTime);
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>([]);
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [lastPool, setLastPool] = useState<Course[]>([]);
  const [isFinding, setIsFinding] = useState(false);
  const [searched, setSearched] = useState(false);

  const filteredCourses = useMemo(() => {
    const selectedMoment = parseTimeToday(timeValue);

    return allCourses.filter((course) => {
      if (selectedInterests.length > 0) {
        const intersects = course.interests.some((i) =>
          (selectedInterests as Interest[]).includes(i)
        );
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

      const remainingMs = cEnd.getTime() - selectedMoment.getTime();
      const hasThirtyMinutesLeft = inSession && remainingMs >= 30 * 60 * 1000;

      return startMatches || hasThirtyMinutesLeft;
    });
  }, [timeValue, selectedInterests]);

  function toggleInterest(interest: Interest) {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  }

  function handleNow() {
    const now = new Date();
    let hours24 = now.getHours();
    const minutes = now.getMinutes();

    let roundedMinutes: number;
    if (minutes < 20) {
      roundedMinutes = 0;
    } else if (minutes < 50) {
      roundedMinutes = 30;
    } else {
      roundedMinutes = 0;
      hours24 = (hours24 + 1) % 24;
    }

    const h = String(hours24).padStart(2, "0");
    const m = String(roundedMinutes).padStart(2, "0");
    setTimeValue(`${h}:${m}`);
  }

  function handleFindClass() {
    setSearched(true);
    if (filteredCourses.length === 0) {
      setLastPool([]);
      setCurrentCourse(null);
      return;
    }

    setIsFinding(true);
    setLastPool(filteredCourses);

    window.setTimeout(() => {
      const idx = Math.floor(Math.random() * filteredCourses.length);
      setCurrentCourse(filteredCourses[idx]);
      setIsFinding(false);
    }, 350);
  }

  function handleFindAnother() {
    if (!lastPool.length) return;
    if (lastPool.length === 1) {
      setCurrentCourse(lastPool[0]);
      return;
    }
    let next: Course | null = null;
    let attempts = 0;
    while (!next && attempts < 10) {
      const idx = Math.floor(Math.random() * lastPool.length);
      const candidate = lastPool[idx];
      if (!currentCourse || candidate.id !== currentCourse.id) {
        next = candidate;
      }
      attempts += 1;
    }
    if (next) setCurrentCourse(next);
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <section className="pt-2 pb-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-slate-400">
          UC Berkeley · Free Hour Discovery
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
          Wander into a class.
        </h1>
        <p className="mt-1.5 text-[15px] text-slate-500">
          Pick a time, pick an interest, get a random Berkeley lecture to sit in on.
        </p>
      </section>

      {/* Discovery form */}
      <section className="rounded-xl bg-slate-50 border border-slate-100 px-5 py-6 sm:px-7 sm:py-7 space-y-6">
        {/* Time */}
        <div className="space-y-2.5">
          <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
            When are you free?
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleNow}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 transition-all duration-150 hover:border-slate-400 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003262]/30"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Now
            </button>
            <input
              type="time"
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] font-medium text-slate-900 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#003262]/20 focus:border-[#003262]/50"
            />
          </div>
        </div>

        {/* Interests */}
        <div className="space-y-2.5">
          <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
            What are you into?{" "}
            <span className="normal-case tracking-normal font-normal text-slate-400">
              (leave blank for anything)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((interest) => {
              const active = selectedInterests.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003262]/30 ${
                    active
                      ? "bg-[#003262] text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-slate-400 hover:text-slate-900"
                  }`}
                >
                  {interest}
                </button>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={handleFindClass}
          disabled={isFinding}
          className="w-full rounded-lg bg-[#003262] px-6 py-3.5 text-[14px] font-semibold text-white tracking-tight transition-all duration-200 hover:bg-[#00284f] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003262]/40"
        >
          {isFinding ? "Finding…" : "Find me a class"}
        </button>
      </section>

      {/* Results */}
      {searched && !currentCourse && !isFinding && (
        <section>
          <p className="text-[14px] text-slate-500">
            No classes match that combo. Try a different time or fewer interests.
          </p>
        </section>
      )}

      {currentCourse && !isFinding && (
        <section className="animate-fade-slide-up">
          <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 space-y-4">
              {/* Top row */}
              <div className="flex items-start justify-between gap-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                  {currentCourse.department}
                </p>
                <span className="shrink-0 rounded-full bg-[#FDB515]/15 px-3 py-1 text-[12px] font-semibold text-[#8B6914]">
                  {formatTimeRange(currentCourse.startTime, currentCourse.endTime)}
                </span>
              </div>

              {/* Title + meta */}
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 leading-snug">
                  {currentCourse.title}
                </h2>
                <p className="mt-1 text-[13px] text-slate-500">
                  {currentCourse.code} · {currentCourse.instructor}
                </p>
              </div>

              <div className="border-t border-slate-100" />

              {/* Location */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[13px] text-slate-700">
                  <svg width="14" height="14" style={{flexShrink: 0, color: '#94a3b8'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0L6.343 16.657a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <a
                    href={buildMapsUrl(currentCourse.building)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#003262] underline-offset-2 hover:underline"
                  >
                    {currentCourse.building}
                  </a>
                  <span className="text-slate-400">Room {currentCourse.room}</span>
                </div>
                <div className="flex items-center gap-2 text-[13px] text-slate-500">
                  <svg width="14" height="14" style={{flexShrink: 0, color: '#94a3b8'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {currentCourse.walkingMinutes} min walk from Sather Gate
                </div>
              </div>

              {/* Description */}
              <p className="text-[14px] leading-relaxed text-slate-600 line-clamp-3">
                {currentCourse.description}
              </p>

              {/* Tags */}
              {currentCourse.interests.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {currentCourse.interests.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-3.5">
              <button
                type="button"
                onClick={() => downloadIcs(currentCourse)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003262]/30"
              >
                Add to Calendar
              </button>
              <button
                type="button"
                onClick={handleFindAnother}
                className="rounded-lg bg-[#003262] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#00284f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003262]/40"
              >
                Find Another
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
