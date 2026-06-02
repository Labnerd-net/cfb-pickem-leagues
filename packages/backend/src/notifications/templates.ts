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

function htmlWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:6px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#1565C0;padding:20px 32px;">
            <span style="color:#fff;font-size:20px;font-weight:bold;">CFB Pick'em</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;color:#222;font-size:15px;line-height:1.6;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #eee;color:#888;font-size:12px;">
            CFB Pick'em &mdash; You're receiving this because you have notifications enabled.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

export function verificationEmailTemplate({ verifyUrl }: { verifyUrl: string }): EmailTemplate {
  const subject = `CFB Pick'em — Verify your email address`;
  const textBody = `Welcome to CFB Pick'em! Verify your email address by visiting: ${verifyUrl}`;
  const htmlBody = htmlWrapper(`
    <h2 style="margin-top:0;">Verify Your Email Address</h2>
    <p>Welcome to CFB Pick'em! Click the button below to verify your email address and activate your account.</p>
    <p style="margin:28px 0;">
      <a href="${verifyUrl}" style="background:#1565C0;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:bold;display:inline-block;">Verify Email</a>
    </p>
    <p style="color:#666;font-size:13px;">Or copy this link into your browser:<br>${escapeHtml(verifyUrl)}</p>
  `);
  return { subject, htmlBody, textBody };
}

export function gamesReadyTemplate({ year, weekNumber, leagueName }: { year: number; weekNumber: number; leagueName: string }): EmailTemplate {
  const subject = `[${leagueName}] CFB Pick'em — Week ${weekNumber} games are ready!`;
  const textBody = `Games for Week ${weekNumber} of the ${year} season are ready in ${leagueName}. Log in and make your picks before kickoff!`;
  const htmlBody = htmlWrapper(`
    <h2 style="margin-top:0;">Week ${weekNumber} Games Are Ready</h2>
    <p>Games for Week ${weekNumber} of the ${year} CFB season have been posted in <strong>${escapeHtml(leagueName)}</strong>.</p>
    <p>Log in and make your picks before the first kickoff!</p>
  `);
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
  const subject = `[${leagueName}] CFB Pick'em — Week ${weekNumber} locks in 1 hour`;
  const textBody = `The first game of Week ${weekNumber} (${year}) in ${leagueName} kicks off at ${kickoffStr}. You have about 1 hour left to make your picks!`;
  const htmlBody = htmlWrapper(`
    <h2 style="margin-top:0;">Picks Deadline Reminder &mdash; ${escapeHtml(leagueName)}</h2>
    <p>The first game of Week ${weekNumber} of the ${year} season kicks off at <strong>${kickoffStr}</strong>.</p>
    <p>You have about 1 hour left &mdash; log in and lock in your picks!</p>
  `);
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
  const subject = `[${leagueName}] CFB Pick'em — Week ${weekNumber} locks in 24 hours`;
  const textBody = `The first game of Week ${weekNumber} (${year}) in ${leagueName} kicks off at ${kickoffStr}. You have about 24 hours left to make your picks!`;
  const htmlBody = htmlWrapper(`
    <h2 style="margin-top:0;">Picks Deadline Reminder &mdash; ${escapeHtml(leagueName)}</h2>
    <p>The first game of Week ${weekNumber} of the ${year} season kicks off at <strong>${kickoffStr}</strong>.</p>
    <p>You have about 24 hours &mdash; log in and lock in your picks!</p>
  `);
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
  const subject = `[${leagueName}] CFB Pick'em — Week ${weekNumber} results are in`;

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
      return `<tr><td style="padding:6px 12px;">${i + 1}</td><td style="padding:6px 12px;">${escapeHtml(e.displayName)}</td><td style="padding:6px 12px;">${e.correct}/${e.total}</td><td style="padding:6px 12px;">${pct}</td></tr>`;
    })
    .join('');

  const htmlBody = htmlWrapper(`
    <h2 style="margin-top:0;">Week ${weekNumber} Results Are In &mdash; ${escapeHtml(leagueName)}</h2>
    <p>All games for Week ${weekNumber} of the ${year} CFB season in <strong>${escapeHtml(leagueName)}</strong> are now complete.</p>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;width:100%;">
      <thead>
        <tr style="background:#f0f0f0;">
          <th style="padding:8px 12px;text-align:left;">#</th>
          <th style="padding:8px 12px;text-align:left;">Name</th>
          <th style="padding:8px 12px;text-align:left;">Correct</th>
          <th style="padding:8px 12px;text-align:left;">%</th>
        </tr>
      </thead>
      <tbody>${leaderboardRows}</tbody>
    </table>
  `);

  return { subject, htmlBody, textBody };
}
