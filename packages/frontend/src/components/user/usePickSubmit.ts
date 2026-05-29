import { useState, useEffect } from 'react';
import { getUserPicks, postUserPicks } from '../../apis/userRequests';
import { logger } from '../../utils/logger';

export interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
}

interface UsePickSubmitParams {
  selectedYear: number;
  selectedWeek: number;
}

export interface UsePickSubmitReturn {
  userPicks: Map<number, 'home_team' | 'away_team'>;
  savedPickIds: Set<number>;
  submitting: boolean;
  snackbar: SnackbarState;
  handlePickChange: (gameId: number, pick: 'home_team' | 'away_team') => void;
  handleSubmit: () => Promise<void>;
  handleSnackbarClose: () => void;
}

export function usePickSubmit({ selectedYear, selectedWeek }: UsePickSubmitParams): UsePickSubmitReturn {
  const [userPicks, setUserPicks] = useState<Map<number, 'home_team' | 'away_team'>>(new Map());
  const [savedPickIds, setSavedPickIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Load picks when week changes
  useEffect(() => {
    if (selectedYear === 0 || selectedWeek === 0) return;

    let cancelled = false;

    async function loadPicks() {
      try {
        const picksResult = await getUserPicks({ year: selectedYear, week: selectedWeek });

        if (cancelled) return;

        if (picksResult.success && picksResult.data) {
          const picksMap = new Map<number, 'home_team' | 'away_team'>();
          const savedIds = new Set<number>();

          picksResult.data.forEach(pick => {
            if (pick.teamChosen === 'home_team' || pick.teamChosen === 'away_team') {
              picksMap.set(pick.gameId, pick.teamChosen);
              savedIds.add(pick.gameId);
            }
          });

          setUserPicks(picksMap);
          setSavedPickIds(savedIds);
        } else {
          setUserPicks(new Map());
          setSavedPickIds(new Set());
        }
      } catch (err) {
        if (cancelled) return;
        logger.error('Error loading picks:', err);
      }
    }

    loadPicks();

    return () => {
      cancelled = true;
    };
  }, [selectedYear, selectedWeek]);

  function handlePickChange(gameId: number, pick: 'home_team' | 'away_team') {
    setUserPicks(prev => {
      const newPicks = new Map(prev);
      newPicks.set(gameId, pick);
      return newPicks;
    });
  }

  async function handleSubmit() {
    if (userPicks.size === 0) {
      setSnackbar({ open: true, message: 'Please make at least one pick before submitting', severity: 'error' });
      return;
    }

    try {
      setSubmitting(true);

      const picksArray = Array.from(userPicks.entries()).map(([gameId, pick]) => ({
        game: gameId,
        pick,
      }));

      const result = await postUserPicks({
        year: selectedYear,
        week: selectedWeek,
        leagueId: 1, // Phase 4: replace with active league from league switcher
        games: picksArray,
      });

      if (result.success) {
        setSavedPickIds(new Set(userPicks.keys()));
        setSnackbar({ open: true, message: 'Picks saved successfully!', severity: 'success' });
      } else {
        setSnackbar({ open: true, message: result.error ?? 'Failed to save picks', severity: 'error' });
      }
    } catch (err) {
      logger.error('Error submitting picks:', err);
      setSnackbar({ open: true, message: 'An error occurred while saving picks', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  function handleSnackbarClose() {
    setSnackbar(prev => ({ ...prev, open: false }));
  }

  return {
    userPicks,
    savedPickIds,
    submitting,
    snackbar,
    handlePickChange,
    handleSubmit,
    handleSnackbarClose,
  };
}
