export const ok = (data: unknown) => ({ ok: true, data });
export const err = (msg: string, code = 400) => ({ ok: false, error: msg, code });
