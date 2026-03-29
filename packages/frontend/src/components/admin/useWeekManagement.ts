import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import {
  type AdminDbWeekDataWire,
  addWeeksToYear,
  getWeeksForYear,
  deleteYear as deleteYearApi,
} from '../../apis/adminRequests';
import { getCurrentSeason } from '../../utils/weekCalculation';

interface ImportFeedback {
  severity: 'success' | 'error';
  message: string;
}

interface ImportWeeksCallbacks {
  setImporting: Dispatch<SetStateAction<boolean>>;
  setImportFeedback: Dispatch<SetStateAction<ImportFeedback | null>>;
}

interface UseWeekManagementReturn {
  selectedYear: number;
  setSelectedYear: Dispatch<SetStateAction<number>>;
  selectedWeek: number;
  setSelectedWeek: Dispatch<SetStateAction<number>>;
  weeks: AdminDbWeekDataWire[];
  weeksChecked: boolean;
  weekLoading: boolean;
  weekError: string | null;
  importWeeks: (callbacks: ImportWeeksCallbacks) => Promise<void>;
  deleteYear: (callbacks: ImportWeeksCallbacks) => Promise<void>;
}

export function useWeekManagement(initialYear?: number): UseWeekManagementReturn {
  const [selectedYear, setSelectedYear] = useState(() => initialYear ?? getCurrentSeason());
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [weeks, setWeeks] = useState<AdminDbWeekDataWire[]>([]);
  const [weeksChecked, setWeeksChecked] = useState(false);
  const [weekLoading, setWeekLoading] = useState(false);
  const [weekError, setWeekError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWeeks() {
      setWeekLoading(true);
      setWeeksChecked(false);
      setWeekError(null);
      setWeeks([]);

      try {
        const result = await getWeeksForYear(selectedYear);
        if (cancelled) return;
        if (result.success && result.data) {
          setWeeks(result.data);
          setSelectedWeek(1);
        } else {
          setWeekError(result.error ?? 'Failed to load weeks');
        }
      } catch {
        if (!cancelled) setWeekError('An unexpected error occurred while loading weeks');
      } finally {
        if (!cancelled) {
          setWeeksChecked(true);
          setWeekLoading(false);
        }
      }
    }

    loadWeeks();

    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  async function importWeeks({ setImporting, setImportFeedback }: ImportWeeksCallbacks) {
    setImporting(true);
    setImportFeedback(null);
    try {
      const result = await addWeeksToYear(selectedYear);
      if (result.success) {
        const weeksResult = await getWeeksForYear(selectedYear);
        if (weeksResult.success && weeksResult.data) {
          setWeeks(weeksResult.data);
          if (weeksResult.data.length > 0) setSelectedWeek(weeksResult.data[0].weekNumber);
        }
        setImportFeedback({ severity: 'success', message: `Weeks loaded for ${selectedYear}` });
      } else {
        setImportFeedback({
          severity: 'error',
          message: result.error ?? 'Failed to load weeks',
        });
      }
    } catch {
      setImportFeedback({ severity: 'error', message: 'An unexpected error occurred' });
    } finally {
      setImporting(false);
    }
  }

  async function deleteYear({ setImporting, setImportFeedback }: ImportWeeksCallbacks) {
    setImporting(true);
    setImportFeedback(null);
    try {
      const result = await deleteYearApi(selectedYear);
      if (result.success) {
        setWeeks([]);
        setSelectedWeek(1);
        setImportFeedback({ severity: 'success', message: `Season ${selectedYear} data deleted` });
      } else {
        setImportFeedback({
          severity: 'error',
          message: result.error ?? 'Failed to delete year data',
        });
      }
    } catch {
      setImportFeedback({ severity: 'error', message: 'An unexpected error occurred' });
    } finally {
      setImporting(false);
    }
  }

  return {
    selectedYear,
    setSelectedYear,
    selectedWeek,
    setSelectedWeek,
    weeks,
    weeksChecked,
    weekLoading,
    weekError,
    importWeeks,
    deleteYear,
  };
}
