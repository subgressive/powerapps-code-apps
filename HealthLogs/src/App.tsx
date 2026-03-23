import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChefHat,
  Clock3,
  Flame,
  Lock,
  Save,
  Snowflake,
  Users,
  Thermometer,
  Droplets,
  Undo2,
  UserRound,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { COOKLOGSRead, COOKLOGSWrite } from './generated/models/COOKLOGSModel';
import { COOKLOGSService } from './generated/services/COOKLOGSService';
import type { COOLINGLOGSRead, COOLINGLOGSWrite } from './generated/models/COOLINGLOGSModel';
import { COOLINGLOGSService } from './generated/services/COOLINGLOGSService';
import type { REHEATLOGSRead, REHEATLOGSWrite } from './generated/models/REHEATLOGSModel';
import { REHEATLOGSService } from './generated/services/REHEATLOGSService';
import type { THAWINGLOGSRead, THAWINGLOGSWrite } from './generated/models/THAWINGLOGSModel';
import { THAWINGLOGSService } from './generated/services/THAWINGLOGSService';
import { ProductsService } from './generated/services/ProductsService';
import type { StaffRead } from './generated/models/StaffModel';
import { StaffService } from './generated/services/StaffService';

type NavItem = 'Cooking' | 'Cooling' | 'Reheat' | 'Thawing' | 'Staff';

interface CookingFormValues {
  product: string;
  date: string;
  startTime: string;
  endTime: string;
  temp: string;
  correctiveAction: string;
  initial: string;
}

interface CoolingFormValues {
  product: string;
  date: string;
  startTime: string;
  startTemp: string;
  initial: string;
}

interface CoolingRowDraft {
  twoHourTime: string;
  twoHourTemp: string;
  fourHourTime: string;
  fourHourTemp: string;
}

interface ReheatFormValues {
  product: string;
  date: string;
  startTime: string;
  endTime: string;
  temp: string;
  correctiveAction: string;
  initial: string;
}

interface ThawingFormValues {
  product: string;
  date: string;
  startTime: string;
  startTemp: string;
  initial: string;
}

interface ThawingRowDraft {
  endDate: string;
  endTime: string;
  endTemp: string;
  approvedSafe: string;
  correctiveAction: string;
  completed: string;
}

const cardMotion = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const galleryColumnsClass =
  'grid min-w-[1020px] grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_minmax(90px,0.8fr)_minmax(90px,0.8fr)_minmax(80px,0.7fr)_minmax(90px,0.8fr)_minmax(250px,2.4fr)] items-center gap-x-3';

const coolingGalleryColumnsClass =
  'grid min-w-[980px] grid-cols-[minmax(120px,1.2fr)_minmax(96px,0.8fr)_minmax(80px,0.65fr)_minmax(80px,0.65fr)_minmax(82px,0.65fr)_minmax(82px,0.65fr)_minmax(82px,0.65fr)_minmax(82px,0.65fr)_minmax(56px,0.45fr)_minmax(44px,0.35fr)] items-center gap-x-2';

const thawingGalleryColumnsClass =
  'grid min-w-[980px] grid-cols-[minmax(88px,0.9fr)_minmax(90px,0.72fr)_minmax(75px,0.62fr)_minmax(68px,0.52fr)_minmax(104px,0.82fr)_minmax(82px,0.66fr)_minmax(72px,0.56fr)_minmax(56px,0.4fr)_minmax(150px,1.25fr)_minmax(56px,0.4fr)_minmax(42px,0.3fr)] items-center gap-x-2';

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

function formatToAmPm(hours24: number, minutes: number): string {
  const normalizedHour = ((hours24 + 11) % 12) + 1;
  const minutePart = String(minutes).padStart(2, '0');
  const period = hours24 >= 12 ? 'PM' : 'AM';
  return `${normalizedHour}:${minutePart} ${period}`;
}

function getCurrentTimeAmPm(): string {
  const now = new Date();
  return formatToAmPm(now.getHours(), now.getMinutes());
}

function normalizeTimeAmPm(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const twentyFourHourMatch = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (twentyFourHourMatch) {
    const hours = Number(twentyFourHourMatch[1]);
    const minutes = Number(twentyFourHourMatch[2]);
    return formatToAmPm(hours, minutes);
  }

  const twelveHourMatch = trimmed.match(/^(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*([AaPp][Mm])$/);
  if (twelveHourMatch) {
    const hour = Number(twelveHourMatch[1]);
    const minute = Number(twelveHourMatch[2] ?? '00');
    const period = twelveHourMatch[3].toUpperCase();
    const hours24 = period === 'PM' ? (hour % 12) + 12 : hour % 12;
    return formatToAmPm(hours24, minute);
  }

  return trimmed;
}

function hasValue(value?: string): boolean {
  return Boolean(value && value.trim().length > 0);
}

function normalizeTemperatureInput(value: string): string {
  const normalized = value.replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);

  if (!normalized || Number.isNaN(parsed)) {
    return '';
  }

  return String(parsed);
}

function formatTemperatureDisplay(value?: string): string {
  if (!hasValue(value)) {
    return '—';
  }

  const normalized = normalizeTemperatureInput(value ?? '');
  return normalized ? `${normalized}°` : '—';
}

