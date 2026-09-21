import { createContext, useContext } from 'react';
import type { LeagueData } from '@shared/types/cfb-pickem-api.js';

export interface LeagueContextValue {
  leagues: LeagueData[];
  activeLeague: LeagueData | null;
  setActiveLeague: (league: LeagueData) => void;
  isLoading: boolean;
  refetchLeagues: () => Promise<void>;
}

export const LeagueContext = createContext<LeagueContextValue | undefined>(undefined);

export function useLeague(): LeagueContextValue {
  const ctx = useContext(LeagueContext);
  if (!ctx) throw new Error('useLeague must be used within LeagueProvider');
  return ctx;
}
