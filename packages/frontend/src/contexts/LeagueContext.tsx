import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { LeagueData } from '@shared/types/cfb-pickem-api.js';
import { useAuth } from './auth/AuthContext';
import { getLeagues } from '../apis/leagueRequests';

const STORAGE_KEY = 'activeLeagueId';

interface LeagueContextValue {
  leagues: LeagueData[];
  activeLeague: LeagueData | null;
  setActiveLeague: (league: LeagueData) => void;
  isLoading: boolean;
  refetchLeagues: () => Promise<void>;
}

const LeagueContext = createContext<LeagueContextValue | undefined>(undefined);

export function useLeague(): LeagueContextValue {
  const ctx = useContext(LeagueContext);
  if (!ctx) throw new Error('useLeague must be used within LeagueProvider');
  return ctx;
}

function pickActiveLeague(leagues: LeagueData[]): LeagueData | null {
  if (leagues.length === 0) return null;
  const storedId = localStorage.getItem(STORAGE_KEY);
  if (storedId) {
    const found = leagues.find(l => l.leagueId === Number(storedId));
    if (found) return found;
  }
  return leagues[0];
}

export function LeagueProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [leagues, setLeagues] = useState<LeagueData[]>([]);
  const [activeLeague, setActiveLeagueState] = useState<LeagueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeagues = useCallback(async () => {
    setIsLoading(true);
    const result = await getLeagues();
    if (result.success && result.data) {
      setLeagues(result.data);
      setActiveLeagueState(prev => {
        // Keep existing selection if still valid; otherwise pick from storage/default
        if (prev && result.data!.some(l => l.leagueId === prev.leagueId)) return prev;
        return pickActiveLeague(result.data!);
      });
    } else {
      setLeagues([]);
      setActiveLeagueState(null);
    }
    setIsLoading(false);
  }, []);

  // Fetch leagues once auth resolves and user is logged in
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLeagues([]);
      setActiveLeagueState(null);
      localStorage.removeItem(STORAGE_KEY);
      setIsLoading(false);
      return;
    }
    fetchLeagues();
  }, [authLoading, user, fetchLeagues]);

  function setActiveLeague(league: LeagueData) {
    setActiveLeagueState(league);
    localStorage.setItem(STORAGE_KEY, String(league.leagueId));
  }

  return (
    <LeagueContext.Provider value={{ leagues, activeLeague, setActiveLeague, isLoading, refetchLeagues: fetchLeagues }}>
      {children}
    </LeagueContext.Provider>
  );
}
