import { useEffect, useMemo, useState } from 'react';
import { ProjectsService } from './generated/services/ProjectsService';

type NavItem = 'Dashboard' | 'Reports' | 'Settings';
type StatusType = 'Draft' | 'Submitted' | 'Approved';

interface Project {
  id: string;
  name: string;
}

interface DayEntry {
  dateIso: string;
  project: string;
  hours: string;
  notes: string;
}

interface WeekState {
  [weekKey: string]: DayEntry[];
}

const FALLBACK_PROJECTS: Project[] = [
  { id: 'proj-1', name: 'Projects' },
  { id: 'proj-2', name: 'Administration' },
  { id: 'proj-3', name: 'Training' },
  { id: 'proj-4', name: 'Operations' },
];

const STATUS_CHIPS: StatusType[] = ['Draft', 'Submitted', 'Approved'];
const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getStartOfWeek(date: Date): Date {
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = normalized.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diffToMonday);
  return normalized;
}

function addDays(date: Date, daysToAdd: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + daysToAdd);
  return next;
}

function formatDayLabel(isoDate: string): string {
  return fromIsoDate(isoDate).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const startLabel = weekStart.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  });
  const endLabel = weekEnd.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${startLabel} - ${endLabel}`;
}

function isToday(isoDate: string): boolean {
  return isoDate === toIsoDate(new Date());
}

function buildWeekEntries(weekStart: Date, defaultProject: string): DayEntry[] {
  const seededHours = ['8', '7.5', '8', '6.5', '8', '2', '0'];
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    return {
      dateIso: toIsoDate(date),
      project: defaultProject,
      hours: seededHours[index],
      notes: index < 5 ? 'Project delivery and stakeholder updates.' : 'Admin and planning.',
    };
  });
}

function parseHours(hours: string): number {
  const parsed = Number(hours);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isHoursValid(hours: string): boolean {
  const parsed = parseHours(hours);
  if (!Number.isFinite(parsed)) {
    return false;
  }
  if (parsed < 0 || parsed > 24) {
    return false;
  }
  const halfHourStep = Math.round(parsed * 2);
  return Math.abs(parsed * 2 - halfHourStep) < 0.00001;
}

function getSafeHours(hours: string): number {
  return isHoursValid(hours) ? parseHours(hours) : 0;
}

function getWeekKey(weekStart: Date): string {
  return toIsoDate(weekStart);
}

function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) {
    return null;
  }

  const particles = Array.from({ length: 28 }, (_, index) => ({
    id: index,
    left: `${(index % 14) * 7 + 2}%`,
    delay: `${(index % 7) * 0.05}s`,
    duration: `${1.4 + (index % 5) * 0.15}s`,
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-12vh) rotate(0deg); opacity: 0; }
          8% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(420deg); opacity: 0; }
        }
      `}</style>
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="absolute h-2.5 w-2.5 rounded-sm bg-gradient-to-br from-slate-500 to-gray-600"
          style={{
            left: particle.left,
            animationName: 'confetti-fall',
            animationDelay: particle.delay,
            animationDuration: particle.duration,
            animationTimingFunction: 'ease-out',
            animationIterationCount: 1,
          }}
        />
      ))}
    </div>
  );
}

