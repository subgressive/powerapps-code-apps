import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChefHat,
  Clock3,
  Flame,
  Snowflake,
  Users,
  Thermometer,
  Undo2,
  UserRound,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { COOKLOGSRead, COOKLOGSWrite } from './generated/models/COOKLOGSModel';
import { COOKLOGSService } from './generated/services/COOKLOGSService';
import { ProductsService } from './generated/services/ProductsService';
import type { StaffRead } from './generated/models/StaffModel';
import { StaffService } from './generated/services/StaffService';

type NavItem = 'Cooking' | 'Cooling' | 'Reheat' | 'Staff';

interface CookingFormValues {
  product: string;
  date: string;
  startTime: string;
  endTime: string;
  temp: string;
  correctiveAction: string;
  initial: string;
}

const cardMotion = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const galleryColumnsClass =
  'grid min-w-[1020px] grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_minmax(90px,0.8fr)_minmax(90px,0.8fr)_minmax(80px,0.7fr)_minmax(90px,0.8fr)_minmax(250px,2.4fr)] items-center gap-x-3';

function toDateInputValue(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function isTodayValue(value?: string): boolean {
  if (!value) {
    return false;
  }

  const today = new Date();
  const isoToday = toDateInputValue(today);
  const usToday = today.toLocaleDateString('en-US');

  if (value.startsWith(isoToday) || value === usToday) {
    return true;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return (
    parsed.getFullYear() === today.getFullYear() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getDate() === today.getDate()
  );
}

function formatReadableDateTime(date: Date): string {
  return date.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getTextValue(record: COOKLOGSRead, key: keyof COOKLOGSRead, fallbackKey?: string): string {
  const primary = record[key];
  if (typeof primary === 'string' && primary.trim().length > 0) {
    return primary;
  }

  if (fallbackKey) {
    const fallback = (record as Record<string, unknown>)[fallbackKey];
    if (typeof fallback === 'string') {
      return fallback;
    }
  }

  return '';
}

function ConfettiBurst({ active }: { active: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }).map((_, index) => ({
        id: index,
        left: `${(index / 27) * 100}%`,
        duration: 1 + (index % 5) * 0.12,
      })),
    [],
  );

  if (!active) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 h-0 overflow-visible">
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          className="absolute h-2 w-2 rounded-sm bg-gradient-to-br from-slate-300 to-zinc-500"
          style={{ left: piece.left }}
          initial={{ y: 0, rotate: 0, opacity: 1 }}
          animate={{
            y: 160 + (piece.id % 8) * 9,
            x: ((piece.id % 2 === 0 ? -1 : 1) * (18 + piece.id * 2)),
            rotate: 270,
            opacity: 0,
          }}
          transition={{ duration: piece.duration, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

function App() {
  const [activeNav, setActiveNav] = useState<NavItem>('Cooking');
  const [now, setNow] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logs, setLogs] = useState<COOKLOGSRead[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [staffList, setStaffList] = useState<StaffRead[]>([]);
  const [isStaffLoading, setIsStaffLoading] = useState(true);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [selectedStaffInitial, setSelectedStaffInitial] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CookingFormValues>({
    defaultValues: {
      product: '',
      date: toDateInputValue(new Date()),
      startTime: '08:00',
      endTime: '14:00',
      temp: '165',
      correctiveAction: 'None required',
      initial: '',
    },
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  async function loadTodayCookingLogs() {
    try {
      setIsLoading(true);
      setLoadError(null);

      const result = await COOKLOGSService.getAll({
        top: 100,
        orderBy: ['Created desc'],
      });

      if (!result.success) {
        throw result.error ?? new Error('Unable to fetch cooking logs.');
      }

      const todaysLogs = result.data.filter((record) => isTodayValue(record.Date));
      setLogs(todaysLogs);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load cooking logs.');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadProducts() {
    try {
      setIsProductsLoading(true);

      const result = await ProductsService.getAll({
        top: 500,
        orderBy: ['Title asc'],
      });

      if (!result.success) {
        throw result.error ?? new Error('Unable to load products.');
      }

      const productNames = result.data
        .map((item) => item.Title?.trim() ?? '')
        .filter((title, index, allTitles) => title.length > 0 && allTitles.indexOf(title) === index);

      setProducts(productNames);

      const currentProduct = getValues('product');
      if ((!currentProduct || !productNames.includes(currentProduct)) && productNames.length > 0) {
        setValue('product', productNames[0], { shouldValidate: true });
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load products.');
    } finally {
      setIsProductsLoading(false);
    }
  }

  async function loadStaff() {
    try {
      setIsStaffLoading(true);

      let loadedStaff: StaffRead[] = [];

      const staffResult = await StaffService.getAll({
        top: 500,
        orderBy: ['Title asc'],
      });

      if (!staffResult.success) {
        throw staffResult.error ?? new Error('Unable to load staff.');
      }

      loadedStaff = staffResult.data;

      const cleanedStaff = loadedStaff.filter((item) => item.Title?.trim());
      setStaffList(cleanedStaff);

      if (cleanedStaff.length > 0) {
        const firstStaff = cleanedStaff[0];
        const initial = firstStaff.Initial?.trim() || '';
        setSelectedStaffId(firstStaff.ID ?? null);
        setSelectedStaffInitial(initial);
        setValue('initial', initial, { shouldValidate: true });
      } else {
        setSelectedStaffId(null);
        setSelectedStaffInitial('');
        setValue('initial', '', { shouldValidate: true });
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load staff.');
    } finally {
      setIsStaffLoading(false);
    }
  }

  useEffect(() => {
    void loadTodayCookingLogs();
    void loadProducts();
    void loadStaff();
  }, []);

  async function onSubmit(values: CookingFormValues) {
    try {
      setIsSubmitting(true);

      const payload: Omit<COOKLOGSWrite, 'ID'> & Record<string, unknown> = {
        Title: values.product,
        Date: values.date,
        StartTime: values.startTime,
        EndTime: values.endTime,
        Temp: values.temp,
        Correctiveaction: values.correctiveAction,
        Initial: selectedStaffInitial || values.initial,
      };

      // Some SharePoint lists keep space-encoded internal names after manual column creation.
      payload.Start_x0020_Time = values.startTime;
      payload.End_x0020_Time = values.endTime;

      const result = await COOKLOGSService.create(payload as Omit<COOKLOGSWrite, 'ID'>);

      if (!result.success) {
        throw result.error ?? new Error('Unable to submit cooking log.');
      }

      setToastVisible(true);
      setConfettiActive(true);

      window.setTimeout(() => setToastVisible(false), 2200);
      window.setTimeout(() => setConfettiActive(false), 1300);

      reset({
        product: values.product,
        date: toDateInputValue(new Date()),
        startTime: '08:00',
        endTime: '14:00',
        temp: '165',
        correctiveAction: 'None required',
        initial: selectedStaffInitial || values.initial,
      });

      await loadTodayCookingLogs();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to submit cooking log.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-700">
      <ConfettiBurst active={confettiActive} />

      <motion.header
        className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-slate-100/95 backdrop-blur-xl"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-white/15 bg-gradient-to-br from-slate-400 to-zinc-600 p-2 text-slate-900 shadow-xl">
              <ChefHat className="h-5 w-5" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">HealthLogs</h1>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm sm:text-sm">
            <Clock3 className="h-4 w-4" />
            <span>{formatReadableDateTime(now)}</span>
          </div>
        </div>
      </motion.header>

      <motion.main
        className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 pb-28 pt-20 sm:px-6 lg:px-8 md:flex-row"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45 }}
      >
        <aside className="w-full rounded-2xl border border-slate-200 bg-slate-200/70 p-3 shadow-sm backdrop-blur-xl md:sticky md:top-20 md:h-[calc(100vh-7rem)] md:w-[100px] md:flex-shrink-0">
          <div className="mb-4 flex items-center gap-3 md:flex-col md:gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-slate-300 text-sm font-semibold text-slate-800">
              {selectedStaffInitial || '--'}
            </div>
            <div className="text-xs font-medium text-slate-700 md:text-center">Pit Crew</div>
          </div>

          <nav className="grid grid-cols-4 gap-2 md:grid-cols-1">
            {([
              { label: 'Cooking', icon: Flame },
              { label: 'Cooling', icon: Snowflake },
              { label: 'Reheat', icon: Undo2 },
              { label: 'Staff', icon: Users },
            ] as const).map(({ label, icon: Icon }) => {
              const isActive = label === activeNav;
              return (
                <button
                  type="button"
                  key={label}
                  onClick={() => setActiveNav(label)}
                  className={[
                    'flex items-center justify-center gap-2 rounded-xl border px-2 py-2 text-xs font-semibold transition md:flex-col md:py-3',
                    isActive
                      ? 'border-slate-300 bg-slate-100 text-slate-900'
                      : 'border-slate-300 bg-slate-200 text-slate-700 hover:border-slate-400 hover:text-slate-900',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-4">
          {activeNav === 'Staff' ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-200/70 p-4 shadow-sm backdrop-blur-xl sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">Staff</h2>
                <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {staffList.length} Staff
                </span>
              </div>

              {isStaffLoading ? (
                <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm">Loading staff…</div>
              ) : staffList.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm">No staff found</div>
              ) : (
                <div className="grid gap-2">
                  {staffList.map((staff, index) => {
                    const staffId = staff.ID ?? index;
                    const staffName = staff.Title?.trim() || 'Unnamed Staff';
                    const staffInitial = staff.Initial?.trim() || '—';
                    const isSelected = selectedStaffId === staff.ID;

                    return (
                      <label
                        key={staffId}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-800"
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-semibold text-slate-900">{staffName}</span>
                          <span className="text-xs text-slate-700">Initial: {staffInitial}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={Boolean(isSelected)}
                          onChange={() => {
                            setSelectedStaffId(staff.ID ?? null);
                            setSelectedStaffInitial(staff.Initial?.trim() || '');
                            setValue('initial', staff.Initial?.trim() || '', { shouldValidate: true });
                          }}
                          className="h-4 w-4 rounded border-slate-300 accent-slate-700"
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <>
          <div className="rounded-2xl border border-slate-200 bg-slate-200/70 p-4 shadow-sm backdrop-blur-xl sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">Cooking Log Gallery</h2>
              <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {logs.length} Today
              </span>
            </div>

            {isLoading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm">Loading logs…</div>
            ) : logs.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm">No items for today</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="grid gap-1">
                  <div className={`${galleryColumnsClass} px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600`}>
                    <span>Product</span>
                    <span>Date</span>
                    <span>Start</span>
                    <span>End</span>
                    <span>Temp</span>
                    <span>Initial</span>
                    <span>Corrective Notes</span>
                  </div>

                  {logs.map((log, index) => (
                    <motion.article
                      key={log.ID ?? `${log.Title}-${index}`}
                      variants={cardMotion}
                      initial="hidden"
                      animate="visible"
                      transition={{ duration: 0.35, delay: index * 0.06 }}
                      className="px-1 py-1"
                    >
                      <div className={`${galleryColumnsClass} text-xs text-slate-700`}>
                        <span className="truncate font-bold text-slate-900">{log.Title || 'Untitled Product'}</span>
                        <span className="truncate">{log.Date || '—'}</span>
                        <span className="truncate">{getTextValue(log, 'StartTime', 'Start_x0020_Time') || '—'}</span>
                        <span className="truncate">{getTextValue(log, 'EndTime', 'End_x0020_Time') || '—'}</span>
                        <span className="truncate">{log.Temp ? `${log.Temp}°` : '—'}</span>
                        <span className="truncate">{log.Initial || '—'}</span>
                        <span className="truncate">{log.Correctiveaction || '—'}</span>
                      </div>
                    </motion.article>
                  ))}
                </div>
              </div>
            )}
          </div>

          <motion.form
            onSubmit={handleSubmit(onSubmit)}
            className="rounded-2xl border border-slate-200 bg-slate-200/70 p-4 shadow-sm backdrop-blur-xl sm:p-5"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <h2 className="mb-4 text-base font-semibold tracking-tight text-slate-900 sm:text-lg">Cooking Log Form</h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-medium text-slate-700">
                Product
                <select
                  {...register('product', { required: 'Product is required' })}
                  disabled={isProductsLoading || products.length === 0}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                >
                  <option value="">
                    {isProductsLoading ? 'Loading products...' : products.length === 0 ? 'No products found' : 'Select product'}
                  </option>
                  {products.map((productName) => (
                    <option key={productName} value={productName}>
                      {productName}
                    </option>
                  ))}
                </select>
                {errors.product && <span className="mt-1 block text-[11px] text-red-300">{errors.product.message}</span>}
              </label>

              <label className="text-xs font-medium text-slate-700">
                Date
                <input
                  type="date"
                  {...register('date', { required: 'Date is required' })}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                />
              </label>

              <label className="text-xs font-medium text-slate-700">
                Start Time
                <input
                  type="time"
                  {...register('startTime', { required: 'Start time is required' })}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                />
              </label>

              <label className="text-xs font-medium text-slate-700">
                End Time
                <input
                  type="time"
                  {...register('endTime', { required: 'End time is required' })}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                />
              </label>

              <label className="text-xs font-medium text-slate-700">
                Temp
                <div className="relative mt-1">
                  <Thermometer className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    {...register('temp', { required: 'Temperature is required' })}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                    placeholder="165"
                  />
                </div>
              </label>

              <label className="text-xs font-medium text-slate-700">
                Initial
                <div className="relative mt-1">
                  <UserRound className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    {...register('initial', { required: 'Initial is required', maxLength: 4 })}
                    readOnly
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm uppercase text-slate-900 outline-none transition focus:border-slate-500"
                    placeholder="Select staff"
                  />
                </div>
              </label>

              <label className="text-xs font-medium text-slate-700 sm:col-span-2 lg:col-span-3">
                Corrective Action
                <textarea
                  {...register('correctiveAction')}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                  placeholder="Action taken if temp is out of range"
                />
              </label>
            </div>
          </motion.form>
            </>
          )}
        </section>
      </motion.main>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-slate-100/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <span className="text-xs font-medium text-slate-700">Cooking summary ready for COOK LOGS submission.</span>
          <motion.button
            type="button"
            onClick={handleSubmit(onSubmit)}
            whileTap={{ scale: 0.95 }}
            disabled={isSubmitting}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-700 px-5 text-sm font-semibold leading-none text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </motion.button>
        </div>
      </footer>

      {toastVisible && (
        <motion.div
          className="fixed right-4 top-20 z-50 rounded-xl border border-white/15 bg-slate-900/90 px-4 py-3 text-sm font-semibold text-slate-100 shadow-2xl"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          Submitted!
        </motion.div>
      )}

      {loadError && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-red-300/30 bg-red-950/70 px-4 py-2 text-xs font-medium text-red-100 shadow-xl backdrop-blur">
          {loadError}
        </div>
      )}
    </div>
  );
}

export default App;
