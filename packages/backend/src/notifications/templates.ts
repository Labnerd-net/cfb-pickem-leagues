import type { LeaderboardEntry } from '@shared/types/cfb-pickem-api.js';

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

export function gamesReadyTemplate({ year, weekNumber }: { year: number; weekNumber: number }): EmailTemplate {
  const subject = `CFB Pick'em — Week ${weekNumber} games are ready!`;
  const textBody = `Games for Week ${weekNumber} of the ${year} season are ready. Log in and make your picks before kickoff!`;
  const htmlBody = `
    <h2>Week ${weekNumber} Games Are Ready</h2>
    <p>Games for Week ${weekNumber} of the ${year} CFB season have been posted.</p>
    <p>Log in and make your picks before the first kickoff!</p>
  `.trim();

  return { subject, htmlBody, textBody };
}

export function picksReminderTemplate({
  year,
  weekNumber,
  leagueName,
  firstKickoffTime,
}: {
  year: number;
  weekNumber: number;
  leagueName: string;
  firstKickoffTime: Date;
}): EmailTemplate {
  const kickoffStr = firstKickoffTime.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  const subject = `[${leagueName}] Picks reminder — Week ${weekNumber} locks in 1 hour`;
  const textBody = `The first game of Week ${weekNumber} (${year}) in ${leagueName} kicks off at ${kickoffStr}. You have about 1 hour left to make your picks!`;
  const htmlBody = `
    <h2>Picks Deadline Reminder — ${escapeHtml(leagueName)}</h2>
    <p>The first game of Week ${weekNumber} of the ${year} season kicks off at <strong>${kickoffStr}</strong>.</p>
    <p>You have about 1 hour left — log in and lock in your picks!</p>
  `.trim();

  return { subject, htmlBody, textBody };
}

export function picksReminder24hTemplate({
  year,
  weekNumber,
  leagueName,
  firstKickoffTime,
}: {
  year: number;
  weekNumber: number;
  leagueName: string;
  firstKickoffTime: Date;
}): EmailTemplate {
  const kickoffStr = firstKickoffTime.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  const subject = `[${leagueName}] Picks reminder — Week ${weekNumber} locks in 24 hours`;
  const textBody = `The first game of Week ${weekNumber} (${year}) in ${leagueName} kicks off at ${kickoffStr}. You have about 24 hours left to make your picks!`;
  const htmlBody = `
    <h2>Picks Deadline Reminder — ${escapeHtml(leagueName)}</h2>
    <p>The first game of Week ${weekNumber} of the ${year} season kicks off at <strong>${kickoffStr}</strong>.</p>
    <p>You have about 24 hours — log in and lock in your picks!</p>
  `.trim();

  return { subject, htmlBody, textBody };
}

export function rankingsUpdatedTemplate({
  year,
  weekNumber,
  leagueName,
  leaderboard,
}: {
  year: number;
  weekNumber: number;
  leagueName: string;
  leaderboard: LeaderboardEntry[];
}): EmailTemplate {
  const subject = `[${leagueName}] Week ${weekNumber} results are in`;

  const leaderboardTextLines = leaderboard.map((e, i) => {
    const pct = e.percentage !== null ? ` (${Math.round(e.percentage * 100)}%)` : '';
    return `${i + 1}. ${e.displayName}: ${e.correct}/${e.total}${pct}`;
  });
  const textBody = [
    `All games for Week ${weekNumber} of the ${year} season in ${leagueName} are complete.`,
    '',
    'Standings:',
    ...leaderboardTextLines,
  ].join('\n');

  const leaderboardRows = leaderboard
    .map((e, i) => {
      const pct = e.percentage !== null ? Math.round(e.percentage * 100) + '%' : '—';
      return `<tr><td>${i + 1}</td><td>${escapeHtml(e.displayName)}</td><td>${e.correct}/${e.total}</td><td>${pct}</td></tr>`;
    })
    .join('');

  const htmlBody = `
    <h2>Week ${weekNumber} Results Are In — ${escapeHtml(leagueName)}</h2>
    <p>All games for Week ${weekNumber} of the ${year} CFB season in <strong>${escapeHtml(leagueName)}</strong> are now complete.</p>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
      <thead><tr><th>#</th><th>Name</th><th>Correct/Finished</th><th>%</th></tr></thead>
      <tbody>${leaderboardRows}</tbody>
    </table>
  `.trim();

  return { subject, htmlBody, textBody };
}
