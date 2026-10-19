import { ApiError, bearer, fetchApi } from './api';
import { clearSession, loadSession, saveSession } from './token-store';

export interface PublicUser {
  id: string;
  email: string;
  phone: string;
  fullName: string | null;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  phoneVerificationMethod: string | null;
  roles: string[];
  onboarding: { buyerComplete: boolean; vendorComplete: boolean };
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export interface SignupStartResponse {
  signupId: string;
  next: 'verify_email' | 'verify_phone';
  email: string;
  phone?: string;
  devCode?: string;
}

export interface VerifyEmailResponse {
  next: 'verify_phone';
  phone: string;
  devCode?: string;
}

export interface LoginStartResponse {
  next: 'verify';
  email: string;
  devCode?: string;
}

export async function startSignup(input: {
  email: string;
  phone: string;
  password: string;
  fullName?: string;
  role: 'buyer' | 'vendor';
}): Promise<SignupStartResponse> {
  return fetchApi<SignupStartResponse>('/v1/auth/signup/start', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function verifySignupEmail(
  signupId: string,
  code: string,
): Promise<VerifyEmailResponse> {
  return fetchApi<VerifyEmailResponse>('/v1/auth/signup/verify-email', {
    method: 'POST',
    body: JSON.stringify({ signupId, code }),
  });
}

export async function verifySignupPhone(signupId: string, code: string): Promise<Session> {
  const session = await fetchApi<Session>('/v1/auth/signup/verify-phone', {
    method: 'POST',
    body: JSON.stringify({ signupId, code }),
  });
  await saveSession({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  });
  return session;
}

export async function loginWithPassword(identifier: string, password: string): Promise<Session> {
  const session = await fetchApi<Session>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
  await saveSession({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  });
  return session;
}

export async function startLoginOtp(identifier: string): Promise<LoginStartResponse> {
  return fetchApi<LoginStartResponse>('/v1/auth/login/otp', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });
}

export async function verifyLoginOtp(identifier: string, code: string): Promise<Session> {
  const session = await fetchApi<Session>('/v1/auth/login/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ identifier, code }),
  });
  await saveSession({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  });
  return session;
}

export async function requestPasswordReset(
  email: string,
): Promise<{ sent: boolean; devCode?: string }> {
  return fetchApi('/v1/auth/password/reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(
  email: string,
  code: string,
  password: string,
): Promise<{ ok: boolean }> {
  return fetchApi('/v1/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ email, code, password }),
  });
}

export async function resendOtp(input: {
  channel: 'email' | 'sms';
  destination: string;
  purpose: 'login' | 'verify_email' | 'verify_phone';
}): Promise<{ sent: boolean; devCode?: string }> {
  return fetchApi('/v1/auth/otp/resend', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function loadCurrentUser(): Promise<PublicUser> {
  const stored = await loadSession();
  if (!stored) {
    throw new ApiError(401, 'NO_SESSION', 'No hay una sesión activa.');
  }

  try {
    const response = await fetchApi<{ user: PublicUser }>('/v1/me', {
      headers: bearer(stored.accessToken),
    });
    return response.user;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    const refreshed = await fetchApi<Session>('/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: stored.refreshToken }),
    });
    await saveSession({
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
    });
    return refreshed.user;
  }
}

export async function signOut(): Promise<void> {
  const stored = await loadSession();
  if (stored) {
    try {
      await fetchApi('/v1/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
      });
    } catch {
      // Aunque falle la API, cerramos la sesión local.
    }
  }
  await clearSession();
}
