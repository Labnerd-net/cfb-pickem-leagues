import type { AdminWeekData } from '@shared/types/cfb-pickem-api';
import type { AdminGameWire } from '../../apis/userRequests';
import { isGameInResultsMode } from '../../utils/weekCalculation';
import type { WeekResultRow } from './WeekResultsGameRow';
import { useWeekNavigation } from './useWeekNavigation';
import { usePickSubmit, type SnackbarState } from './usePickSubmit';
import { useCountdownTick } from './useCountdownTick';

export type { SnackbarState };

interface UseWeekGamesReturn {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedWeek: number;
  setSelectedWeek: (week: number) => void;
  availableYears: number[];
  weeks: AdminWeekData[];
  games: AdminGameWire[];
  pickableGames: AdminGameWire[];
  now: Date;
  userPicks: Map<number, 'home_team' | 'away_team'>;
  savedPickIds: Set<number>;
  loading: boolean;
  submitting: boolean;
  initializing: boolean;
  error: string | null;
  snackbar: SnackbarState;
  finishedRows: WeekResultRow[];
  handlePickChange: (gameId: number, pick: 'home_team' | 'away_team') => void;
  handleSubmit: () => Promise<void>;
  handleSnackbarClose: () => void;
}

export function useWeekGames(): UseWeekGamesReturn {
  const nav = useWeekNavigation();
  const now = useCountdownTick(nav.games);
  const picks = usePickSubmit({
    selectedYear: nav.selectedYear,
    selectedWeek: nav.selectedWeek,
    games: nav.games,
  });

  const finishedGames = nav.games.filter(isGameInResultsMode);
  const pickableGames = nav.games.filter(game => !isGameInResultsMode(game));

  const finishedRows: WeekResultRow[] = finishedGames.map(game => ({
    gameId: game.gameId,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    homePoints: game.homePoints,
    awayPoints: game.awayPoints,
    winningTeam: game.winningTeam,
    completed: game.completed,
    teamChosen: picks.userPicks.get(game.gameId) ?? null,
  }));

  return {
    selectedYear: nav.selectedYear,
    setSelectedYear: nav.setSelectedYear,
    selectedWeek: nav.selectedWeek,
    setSelectedWeek: nav.setSelectedWeek,
    availableYears: nav.availableYears,
    weeks: nav.weeks,
    games: nav.games,
    pickableGames,
    now,
    loading: nav.loading,
    initializing: nav.initializing,
    error: nav.error,
    userPicks: picks.userPicks,
    savedPickIds: picks.savedPickIds,
    submitting: picks.submitting,
    snackbar: picks.snackbar,
    finishedRows,
    handlePickChange: picks.handlePickChange,
    handleSubmit: picks.handleSubmit,
    handleSnackbarClose: picks.handleSnackbarClose,
  };
}
