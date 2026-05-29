import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';
import type { WeekIdentifier } from '@shared/types/cfb-pickem-api';
import {
  type AdminDbGameDataWire,
  addGamesToWeek,
  getGamesForWeek,
  setPickedGames,
} from '../../apis/adminRequests';

export interface ImportFeedback {
  severity: 'success' | 'error';
  message: string;
}

interface UseGameManagementReturn {
  games: AdminDbGameDataWire[];
  selectedGameIds: number[];
  gameLoading: boolean;
  importing: boolean;
  setImporting: Dispatch<SetStateAction<boolean>>;
  importFeedback: ImportFeedback | null;
  setImportFeedback: Dispatch<SetStateAction<ImportFeedback | null>>;
  errorMessage: string | null;
  successMessage: string | null;
  loadGames: () => Promise<void>;
  handleSavePickedGames: () => Promise<void>;
  handleImportGames: () => Promise<void>;
  handleGameSelection: (gameId: number, selected: boolean) => void;
  handleSelectAll: () => void;
  handleDeselectAll: () => void;
  handleGameCorrected: (updated: AdminDbGameDataWire) => void;
  clearMessages: () => void;
}

export function useGameManagement(
  selectedYear: number,
  selectedWeek: number,
): UseGameManagementReturn {
  const [games, setGames] = useState<AdminDbGameDataWire[]>([]);
  const [selectedGameIds, setSelectedGameIds] = useState<number[]>([]);
  const [gameLoading, setGameLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<ImportFeedback | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadGames = useCallback(async () => {
    setGameLoading(true);
    setGames([]);
    setSelectedGameIds([]);

    try {
      const weekData: WeekIdentifier = { year: selectedYear, week: selectedWeek };
      const result = await getGamesForWeek(weekData);
      if (result.success && result.data) {
        setGames(result.data);
        const pickedGameIds = result.data.filter(game => game.inLeague).map(game => game.gameId);
        setSelectedGameIds(pickedGameIds);
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
    setSuccessMessage(null);
    setImportFeedback(null);
    loadGames();
  }, [loadGames]);

  async function handleSavePickedGames() {
    if (selectedGameIds.length === 0) {
      setErrorMessage('Please select at least one game');
      return;
    }

    setGameLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const pickedData = { year: selectedYear, week: selectedWeek, games: selectedGameIds };
      const result = await setPickedGames(pickedData);
      if (result.success) {
        setSuccessMessage(`${selectedGameIds.length} games marked as available for picks`);
        await loadGames();
      } else {
        setErrorMessage(result.error ?? 'Failed to save picked games');
      }
    } catch {
      setErrorMessage('An unexpected error occurred while saving picked games');
    } finally {
      setGameLoading(false);
    }
  }

  async function handleImportGames() {
    setImporting(true);
    setImportFeedback(null);
    try {
      const result = await addGamesToWeek({ year: selectedYear, week: selectedWeek });
      if (result.success) {
        const gamesResult = await getGamesForWeek({ year: selectedYear, week: selectedWeek });
        if (gamesResult.success && gamesResult.data) {
          setGames(gamesResult.data);
          const pickedIds = gamesResult.data.filter(g => g.inLeague).map(g => g.gameId);
          setSelectedGameIds(pickedIds);
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

  function handleGameSelection(gameId: number, selected: boolean) {
    setSelectedGameIds(prev => (selected ? [...prev, gameId] : prev.filter(id => id !== gameId)));
  }

  function handleSelectAll() {
    setSelectedGameIds(games.map(game => game.gameId));
  }

  function handleDeselectAll() {
    setSelectedGameIds([]);
  }

  function handleGameCorrected(updated: AdminDbGameDataWire) {
    setGames(prev => prev.map(g => (g.gameId === updated.gameId ? updated : g)));
  }

  function clearMessages() {
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  return {
    games,
    selectedGameIds,
    gameLoading,
    importing,
    setImporting,
    importFeedback,
    setImportFeedback,
    errorMessage,
    successMessage,
    loadGames,
    handleSavePickedGames,
    handleImportGames,
    handleGameSelection,
    handleSelectAll,
    handleDeselectAll,
    handleGameCorrected,
    clearMessages,
  };
}
