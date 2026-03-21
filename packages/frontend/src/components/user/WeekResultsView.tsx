import { Box } from '@mui/material';
import WeekResultsGameRow, { type WeekResultRow } from './WeekResultsGameRow';

interface WeekResultsViewProps {
  resultRows: WeekResultRow[];
}

export default function WeekResultsView({ resultRows }: WeekResultsViewProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {resultRows.map(row => (
        <WeekResultsGameRow key={row.gameId} row={row} />
      ))}
    </Box>
  );
}