function App() {
  const [navOpen, setNavOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<NavItem>('Dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectSource, setProjectSource] = useState<'service' | 'fallback'>('service');
  const [weekStart, setWeekStart] = useState<Date>(() => getStartOfWeek(new Date()));
  const [weeks, setWeeks] = useState<WeekState>({});
  const [toastVisible, setToastVisible] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadProjects() {
      try {
        const result = await ProjectsService.getAll({ top: 500, orderBy: ['Title asc'] });

        if (!result.success) {
          throw result.error ?? new Error('Failed to load projects');
        }

        const mapped = result.data
          .map((record) => ({ id: String(record.ID ?? record.Title ?? ''), name: (record.Title ?? '').trim() }))
          .filter((project) => project.name.length > 0);

        const uniqueProjects = mapped.filter(
          (project, index, array) => array.findIndex((candidate) => candidate.name === project.name) === index,
        );

        if (!mounted || uniqueProjects.length === 0) {
          throw new Error('No projects returned from service');
        }

        setProjects(uniqueProjects);
        setProjectSource('service');
      } catch {
        if (mounted) {
          setProjects(FALLBACK_PROJECTS);
          setProjectSource('fallback');
        }
      }
    }

    void loadProjects();

    return () => {
      mounted = false;
    };
  }, []);

  const availableProjects = projects.length > 0 ? projects : FALLBACK_PROJECTS;
  const defaultProject = availableProjects[0]?.name ?? 'Projects';
  const weekKey = getWeekKey(weekStart);

  useEffect(() => {
    setWeeks((prev) => {
      if (prev[weekKey]) {
        return prev;
      }

      return {
        ...prev,
        [weekKey]: buildWeekEntries(weekStart, defaultProject),
      };
    });
  }, [defaultProject, weekKey, weekStart]);

  const currentWeekEntries = weeks[weekKey] ?? buildWeekEntries(weekStart, defaultProject);

  const invalidEntryExists = useMemo(
    () => currentWeekEntries.some((entry) => !isHoursValid(entry.hours)),
    [currentWeekEntries],
  );

  const weeklyTotal = useMemo(
    () => currentWeekEntries.reduce((sum, entry) => sum + getSafeHours(entry.hours), 0),
    [currentWeekEntries],
  );

  const projectBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    currentWeekEntries.forEach((entry) => {
      const nextTotal = (totals.get(entry.project) ?? 0) + getSafeHours(entry.hours);
      totals.set(entry.project, nextTotal);
    });
    return Array.from(totals.entries()).map(([project, total]) => ({ project, total }));
  }, [currentWeekEntries]);

  const overtime = weeklyTotal > 40;

  function updateEntry(index: number, patch: Partial<DayEntry>) {
    setWeeks((prev) => {
      const existingWeek = prev[weekKey] ?? buildWeekEntries(weekStart, defaultProject);
      const nextWeek = existingWeek.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      );
      return {
        ...prev,
        [weekKey]: nextWeek,
      };
    });
  }

  function moveWeek(offset: number) {
    setWeekStart((prev) => addDays(prev, offset * 7));
  }

  function handleSubmit() {
    if (invalidEntryExists) {
      return;
    }

    setToastVisible(true);
    setConfettiActive(true);
    window.setTimeout(() => setToastVisible(false), 2200);
    window.setTimeout(() => setConfettiActive(false), 1500);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white text-gray-800">
      <ConfettiBurst active={confettiActive} />

      <header className="fixed inset-x-0 top-0 z-40 border-b border-gray-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-2 py-1 text-sm font-medium text-gray-700 md:hidden"
              onClick={() => setNavOpen((open) => !open)}
              aria-label="Toggle sidebar"
              aria-expanded={navOpen}
            >
              Menu
            </button>
            <div className="rounded-xl bg-gradient-to-r from-slate-500 to-gray-600 px-3 py-1.5 text-sm font-semibold text-white shadow-lg">
              Weekly Timesheet
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-gray-400"
              onClick={() => moveWeek(-1)}
            >
              Prev
            </button>
            <p className="min-w-40 text-center text-sm font-medium text-gray-700">{formatWeekRange(weekStart)}</p>
            <button
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-gray-400"
              onClick={() => moveWeek(1)}
            >
              Next
            </button>
          </div>

          <div className="rounded-full bg-gradient-to-r from-slate-500 to-gray-600 px-3 py-1 text-xs font-semibold text-white shadow-md sm:text-sm">
            {weeklyTotal.toFixed(1)}/40h
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 border-t border-gray-200/80 px-4 py-2 sm:hidden">
          <button
            type="button"
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700"
            onClick={() => moveWeek(-1)}
          >
            Prev
          </button>
          <p className="text-center text-sm font-medium text-gray-700">{formatWeekRange(weekStart)}</p>
          <button
            type="button"
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700"
            onClick={() => moveWeek(1)}
          >
            Next
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pb-8 pt-24 sm:px-6 lg:px-8 md:flex-row md:pt-24">
        <aside
          className={`w-full rounded-xl border border-gray-200/70 bg-white/90 p-4 shadow-xl backdrop-blur-xl md:w-[250px] ${
            navOpen ? 'block' : 'hidden md:block'
          }`}
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-slate-500 to-gray-600 text-sm font-bold text-white">
              MD
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Michael Dockray</p>
              <p className="text-xs text-gray-500">Timesheet Owner</p>
            </div>
          </div>

          <nav aria-label="Sidebar navigation" className="space-y-2">
            {(['Dashboard', 'Reports', 'Settings'] as NavItem[]).map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setActiveNav(item)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  activeNav === item
                    ? 'bg-gradient-to-r from-slate-500 to-gray-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {item}
              </button>
            ))}
          </nav>

          <div className="mt-5 border-t border-gray-200 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_CHIPS.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <p className="mt-4 text-xs text-gray-500">
            Projects source: {projectSource === 'service' ? 'ProjectsService' : 'Fallback mock list'}
          </p>
        </aside>

        <main className="flex-1 space-y-4">
          <section className="rounded-xl border border-gray-200/70 bg-white/90 p-3 shadow-xl backdrop-blur-xl">
            <div className="grid grid-cols-7 gap-2 rounded-lg bg-gradient-to-r from-slate-500 to-gray-600 p-2 text-center text-xs font-semibold text-white sm:text-sm">
              {WEEKDAY_SHORT.map((label, index) => {
                const dateIso = currentWeekEntries[index]?.dateIso;
                const activeToday = dateIso ? isToday(dateIso) : false;
                return (
                  <div
                    key={label}
                    className={`rounded-md px-2 py-2 ${activeToday ? 'bg-white/30 ring-1 ring-white/70' : 'bg-white/10'}`}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {currentWeekEntries.map((entry, index) => {
              const hoursValid = isHoursValid(entry.hours);
              const numericHours = getSafeHours(entry.hours);

              return (
                <article
                  key={entry.dateIso}
                  className="rounded-xl border border-gray-200/70 bg-white/90 p-4 shadow-xl backdrop-blur-xl transition duration-200 hover:scale-[1.01] hover:shadow-2xl"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-900 sm:text-base">{formatDayLabel(entry.dateIso)}</h2>
                    {isToday(entry.dateIso) && (
                      <span className="rounded-full bg-gradient-to-r from-slate-500 to-gray-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                        Today
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600" htmlFor={`project-${index}`}>
                        Project
                      </label>
                      <select
                        id={`project-${index}`}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        value={entry.project}
                        onChange={(event) => updateEntry(index, { project: event.target.value })}
                      >
                        {availableProjects.map((project) => (
                          <option key={project.id} value={project.name}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600" htmlFor={`hours-${index}`}>
                        Hours (0 - 24)
                      </label>
                      <input
                        id={`hours-${index}`}
                        type="number"
                        min={0}
                        max={24}
                        step={0.5}
                        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:ring-2 ${
                          hoursValid
                            ? 'border-gray-300 focus:border-slate-500 focus:ring-slate-200'
                            : 'border-red-400 focus:border-red-500 focus:ring-red-200'
                        }`}
                        value={entry.hours}
                        onChange={(event) => updateEntry(index, { hours: event.target.value })}
                        aria-invalid={!hoursValid}
                      />
                      {!hoursValid && (
                        <p className="mt-1 text-xs font-medium text-red-600">Enter hours in 0.5 increments between 0 and 24.</p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600" htmlFor={`notes-${index}`}>
                        Notes
                      </label>
                      <textarea
                        id={`notes-${index}`}
                        rows={3}
                        className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        value={entry.notes}
                        onChange={(event) => updateEntry(index, { notes: event.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
                    Daily total: {numericHours.toFixed(1)}h
                  </div>
                </article>
              );
            })}
          </section>

          <section className="rounded-xl border border-gray-200/70 bg-white/90 p-4 shadow-xl backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Project breakdown</p>
                <div className="flex flex-wrap gap-2">
                  {projectBreakdown.map((item) => (
                    <span
                      key={item.project}
                      className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700"
                    >
                      {item.project}: {item.total.toFixed(1)}h
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800">
                  Grand total: {weeklyTotal.toFixed(1)}h
                </div>
                <div
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                    overtime
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-gray-200 bg-gray-50 text-gray-700'
                  }`}
                >
                  {overtime ? 'Overtime alert' : 'Within target'}
                </div>
                <button
                  type="button"
                  disabled={invalidEntryExists}
                  onClick={handleSubmit}
                  className="rounded-lg bg-gradient-to-r from-slate-500 to-gray-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition duration-150 hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Submit for Approval
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>

      {toastVisible && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-xl">
          Submitted!
        </div>
      )}
    </div>
  );
}

export default App;
