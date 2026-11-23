export interface AdminAuthStatus {
  configured: boolean;
  managedByEnv: boolean;
  authorized: boolean;
}

export interface AdminSessionPayload {
  token: string;
  expiresAt: string;
}

export class AdminAuthError extends Error {
  public status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AdminAuthError';
    this.status = status;
  }
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchAdminAuthStatus(token?: string | null): Promise<AdminAuthStatus> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch('/api/admin/status', { headers });
  if (!res.ok) {
    const msg = await readErrorMessage(res, 'Unable to check admin security status.');
    throw new AdminAuthError(msg, res.status);
  }
  return (await res.json()) as AdminAuthStatus;
}

export async function setupInitialAdminCode(accessCode: string): Promise<AdminSessionPayload> {
  const res = await fetch('/api/admin/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessCode }),
  });
  if (!res.ok) {
    const msg = await readErrorMessage(res, 'Failed to configure Admin Access Code.');
    throw new AdminAuthError(msg, res.status);
  }
  return (await res.json()) as AdminSessionPayload;
}

export async function verifyAdminAccessCode(accessCode: string): Promise<AdminSessionPayload> {
  const res = await fetch('/api/admin/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessCode }),
  });
  if (!res.ok) {
    const msg = await readErrorMessage(res, 'Access denied. Invalid Admin Access Code.');
    throw new AdminAuthError(msg, res.status);
  }
  return (await res.json()) as AdminSessionPayload;
}

export async function changeAdminCode(
  token: string,
  currentCode: string,
  newCode: string
): Promise<AdminSessionPayload> {
  const res = await fetch('/api/admin/change-code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentCode, newCode }),
  });
  if (!res.ok) {
    const msg = await readErrorMessage(res, 'Failed to update Admin Access Code.');
    throw new AdminAuthError(msg, res.status);
  }
  return (await res.json()) as AdminSessionPayload;
}

export async function lockAdminSessionOnServer(token: string | null): Promise<void> {
  if (!token) return;
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // non-fatal network failure while clearing memory token
  }
}