function getCoolingRowStage(log: COOLINGLOGSRead): 'twoHour' | 'fourHour' | 'complete' {
  const hasTwoHourTime = hasValue(log.OData__x0032_HTime);
  const hasTwoHourTemp = hasValue(log.OData__x0032_HTemp);
  const hasFourHourTime = hasValue(log.OData__x0034_HTime);
  const hasFourHourTemp = hasValue(log.OData__x0034_HTemp);

  if (hasTwoHourTime && hasTwoHourTemp && hasFourHourTime && hasFourHourTemp) {
    return 'complete';
  }

  if (hasTwoHourTime && hasTwoHourTemp) {
    return 'fourHour';
  }

  return 'twoHour';
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
  const [activeNav, setActiveNav] = useState<NavItem>('Staff');
  const [now, setNow] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCoolingSubmitting, setIsCoolingSubmitting] = useState(false);
  const [isReheatSubmitting, setIsReheatSubmitting] = useState(false);
  const [isThawingSubmitting, setIsThawingSubmitting] = useState(false);
  const [savingRowId, setSavingRowId] = useState<number | null>(null);
  const [logs, setLogs] = useState<COOKLOGSRead[]>([]);
  const [coolingLogs, setCoolingLogs] = useState<COOLINGLOGSRead[]>([]);
  const [reheatLogs, setReheatLogs] = useState<REHEATLOGSRead[]>([]);
  const [thawingLogs, setThawingLogs] = useState<THAWINGLOGSRead[]>([]);
  const [thawingRowDrafts, setThawingRowDrafts] = useState<Record<number, ThawingRowDraft>>({});
  const [coolingRowDrafts, setCoolingRowDrafts] = useState<Record<number, CoolingRowDraft>>({});
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
    clearErrors,
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

  const {
    register: registerCooling,
    handleSubmit: handleSubmitCooling,
    clearErrors: clearCoolingErrors,
    getValues: getCoolingValues,
    setValue: setCoolingValue,
    reset: resetCooling,
    formState: { errors: coolingErrors },
  } = useForm<CoolingFormValues>({
    defaultValues: {
      product: '',
      date: toDateInputValue(new Date()),
      startTime: getCurrentTimeAmPm(),
      startTemp: '135',
      initial: '',
    },
  });

  const {
    register: registerReheat,
    handleSubmit: handleSubmitReheat,
    clearErrors: clearReheatErrors,
    getValues: getReheatValues,
    setValue: setReheatValue,
    reset: resetReheat,
    formState: { errors: reheatErrors },
  } = useForm<ReheatFormValues>({
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

  const {
    register: registerThawing,
    handleSubmit: handleSubmitThawing,
    clearErrors: clearThawingErrors,
    getValues: getThawingValues,
    setValue: setThawingValue,
    reset: resetThawing,
    formState: { errors: thawingErrors },
  } = useForm<ThawingFormValues>({
    defaultValues: {
      product: '',
      date: toDateInputValue(new Date()),
      startTime: getCurrentTimeAmPm(),
      startTemp: '',
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

  async function loadTodayCoolingLogs(showLoading = true) {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      setLoadError(null);

      const result = await COOLINGLOGSService.getAll({
        top: 100,
        orderBy: ['Created desc'],
      });

      if (!result.success) {
        throw result.error ?? new Error('Unable to fetch cooling logs.');
      }

      const todaysLogs = result.data.filter((record) => isTodayValue(record.Date));
      setCoolingLogs(todaysLogs);

      const nextDrafts: Record<number, CoolingRowDraft> = {};
      todaysLogs.forEach((log) => {
        if (typeof log.ID === 'number') {
          nextDrafts[log.ID] = {
            twoHourTime: log.OData__x0032_HTime ?? '',
            twoHourTemp: log.OData__x0032_HTemp ?? '',
            fourHourTime: log.OData__x0034_HTime ?? '',
            fourHourTemp: log.OData__x0034_HTemp ?? '',
          };
        }
      });
      setCoolingRowDrafts(nextDrafts);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load cooling logs.');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }

  async function loadTodayReheatLogs() {
    try {
      setIsLoading(true);
      setLoadError(null);

      const result = await REHEATLOGSService.getAll({
        top: 100,
        orderBy: ['Created desc'],
      });

      if (!result.success) {
        throw result.error ?? new Error('Unable to fetch reheat logs.');
      }

      const todaysLogs = result.data.filter((record) => isTodayValue(record.Date));
      setReheatLogs(todaysLogs);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load reheat logs.');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadThawingLogs(showLoading = true) {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      setLoadError(null);

      const result = await THAWINGLOGSService.getAll({
        top: 500,
        orderBy: ['Created desc'],
      });

      if (!result.success) {
        throw result.error ?? new Error('Unable to fetch thawing logs.');
      }

      const openLogs = result.data.filter((record) => record.Completed?.Value !== 'Yes');
      setThawingLogs(openLogs);

      const nextDrafts: Record<number, ThawingRowDraft> = {};
      openLogs.forEach((log) => {
        if (typeof log.ID === 'number') {
          nextDrafts[log.ID] = {
            endDate: log.EndDate ?? '',
            endTime: log.EndTime ?? '',
            endTemp: log.EndTemp ?? '',
            approvedSafe: log.ApprovedSafe?.Value ?? 'No',
            correctiveAction: log.Correctiveaction ?? '',
            completed: log.Completed?.Value ?? 'No',
          };
        }
      });
      setThawingRowDrafts(nextDrafts);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load thawing logs.');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
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

      const currentCoolingProduct = getCoolingValues('product');
      if ((!currentCoolingProduct || !productNames.includes(currentCoolingProduct)) && productNames.length > 0) {
        setCoolingValue('product', productNames[0], { shouldValidate: true });
      }

      const currentReheatProduct = getReheatValues('product');
      if ((!currentReheatProduct || !productNames.includes(currentReheatProduct)) && productNames.length > 0) {
        setReheatValue('product', productNames[0], { shouldValidate: true });
      }

      const currentThawingProduct = getThawingValues('product');
      if ((!currentThawingProduct || !productNames.includes(currentThawingProduct)) && productNames.length > 0) {
        setThawingValue('product', productNames[0], { shouldValidate: true });
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
        setCoolingValue('initial', initial, { shouldValidate: true });
        setReheatValue('initial', initial, { shouldValidate: true });
        setThawingValue('initial', initial, { shouldValidate: true });
      } else {
        setSelectedStaffId(null);
        setSelectedStaffInitial('');
        setValue('initial', '', { shouldValidate: true });
        setCoolingValue('initial', '', { shouldValidate: true });
        setReheatValue('initial', '', { shouldValidate: true });
        setThawingValue('initial', '', { shouldValidate: true });
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load staff.');
    } finally {
      setIsStaffLoading(false);
    }
  }

  useEffect(() => {
    void loadTodayCookingLogs();
    void loadTodayCoolingLogs();
    void loadTodayReheatLogs();
    void loadThawingLogs();
    void loadProducts();
    void loadStaff();
  }, []);

  async function onSubmit(values: CookingFormValues) {
    try {
      setIsSubmitting(true);

      const payload: Omit<COOKLOGSWrite, 'ID'> = {
        Title: values.product,
        Date: values.date,
        StartTime: values.startTime,
        EndTime: values.endTime,
        Temp: values.temp,
        Correctiveaction: values.correctiveAction,
        Initial: selectedStaffInitial || values.initial,
      };

      const result = await COOKLOGSService.create(payload);

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

  async function onSubmitCooling(values: CoolingFormValues) {
    try {
      setIsCoolingSubmitting(true);

      const payload: Omit<COOLINGLOGSWrite, 'ID'> = {
        Title: values.product,
        Date: values.date,
        StartTime: normalizeTimeAmPm(values.startTime) || getCurrentTimeAmPm(),
        StartTemp: values.startTemp,
        OData__x0032_HTime: '',
        OData__x0032_HTemp: '',
        OData__x0034_HTime: '',
        OData__x0034_HTemp: '',
        Initial: selectedStaffInitial || values.initial,
      };

      const result = await COOLINGLOGSService.create(payload);

      if (!result.success) {
        throw result.error ?? new Error('Unable to submit cooling log.');
      }

      setToastVisible(true);
      setConfettiActive(true);

      window.setTimeout(() => setToastVisible(false), 2200);
      window.setTimeout(() => setConfettiActive(false), 1300);

      resetCooling({
        product: values.product,
        date: toDateInputValue(new Date()),
        startTime: getCurrentTimeAmPm(),
        startTemp: '135',
        initial: selectedStaffInitial || values.initial,
      });

      await loadTodayCoolingLogs();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to submit cooling log.');
    } finally {
      setIsCoolingSubmitting(false);
    }
  }

  async function onSubmitReheat(values: ReheatFormValues) {
    try {
      setIsReheatSubmitting(true);

      const payload: Omit<REHEATLOGSWrite, 'ID'> = {
        Title: values.product,
        Date: values.date,
        StartTime: values.startTime,
        EndTime: values.endTime,
        Temp: values.temp,
        Correctiveaction: values.correctiveAction,
        Initial: selectedStaffInitial || values.initial,
      };

      const result = await REHEATLOGSService.create(payload);

      if (!result.success) {
        throw result.error ?? new Error('Unable to submit reheat log.');
      }

      setToastVisible(true);
      setConfettiActive(true);

      window.setTimeout(() => setToastVisible(false), 2200);
      window.setTimeout(() => setConfettiActive(false), 1300);

      resetReheat({
        product: values.product,
        date: toDateInputValue(new Date()),
        startTime: '08:00',
        endTime: '14:00',
        temp: '165',
        correctiveAction: 'None required',
        initial: selectedStaffInitial || values.initial,
      });

      await loadTodayReheatLogs();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to submit reheat log.');
    } finally {
      setIsReheatSubmitting(false);
    }
  }

  async function onSubmitThawing(values: ThawingFormValues) {
    try {
      setIsThawingSubmitting(true);

      const payload = {
        Title: values.product,
        Date: values.date,
        StartTime: normalizeTimeAmPm(values.startTime) || getCurrentTimeAmPm(),
        StartTemp: values.startTemp,
        ApprovedSafe: { Value: 'No' },
        Completed: { Value: 'No' },
        Initial: selectedStaffInitial || values.initial,
      } as unknown as Omit<THAWINGLOGSWrite, 'ID'>;

      const result = await THAWINGLOGSService.create(payload);

      if (!result.success) {
        throw result.error ?? new Error('Unable to submit thawing log.');
      }

      setToastVisible(true);
      setConfettiActive(true);
      window.setTimeout(() => setToastVisible(false), 2200);
      window.setTimeout(() => setConfettiActive(false), 1300);

      resetThawing({
        product: values.product,
        date: toDateInputValue(new Date()),
        startTime: getCurrentTimeAmPm(),
        startTemp: '',
        initial: selectedStaffInitial || values.initial,
      });

      await loadThawingLogs();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to submit thawing log.');
    } finally {
      setIsThawingSubmitting(false);
    }
  }

  function updateCoolingRowDraft(id: number, field: keyof CoolingRowDraft, value: string) {
    setCoolingRowDrafts((previous) => ({
      ...previous,
      [id]: {
        twoHourTime: previous[id]?.twoHourTime ?? '',
        twoHourTemp: previous[id]?.twoHourTemp ?? '',
        fourHourTime: previous[id]?.fourHourTime ?? '',
        fourHourTemp: previous[id]?.fourHourTemp ?? '',
        [field]: value,
      },
    }));
  }

  async function saveCoolingRow(log: COOLINGLOGSRead) {
    if (typeof log.ID !== 'number') {
      return;
    }

    const draft = coolingRowDrafts[log.ID];
    if (!draft) {
      return;
    }

    const stage = getCoolingRowStage(log);

    try {
      setSavingRowId(log.ID);

      if (stage === 'twoHour') {
        if (!hasValue(draft.twoHourTime) || !hasValue(draft.twoHourTemp)) {
          throw new Error('Enter both 2H time and 2H temp before saving.');
        }

        const normalizedTwoHourTime = normalizeTimeAmPm(draft.twoHourTime);
        if (!normalizedTwoHourTime) {
          throw new Error('2H time is required.');
        }

        const normalizedTwoHourTemp = normalizeTemperatureInput(draft.twoHourTemp);
        if (!normalizedTwoHourTemp) {
          throw new Error('2H temp must be a numeric value.');
        }

        const updateResult = await COOLINGLOGSService.update(log.ID.toString(), {
          OData__x0032_HTime: normalizedTwoHourTime,
          OData__x0032_HTemp: normalizedTwoHourTemp,
        });

        if (!updateResult.success) {
          throw updateResult.error ?? new Error('Unable to save 2H values.');
        }
      }

      if (stage === 'fourHour') {
        if (!hasValue(draft.fourHourTime) || !hasValue(draft.fourHourTemp)) {
          throw new Error('Enter both 4H time and 4H temp before saving.');
        }

        const normalizedFourHourTime = normalizeTimeAmPm(draft.fourHourTime);
        if (!normalizedFourHourTime) {
          throw new Error('4H time is required.');
        }

        const normalizedFourHourTemp = normalizeTemperatureInput(draft.fourHourTemp);
        if (!normalizedFourHourTemp) {
          throw new Error('4H temp must be a numeric value.');
        }

        const updateResult = await COOLINGLOGSService.update(log.ID.toString(), {
          OData__x0034_HTime: normalizedFourHourTime,
          OData__x0034_HTemp: normalizedFourHourTemp,
        });

        if (!updateResult.success) {
          throw updateResult.error ?? new Error('Unable to save 4H values.');
        }
      }

      await loadTodayCoolingLogs(false);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to save cooling row.');
    } finally {
      setSavingRowId(null);
    }
  }

  function updateThawingRowDraft(id: number, field: keyof ThawingRowDraft, value: string) {
    setThawingRowDrafts((previous) => ({
      ...previous,
      [id]: {
        endDate: previous[id]?.endDate ?? '',
        endTime: previous[id]?.endTime ?? '',
        endTemp: previous[id]?.endTemp ?? '',
        approvedSafe: previous[id]?.approvedSafe ?? 'No',
        correctiveAction: previous[id]?.correctiveAction ?? '',
        completed: previous[id]?.completed ?? 'No',
        [field]: value,
      },
    }));
  }

  async function saveThawingRow(log: THAWINGLOGSRead) {
    if (typeof log.ID !== 'number') {
      return;
    }

    const draft = thawingRowDrafts[log.ID];
    if (!draft) {
      return;
    }

    try {
      setSavingRowId(log.ID);

      const updateResult = await THAWINGLOGSService.update(log.ID.toString(), {
        EndDate: draft.endDate || undefined,
        EndTime: normalizeTimeAmPm(draft.endTime) || undefined,
        EndTemp: normalizeTemperatureInput(draft.endTemp) || undefined,
        ApprovedSafe: { Value: draft.approvedSafe } as unknown as string,
        Correctiveaction: draft.correctiveAction || undefined,
        Completed: { Value: draft.completed } as unknown as string,
        Initial: selectedStaffInitial || log.Initial || undefined,
      });

      if (!updateResult.success) {
        throw updateResult.error ?? new Error('Unable to save thawing row.');
      }

      await loadThawingLogs(false);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to save thawing row.');
    } finally {
      setSavingRowId(null);
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
              { label: 'Staff', icon: Users },
              { label: 'Cooking', icon: Flame },
              { label: 'Cooling', icon: Snowflake },
              { label: 'Reheat', icon: Undo2 },
              { label: 'Thawing', icon: Droplets },
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
                            setCoolingValue('initial', staff.Initial?.trim() || '', { shouldValidate: true });
                            setReheatValue('initial', staff.Initial?.trim() || '', { shouldValidate: true });
                            setThawingValue('initial', staff.Initial?.trim() || '', { shouldValidate: true });
                          }}
                          className="h-4 w-4 rounded border-slate-300 accent-slate-700"
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeNav === 'Cooling' ? (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-200/70 p-4 shadow-sm backdrop-blur-xl sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">Cooling Log Gallery</h2>
                  <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {coolingLogs.length} Today
                  </span>
                </div>

                {isLoading ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm">Loading logs…</div>
                ) : coolingLogs.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm">No items for today</div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="grid gap-1">
                      <div className={`${coolingGalleryColumnsClass} px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600`}>
                        <span>Product</span>
                        <span>Date</span>
                        <span>Start</span>
                        <span>Start Temp</span>
                        <span>2H Time</span>
                        <span>2H Temp</span>
                        <span>4H Time</span>
                        <span>4H Temp</span>
                        <span>Initial</span>
                        <span>Save</span>
                      </div>

                      {coolingLogs.map((log, index) => {
                        const itemKey = log.ID ?? `${log.Title}-${index}`;
                        const stage = getCoolingRowStage(log);
                        const rowId = log.ID;
                        const draft = typeof rowId === 'number'
                          ? (coolingRowDrafts[rowId] ?? {
                              twoHourTime: log.OData__x0032_HTime ?? '',
                              twoHourTemp: log.OData__x0032_HTemp ?? '',
                              fourHourTime: log.OData__x0034_HTime ?? '',
                              fourHourTemp: log.OData__x0034_HTemp ?? '',
                            })
                          : {
                              twoHourTime: log.OData__x0032_HTime ?? '',
                              twoHourTemp: log.OData__x0032_HTemp ?? '',
                              fourHourTime: log.OData__x0034_HTime ?? '',
                              fourHourTemp: log.OData__x0034_HTemp ?? '',
                            };
                        const canEditTwoHour = stage === 'twoHour';
                        const canEditFourHour = stage === 'fourHour';
                        const rowSaving = typeof rowId === 'number' && savingRowId === rowId;

                        return (
                          <motion.article
                            key={itemKey}
                            variants={cardMotion}
                            initial="hidden"
                            animate="visible"
                            transition={{ duration: 0.35, delay: index * 0.06 }}
                            className="px-1 py-1"
                          >
                            <div className={`${coolingGalleryColumnsClass} text-xs text-slate-700`}>
                              <span className="truncate font-bold text-slate-900">{log.Title || 'Untitled Product'}</span>
                              <span className="truncate">{log.Date || '—'}</span>
                              <span className="truncate">{log.StartTime || '—'}</span>
                              <span className="truncate">{log.StartTemp ? `${log.StartTemp}°` : '—'}</span>

                              <input
                                type="text"
                                value={draft.twoHourTime}
                                readOnly={!canEditTwoHour}
                                disabled={!canEditTwoHour || rowSaving}
                                onFocus={() => {
                                  if (canEditTwoHour && typeof rowId === 'number' && !hasValue(draft.twoHourTime)) {
                                    updateCoolingRowDraft(rowId, 'twoHourTime', getCurrentTimeAmPm());
                                  }
                                }}
                                onChange={(event) => {
                                  if (typeof rowId === 'number') {
                                    updateCoolingRowDraft(rowId, 'twoHourTime', event.target.value);
                                  }
                                }}
                                onBlur={(event) => {
                                  if (typeof rowId === 'number') {
                                    updateCoolingRowDraft(rowId, 'twoHourTime', normalizeTimeAmPm(event.target.value));
                                  }
                                }}
                                className="h-7 rounded-md border border-slate-300 bg-white px-1.5 text-xs text-slate-900 disabled:border-transparent disabled:bg-transparent disabled:text-slate-600"
                                placeholder="h:mm AM/PM"
                              />

                              {canEditTwoHour ? (
                                <input
                                  value={draft.twoHourTemp}
                                  readOnly={false}
                                  disabled={rowSaving}
                                  onChange={(event) => {
                                    if (typeof rowId === 'number') {
                                      updateCoolingRowDraft(rowId, 'twoHourTemp', event.target.value.replace(/[^0-9.-]/g, ''));
                                    }
                                  }}
                                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 disabled:bg-slate-100 disabled:text-slate-600"
                                  placeholder="Temp"
                                  inputMode="decimal"
                                />
                              ) : (
                                <span className="truncate text-slate-700">{formatTemperatureDisplay(draft.twoHourTemp)}</span>
                              )}

                              <input
                                type="text"
                                value={draft.fourHourTime}
                                readOnly={!canEditFourHour}
                                disabled={!canEditFourHour || rowSaving}
                                onFocus={() => {
                                  if (canEditFourHour && typeof rowId === 'number' && !hasValue(draft.fourHourTime)) {
                                    updateCoolingRowDraft(rowId, 'fourHourTime', getCurrentTimeAmPm());
                                  }
                                }}
                                onChange={(event) => {
                                  if (typeof rowId === 'number') {
                                    updateCoolingRowDraft(rowId, 'fourHourTime', event.target.value);
                                  }
                                }}
                                onBlur={(event) => {
                                  if (typeof rowId === 'number') {
                                    updateCoolingRowDraft(rowId, 'fourHourTime', normalizeTimeAmPm(event.target.value));
                                  }
                                }}
                                className="h-7 rounded-md border border-slate-300 bg-white px-1.5 text-xs text-slate-900 disabled:border-transparent disabled:bg-transparent disabled:text-slate-600"
                                placeholder="h:mm AM/PM"
                              />

                              {canEditFourHour ? (
                                <input
                                  value={draft.fourHourTemp}
                                  readOnly={false}
                                  disabled={rowSaving}
                                  onChange={(event) => {
                                    if (typeof rowId === 'number') {
                                      updateCoolingRowDraft(rowId, 'fourHourTemp', event.target.value.replace(/[^0-9.-]/g, ''));
                                    }
                                  }}
                                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 disabled:bg-slate-100 disabled:text-slate-600"
                                  placeholder="Temp"
                                  inputMode="decimal"
                                />
                              ) : (
                                <span className="truncate text-slate-700">{formatTemperatureDisplay(draft.fourHourTemp)}</span>
                              )}

                              <span className="truncate">{log.Initial || '—'}</span>

                              <button
                                type="button"
                                disabled={stage === 'complete' || rowSaving || typeof rowId !== 'number'}
                                onClick={() => void saveCoolingRow(log)}
                                title={stage === 'complete' ? 'Locked' : rowSaving ? 'Saving' : 'Save'}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-700 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-transparent disabled:text-slate-500"
                              >
                                {stage === 'complete' ? (
                                  <Lock className="h-3.5 w-3.5" />
                                ) : rowSaving ? (
                                  <Clock3 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Save className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </motion.article>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <motion.form
                onSubmit={handleSubmitCooling(onSubmitCooling)}
                className="rounded-2xl border border-slate-200 bg-slate-200/70 p-4 shadow-sm backdrop-blur-xl sm:p-5"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <h2 className="mb-4 text-base font-semibold tracking-tight text-slate-900 sm:text-lg">Cooling Log Form</h2>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-xs font-medium text-slate-700">
                    Product
                    <select
                      {...registerCooling('product', {
                        required: 'Product is required',
                        validate: (value) => value.trim().length > 0 || 'Product is required',
                        onChange: () => clearCoolingErrors('product'),
                      })}
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
                    {coolingErrors.product && <span className="mt-1 block text-[11px] text-red-300">{coolingErrors.product.message}</span>}
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    Date
                    <input
                      type="date"
                      {...registerCooling('date', { required: 'Date is required' })}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                    />
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    Start Time
                    <input
                      type="text"
                      {...registerCooling('startTime', {
                        required: 'Start time is required',
                        setValueAs: (value) => normalizeTimeAmPm(value ?? ''),
                      })}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                      placeholder={getCurrentTimeAmPm()}
                    />
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    Start Temp
                    <div className="relative mt-1">
                      <Thermometer className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                      <input
                        {...registerCooling('startTemp', { required: 'Start temp is required' })}
                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                        placeholder="135"
                      />
                    </div>
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    2H Time
                    <input
                      type="text"
                      readOnly
                      value=""
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600 outline-none"
                    />
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    2H Temp
                    <input
                      readOnly
                      value=""
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600 outline-none"
                    />
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    4H Time
                    <input
                      type="text"
                      readOnly
                      value=""
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600 outline-none"
                    />
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    4H Temp
                    <input
                      readOnly
                      value=""
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600 outline-none"
                    />
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    Initial
                    <div className="relative mt-1">
                      <UserRound className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                      <input
                        {...registerCooling('initial', { required: 'Initial is required', maxLength: 4 })}
                        readOnly
                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm uppercase text-slate-900 outline-none transition focus:border-slate-500"
                        placeholder="Select staff"
                      />
                    </div>
                  </label>
                </div>
              </motion.form>
            </>
          ) : activeNav === 'Reheat' ? (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-200/70 p-4 shadow-sm backdrop-blur-xl sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">Reheat Log Gallery</h2>
                  <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {reheatLogs.length} Today
                  </span>
                </div>

                {isLoading ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm">Loading logs…</div>
                ) : reheatLogs.length === 0 ? (
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

                      {reheatLogs.map((log, index) => (
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
                            <span className="truncate">{log.StartTime || '—'}</span>
                            <span className="truncate">{log.EndTime || '—'}</span>
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
                onSubmit={handleSubmitReheat(onSubmitReheat)}
                className="rounded-2xl border border-slate-200 bg-slate-200/70 p-4 shadow-sm backdrop-blur-xl sm:p-5"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <h2 className="mb-4 text-base font-semibold tracking-tight text-slate-900 sm:text-lg">Reheat Log Form</h2>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-xs font-medium text-slate-700">
                    Product
                    <select
                      {...registerReheat('product', {
                        required: 'Product is required',
                        validate: (value) => value.trim().length > 0 || 'Product is required',
                        onChange: () => clearReheatErrors('product'),
                      })}
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
                    {reheatErrors.product && <span className="mt-1 block text-[11px] text-red-300">{reheatErrors.product.message}</span>}
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    Date
                    <input
                      type="date"
                      {...registerReheat('date', { required: 'Date is required' })}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                    />
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    Start Time
                    <input
                      type="time"
                      {...registerReheat('startTime', { required: 'Start time is required' })}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                    />
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    End Time
                    <input
                      type="time"
                      {...registerReheat('endTime', { required: 'End time is required' })}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                    />
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    Temp
                    <div className="relative mt-1">
                      <Thermometer className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                      <input
                        {...registerReheat('temp', { required: 'Temperature is required' })}
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
                        {...registerReheat('initial', { required: 'Initial is required', maxLength: 4 })}
                        readOnly
                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm uppercase text-slate-900 outline-none transition focus:border-slate-500"
                        placeholder="Select staff"
                      />
                    </div>
                  </label>

                  <label className="text-xs font-medium text-slate-700 sm:col-span-2 lg:col-span-3">
                    Corrective Action
                    <textarea
                      {...registerReheat('correctiveAction')}
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                      placeholder="Action taken if temp is out of range"
                    />
                  </label>
                </div>
              </motion.form>
            </>
          ) : activeNav === 'Thawing' ? (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-200/70 p-4 shadow-sm backdrop-blur-xl sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">Thawing Log Gallery</h2>
                  <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {thawingLogs.length} Open
                  </span>
                </div>

                {isLoading ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm">Loading logs…</div>
                ) : thawingLogs.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm">No open thawing items</div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="grid gap-1">
                      <div className={`${thawingGalleryColumnsClass} px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600`}>
                        <span>Product</span>
                        <span>Date</span>
                        <span>Start Time</span>
                        <span>Start Temp</span>
                        <span>End Date</span>
                        <span>End Time</span>
                        <span>End Temp</span>
                        <span>Approved</span>
                        <span>Corrective Action</span>
                        <span className="pr-1">Complete</span>
                        <span className="pl-1">Save</span>
                      </div>

                      {thawingLogs.map((log, index) => {
                        const itemKey = log.ID ?? `${log.Title}-${index}`;
                        const rowId = log.ID;
                        const draft = typeof rowId === 'number'
                          ? (thawingRowDrafts[rowId] ?? {
                              endDate: log.EndDate ?? '',
                              endTime: log.EndTime ?? '',
                              endTemp: log.EndTemp ?? '',
                              approvedSafe: log.ApprovedSafe?.Value ?? 'No',
                              correctiveAction: log.Correctiveaction ?? '',
                              completed: log.Completed?.Value ?? 'No',
                            })
                          : {
                              endDate: log.EndDate ?? '',
                              endTime: log.EndTime ?? '',
                              endTemp: log.EndTemp ?? '',
                              approvedSafe: log.ApprovedSafe?.Value ?? 'No',
                              correctiveAction: log.Correctiveaction ?? '',
                              completed: log.Completed?.Value ?? 'No',
                            };
                        const rowSaving = typeof rowId === 'number' && savingRowId === rowId;

                        return (
                          <motion.article
                            key={itemKey}
                            variants={cardMotion}
                            initial="hidden"
                            animate="visible"
                            transition={{ duration: 0.35, delay: index * 0.06 }}
                            className="px-1 py-1"
                          >
                            <div className={`${thawingGalleryColumnsClass} text-xs text-slate-700`}>
                              <span className="truncate font-bold text-slate-900">{log.Title || 'Untitled'}</span>
                              <span className="truncate">{log.Date || '—'}</span>
                              <span className="truncate">{log.StartTime || '—'}</span>
                              <span className="truncate">{log.StartTemp ? `${log.StartTemp}°` : '—'}</span>

                              <input
                                type="date"
                                value={draft.endDate}
                                disabled={rowSaving}
                                onFocus={() => {
                                  if (typeof rowId === 'number' && !hasValue(draft.endDate)) {
                                    updateThawingRowDraft(rowId, 'endDate', toDateInputValue(new Date()));
                                  }
                                }}
                                onChange={(e) => {
                                  if (typeof rowId === 'number') {
                                    updateThawingRowDraft(rowId, 'endDate', e.target.value);
                                  }
                                }}
                                className="h-7 rounded-md border border-slate-300 bg-white px-1.5 text-xs text-slate-900 disabled:bg-slate-100 disabled:text-slate-600"
                              />

                              <input
                                type="text"
                                value={draft.endTime}
                                disabled={rowSaving}
                                onFocus={() => {
                                  if (typeof rowId === 'number' && !hasValue(draft.endTime)) {
                                    updateThawingRowDraft(rowId, 'endTime', getCurrentTimeAmPm());
                                  }
                                }}
                                onChange={(e) => {
                                  if (typeof rowId === 'number') {
                                    updateThawingRowDraft(rowId, 'endTime', e.target.value);
                                  }
                                }}
                                onBlur={(e) => {
                                  if (typeof rowId === 'number') {
                                    updateThawingRowDraft(rowId, 'endTime', normalizeTimeAmPm(e.target.value));
                                  }
                                }}
                                className="h-7 rounded-md border border-slate-300 bg-white px-1.5 text-xs text-slate-900 disabled:bg-slate-100 disabled:text-slate-600"
                                placeholder="h:mm AM/PM"
                              />

                              <input
                                value={draft.endTemp}
                                disabled={rowSaving}
                                onChange={(e) => {
                                  if (typeof rowId === 'number') {
                                    updateThawingRowDraft(rowId, 'endTemp', e.target.value.replace(/[^0-9.-]/g, ''));
                                  }
                                }}
                                className="h-7 rounded-md border border-slate-300 bg-white px-1.5 text-xs text-slate-900 disabled:bg-slate-100 disabled:text-slate-600"
                                placeholder="Temp"
                                inputMode="decimal"
                              />

                              <select
                                value={draft.approvedSafe}
                                disabled={rowSaving}
                                onChange={(e) => {
                                  if (typeof rowId === 'number') {
                                    updateThawingRowDraft(rowId, 'approvedSafe', e.target.value);
                                  }
                                }}
                                className="h-7 rounded-md border border-slate-300 bg-white px-1 text-xs text-slate-900 disabled:bg-slate-100"
                              >
                                <option value="No">No</option>
                                <option value="Yes">Yes</option>
                              </select>

                              <input
                                value={draft.correctiveAction}
                                disabled={rowSaving}
                                onChange={(e) => {
                                  if (typeof rowId === 'number') {
                                    updateThawingRowDraft(rowId, 'correctiveAction', e.target.value);
                                  }
                                }}
                                className="h-7 rounded-md border border-slate-300 bg-white px-1.5 text-xs text-slate-900 disabled:bg-slate-100 disabled:text-slate-600"
                                placeholder="Notes"
                              />

                              <select
                                value={draft.completed}
                                disabled={rowSaving}
                                onChange={(e) => {
                                  if (typeof rowId === 'number') {
                                    updateThawingRowDraft(rowId, 'completed', e.target.value);
                                  }
                                }}
                                className="h-7 rounded-md border border-slate-300 bg-white px-1 text-xs text-slate-900 disabled:bg-slate-100"
                              >
                                <option value="No">No</option>
                                <option value="Yes">Yes</option>
                              </select>

                              <button
                                type="button"
                                disabled={rowSaving || typeof rowId !== 'number'}
                                onClick={() => void saveThawingRow(log)}
                                title={rowSaving ? 'Saving...' : 'Save'}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-700 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-transparent disabled:text-slate-500"
                              >
                                {rowSaving ? (
                                  <Clock3 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Save className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </motion.article>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <motion.form
                onSubmit={handleSubmitThawing(onSubmitThawing)}
                className="rounded-2xl border border-slate-200 bg-slate-200/70 p-4 shadow-sm backdrop-blur-xl sm:p-5"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <h2 className="mb-4 text-base font-semibold tracking-tight text-slate-900 sm:text-lg">Thawing Log Form</h2>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-xs font-medium text-slate-700">
                    Product
                    <select
                      {...registerThawing('product', {
                        required: 'Product is required',
                        validate: (value) => value.trim().length > 0 || 'Product is required',
                        onChange: () => clearThawingErrors('product'),
                      })}
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
                    {thawingErrors.product && <span className="mt-1 block text-[11px] text-red-300">{thawingErrors.product.message}</span>}
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    Date
                    <input
                      type="date"
                      {...registerThawing('date', { required: 'Date is required' })}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                    />
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    Start Time
                    <input
                      type="text"
                      {...registerThawing('startTime', {
                        required: 'Start time is required',
                        setValueAs: (value) => normalizeTimeAmPm(value ?? ''),
                      })}
                      onFocus={(e) => {
                        if (!e.target.value.trim()) {
                          setThawingValue('startTime', getCurrentTimeAmPm(), { shouldDirty: true });
                        }
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                      placeholder="h:mm AM/PM"
                    />
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    Start Temp
                    <div className="relative mt-1">
                      <Thermometer className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                      <input
                        {...registerThawing('startTemp', { required: 'Start temp is required' })}
                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                        placeholder="-2"
                        inputMode="decimal"
                      />
                    </div>
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    End Date
                    <input
                      type="date"
                      readOnly
                      value=""
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500 outline-none"
                    />
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    End Time
                    <input
                      type="text"
                      readOnly
                      value=""
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500 outline-none"
                    />
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    End Temp
                    <input
                      readOnly
                      value=""
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500 outline-none"
                    />
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    Approved Safe
                    <input
                      readOnly
                      value="No"
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500 outline-none"
                    />
                  </label>

                  <label className="text-xs font-medium text-slate-700">
                    Initial
                    <div className="relative mt-1">
                      <UserRound className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                      <input
                        {...registerThawing('initial', { required: 'Initial is required', maxLength: 4 })}
                        readOnly
                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm uppercase text-slate-900 outline-none transition focus:border-slate-500"
                        placeholder="Select staff"
                      />
                    </div>
                  </label>
                </div>
              </motion.form>
            </>
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
                        <span className="truncate">{log.StartTime || '—'}</span>
                        <span className="truncate">{log.EndTime || '—'}</span>
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
                  {...register('product', {
                    required: 'Product is required',
                    validate: (value) => value.trim().length > 0 || 'Product is required',
                    onChange: () => clearErrors('product'),
                  })}
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
          <span className="text-xs font-medium text-slate-700">
            {activeNav === 'Cooling'
              ? 'Cooling summary ready for COOLING LOGS submission.'
              : activeNav === 'Reheat'
              ? 'Reheat summary ready for REHEAT LOGS submission.'
              : activeNav === 'Thawing'
              ? 'Thawing summary ready for THAWING LOGS submission.'
              : 'Cooking summary ready for COOK LOGS submission.'}
          </span>
          <motion.button
            type="button"
            onClick={
              activeNav === 'Cooling'
                ? handleSubmitCooling(onSubmitCooling)
                : activeNav === 'Reheat'
                ? handleSubmitReheat(onSubmitReheat)
                : activeNav === 'Thawing'
                ? handleSubmitThawing(onSubmitThawing)
                : handleSubmit(onSubmit)
            }
            whileTap={{ scale: 0.95 }}
            disabled={
              activeNav === 'Cooling' ? isCoolingSubmitting
              : activeNav === 'Reheat' ? isReheatSubmitting
              : activeNav === 'Thawing' ? isThawingSubmitting
              : isSubmitting
            }
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-700 px-5 text-sm font-semibold leading-none text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {activeNav === 'Cooling'
              ? (isCoolingSubmitting ? 'Submitting...' : 'Submit')
              : activeNav === 'Reheat'
              ? (isReheatSubmitting ? 'Submitting...' : 'Submit')
              : activeNav === 'Thawing'
              ? (isThawingSubmitting ? 'Submitting...' : 'Submit')
              : (isSubmitting ? 'Submitting...' : 'Submit')}
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
