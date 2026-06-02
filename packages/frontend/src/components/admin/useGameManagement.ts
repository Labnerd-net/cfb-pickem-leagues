import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';
import type { WeekIdentifier } from '@shared/types/cfb-pickem-api';
import {
  type AdminDbGameDataWire,
  addGamesToWeek,
  getGamesForWeek,
} from '../../apis/adminRequests';

export interface ImportFeedback {
  severity: 'success' | 'error';
  message: string;
}

interface UseGameManagementReturn {
  games: AdminDbGameDataWire[];
  gameLoading: boolean;
  importing: boolean;
  setImporting: Dispatch<SetStateAction<boolean>>;
  importFeedback: ImportFeedback | null;
  setImportFeedback: Dispatch<SetStateAction<ImportFeedback | null>>;
  errorMessage: string | null;
  loadGames: () => Promise<void>;
  handleImportGames: () => Promise<void>;
  handleGameCorrected: (updated: AdminDbGameDataWire) => void;
  clearMessages: () => void;
}

export function useGameManagement(
  selectedYear: number,
  selectedWeek: number,
): UseGameManagementReturn {
  const [games, setGames] = useState<AdminDbGameDataWire[]>([]);
  const [gameLoading, setGameLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<ImportFeedback | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadGames = useCallback(async () => {
    setGameLoading(true);
    setGames([]);
    try {
      const weekData: WeekIdentifier = { year: selectedYear, week: selectedWeek };
      const result = await getGamesForWeek(weekData);
      if (result.success && result.data) {
        setGames(result.data);
      } else {
        setErrorMessage(result.error ?? 'Failed to load games');
      }
    } catch {
      setErrorMessage('An unexpected error occurred while loading games');
    } finally {
      setGameLoading(false);
    }
  }, [selectedYear, selectedWeek]);

  useEffect(() => {
    setErrorMessage(null);
    setImportFeedback(null);
    loadGames();
  }, [loadGames]);

  async function handleImportGames() {
    setImporting(true);
    setImportFeedback(null);
    try {
      const result = await addGamesToWeek({ year: selectedYear, week: selectedWeek });
      if (result.success) {
        const gamesResult = await getGamesForWeek({ year: selectedYear, week: selectedWeek });
        if (gamesResult.success && gamesResult.data) {
          setGames(gamesResult.data);
        }
        setImportFeedback({
          severity: 'success',
          message: result.data?.status ?? 'Games imported',
        });
      } else {
        setImportFeedback({
          severity: 'error',
          message: result.error ?? 'Failed to import games',
        });
      }
    } catch {
      setImportFeedback({ severity: 'error', message: 'An unexpected error occurred' });
    } finally {
      setImporting(false);
    }
  }

  function handleGameCorrected(updated: AdminDbGameDataWire) {
    setGames(prev => prev.map(g => (g.gameId === updated.gameId ? updated : g)));
  }

  function clearMessages() {
    setErrorMessage(null);
  }

  return {
    games,
    gameLoading,
    importing,
    setImporting,
    importFeedback,
    setImportFeedback,
    errorMessage,
    loadGames,
    handleImportGames,
    handleGameCorrected,
    clearMessages,
  };
}
