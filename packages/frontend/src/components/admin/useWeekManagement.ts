import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import type { AdminWeekData } from '@shared/types/cfb-pickem-api.js';
import {
  addWeeksToYear,
  getWeeksForYear as getWeeksForYearAsSiteAdmin,
  deleteYear as deleteYearApi,
} from '../../apis/adminRequests';
import { getWeeksForYear as getWeeksForYearAsMember } from '../../apis/userRequests';
import { getCurrentSeason } from '../../utils/weekCalculation';

const NO_WEEKS_MESSAGE = 'No weeks available for this year';

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
  weeks: AdminWeekData[];
  weeksChecked: boolean;
  weekLoading: boolean;
  weekError: string | null;
  importWeeks: (callbacks: ImportWeeksCallbacks) => Promise<void>;
  deleteYear: (callbacks: ImportWeeksCallbacks) => Promise<void>;
}

/**
 * `access: 'siteAdmin'` (default) reads/writes weeks via the site-admin-only
 * `/admin/weeks` endpoints (season import/reset). `access: 'member'` is for
 * consumers like LeagueAdminSection where the viewer is only a league admin,
 * not a site admin — it reads weeks via `/user/weeks`, which any authenticated
 * user can call, and has no import/delete capability.
 */
export function useWeekManagement(
  initialYear?: number,
  access: 'siteAdmin' | 'member' = 'siteAdmin'
): UseWeekManagementReturn {
  const [selectedYear, setSelectedYear] = useState(() => initialYear ?? getCurrentSeason());
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [weeks, setWeeks] = useState<AdminWeekData[]>([]);
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
        if (access === 'member') {
          const result = await getWeeksForYearAsMember(selectedYear);
          if (cancelled) return;
          if (result.success && result.data) {
            setWeeks(result.data.weeks);
            setSelectedWeek(1);
          } else if (result.error === NO_WEEKS_MESSAGE) {
            // No weeks loaded for this year yet — not an error, just an empty list.
          } else {
            setWeekError(result.error ?? 'Failed to load weeks');
          }
        } else {
          const result = await getWeeksForYearAsSiteAdmin(selectedYear);
          if (cancelled) return;
          if (result.success && result.data) {
            setWeeks(result.data);
            setSelectedWeek(1);
          } else {
            setWeekError(result.error ?? 'Failed to load weeks');
          }
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
  }, [selectedYear, access]);

  async function importWeeks({ setImporting, setImportFeedback }: ImportWeeksCallbacks) {
    setImporting(true);
    setImportFeedback(null);
    try {
      const result = await addWeeksToYear(selectedYear);
      if (result.success) {
        const weeksResult = await getWeeksForYearAsSiteAdmin(selectedYear);
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
