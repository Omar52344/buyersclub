import { and, desc, eq, gt, gte, isNull, or, sql } from 'drizzle-orm';
import type {
  LoginPasswordInput,
  LoginStartInput,
  LoginVerifyInput,
  OtpRequestInput,
  PasswordResetInput,
  PasswordResetRequestInput,
  SignupInput,
  SignupVerifyEmailInput,
  SignupVerifyPhoneInput,
} from '@buyersclub/core';
import { db } from '../../db/index';
import { businesses, refreshTokens, userRoles, users, verifications } from '../../db/schema';
import { AppError } from '../../errors';
import { config } from '../../config';
import { signAccessToken } from '../../lib/tokens';
import { sendOtpEmail } from '../../lib/mailer';
import { hashPassword, verifyPassword } from '../../lib/password';
import {
  generateOtpCode,
  generateRefreshToken,
  hashOtp,
  hashToken,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS,
  OTP_TTL_MINUTES,
  OTP_WINDOW_MINUTES,
  verifyOtp,
} from '../../lib/otp';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
  platform?: string;
}

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

export interface SessionPayload {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: PublicUser;
}

type UserRow = typeof users.$inferSelect;
type VerificationPurpose = 'signup' | 'login' | 'verify_email' | 'verify_phone' | 'reset';

const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const normalizePhone = (value: string): string => value.replace(/[^\d+]/g, '');

function exposedCode(code: string): string | undefined {
  return config.EXPOSE_DEV_CODES && config.NODE_ENV !== 'production' ? code : undefined;
}

async function assertOtpQuota(destination: string, purpose: VerificationPurpose): Promise<void> {
  const since = new Date(Date.now() - OTP_WINDOW_MINUTES * 60_000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(verifications)
    .where(
      and(
        eq(verifications.destination, destination),
        eq(verifications.purpose, purpose),
        gte(verifications.createdAt, since),
      ),
    );

  if ((row?.count ?? 0) >= OTP_MAX_SENDS) {
    throw new AppError(
      'OTP_TOO_MANY_REQUESTS',
      'Enviamos demasiados códigos. Espera 15 minutos.',
      429,
    );
  }
}

interface IssueOtpInput {
  userId?: string;
  channel: 'email' | 'sms';
  destination: string;
  purpose: VerificationPurpose;
  meta?: RequestMeta;
}

async function issueOtp(input: IssueOtpInput): Promise<{ code: string; expiresAt: Date }> {
  await assertOtpQuota(input.destination, input.purpose);

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await db.insert(verifications).values({
    userId: input.userId ?? null,
    channel: input.channel,
    destination: input.destination,
    purpose: input.purpose,
    codeHash: hashOtp(code),
    expiresAt,
    ip: input.meta?.ip ?? null,
    userAgent: input.meta?.userAgent ?? null,
  });

  if (input.channel === 'email') {
    try {
      await sendOtpEmail(input.destination, code, input.purpose);
    } catch (error) {
      console.error('[mailer] No se pudo enviar el OTP', error);
      if (config.NODE_ENV === 'production') {
        throw new AppError(
          'EMAIL_SEND_FAILED',
          'No pudimos enviar el correo. Intenta de nuevo.',
          502,
        );
      }
    }
  } else if (config.NODE_ENV !== 'production') {
    // En fase 1 no hay proveedor SMS: el código se registra y se expone en dev.
    console.log(`[sms-dev] Código para ${input.destination}: ${code}`);
  }

  return { code, expiresAt };
}

async function consumeOtp(
  destination: string,
  purpose: VerificationPurpose,
  code: string,
): Promise<void> {
  const [record] = await db
    .select()
    .from(verifications)
    .where(
      and(
        eq(verifications.destination, destination),
        eq(verifications.purpose, purpose),
        isNull(verifications.consumedAt),
      ),
    )
    .orderBy(desc(verifications.createdAt))
    .limit(1);

  if (!record) {
    throw new AppError('OTP_INVALID', 'El código no es válido o ya fue usado.', 400);
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    throw new AppError('OTP_EXPIRED', 'El código expiró. Solicita uno nuevo.', 400);
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError(
      'OTP_TOO_MANY_ATTEMPTS',
      'Demasiados intentos. Solicita un código nuevo.',
      429,
    );
  }
  if (!verifyOtp(code, record.codeHash)) {
    await db
      .update(verifications)
      .set({ attempts: record.attempts + 1 })
      .where(eq(verifications.id, record.id));
    throw new AppError('OTP_INVALID', 'Código incorrecto.', 400);
  }

  await db
    .update(verifications)
    .set({ consumedAt: new Date() })
    .where(eq(verifications.id, record.id));
}

async function findByIdentifier(identifier: string): Promise<UserRow | undefined> {
  const value = identifier.trim();
  const where = value.includes('@')
    ? eq(users.email, normalizeEmail(value))
    : eq(users.phone, normalizePhone(value));

  const [user] = await db.select().from(users).where(where).limit(1);
  return user;
}

export async function findActiveUserById(userId: string): Promise<UserRow> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.status !== 'active') {
    throw new AppError('UNAUTHORIZED', 'Sesión no válida.', 401);
  }
  return user;
}

export async function toPublicUser(user: UserRow): Promise<PublicUser> {
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, user.id));
  const roles = rows.map((row) => row.role);

  let vendorComplete = false;
  if (roles.includes('vendor_owner')) {
    const [business] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.ownerUserId, user.id))
      .limit(1);
    vendorComplete = Boolean(business);
  }

  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    fullName: user.fullName,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
    phoneVerificationMethod: user.phoneVerificationMethod,
    roles,
    onboarding: { buyerComplete: Boolean(user.emailVerifiedAt), vendorComplete },
  };
}

export async function getPublicUserById(userId: string): Promise<PublicUser> {
  return toPublicUser(await findActiveUserById(userId));
}

export async function issueSession(
  user: UserRow,
  meta: RequestMeta = {},
): Promise<SessionPayload> {
  const accessToken = await signAccessToken(user.id);
  const refreshToken = generateRefreshToken();

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    deviceName: meta.userAgent ?? null,
    platform: meta.platform ?? null,
    expiresAt: new Date(Date.now() + config.REFRESH_TOKEN_DAYS * 86_400_000),
  });

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: 15 * 60,
    user: await toPublicUser(user),
  };
}

export async function startSignup(input: SignupInput, meta: RequestMeta = {}) {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);

  const [existing] = await db
    .select({
      id: users.id,
      email: users.email,
      phone: users.phone,
      status: users.status,
      emailVerifiedAt: users.emailVerifiedAt,
      phoneVerifiedAt: users.phoneVerifiedAt,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(or(eq(users.email, email), eq(users.phone, phone)))
    .limit(1);

  if (existing) {
    // Registro a medias: retomamos donde iba en lugar de bloquear con "ya existe".
    if (
      existing.status === 'pending' &&
      existing.email === email &&
      existing.phone === phone &&
      verifyPassword(input.password, existing.passwordHash)
    ) {
      if (!existing.emailVerifiedAt) {
        const { code } = await issueOtp({
          userId: existing.id,
          channel: 'email',
          destination: email,
          purpose: 'verify_email',
          meta,
        });
        return {
          signupId: existing.id,
          next: 'verify_email' as const,
          email,
          devCode: exposedCode(code),
        };
      }
      if (!existing.phoneVerifiedAt) {
        const { code } = await issueOtp({
          userId: existing.id,
          channel: 'sms',
          destination: phone,
          purpose: 'verify_phone',
          meta,
        });
        return {
          signupId: existing.id,
          next: 'verify_phone' as const,
          email,
          phone,
          devCode: exposedCode(code),
        };
      }
    }

    if (existing.email === email) {
      throw new AppError(
        'EMAIL_TAKEN',
        'Ese correo ya está registrado. Inicia sesión.',
        409,
      );
    }
    throw new AppError('PHONE_TAKEN', 'Ese celular ya está registrado.', 409);
  }

  const [user] = await db
    .insert(users)
    .values({
      email,
      phone,
      fullName: input.fullName?.trim() || null,
      passwordHash: hashPassword(input.password),
      status: 'pending',
    })
    .returning();

  if (!user) {
    throw new AppError('USER_CREATE_FAILED', 'No pudimos crear la cuenta.', 500);
  }

  const roles: { userId: string; role: 'buyer' | 'vendor_owner' }[] = [
    { userId: user.id, role: 'buyer' },
  ];
  if (input.role === 'vendor') {
    roles.push({ userId: user.id, role: 'vendor_owner' });
  }
  await db.insert(userRoles).values(roles);

  const { code } = await issueOtp({
    userId: user.id,
    channel: 'email',
    destination: email,
    purpose: 'verify_email',
    meta,
  });

  return {
    signupId: user.id,
    next: 'verify_email' as const,
    email,
    devCode: exposedCode(code),
  };
}

export async function verifySignupEmail(
  input: SignupVerifyEmailInput,
  meta: RequestMeta = {},
) {
  const [user] = await db.select().from(users).where(eq(users.id, input.signupId)).limit(1);
  if (!user) {
    throw new AppError('SIGNUP_NOT_FOUND', 'No encontramos ese registro.', 404);
  }
  if (user.emailVerifiedAt) {
    throw new AppError('EMAIL_ALREADY_VERIFIED', 'El correo ya está verificado.', 409);
  }

  await consumeOtp(user.email, 'verify_email', input.code);
  await db
    .update(users)
    .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  const { code } = await issueOtp({
    userId: user.id,
    channel: 'sms',
    destination: user.phone,
    purpose: 'verify_phone',
    meta,
  });

  return {
    next: 'verify_phone' as const,
    phone: user.phone,
    devCode: exposedCode(code),
  };
}

export async function verifySignupPhone(
  input: SignupVerifyPhoneInput,
  meta: RequestMeta = {},
): Promise<SessionPayload> {
  const [user] = await db.select().from(users).where(eq(users.id, input.signupId)).limit(1);
  if (!user) {
    throw new AppError('SIGNUP_NOT_FOUND', 'No encontramos ese registro.', 404);
  }
  if (!user.emailVerifiedAt) {
    throw new AppError('EMAIL_NOT_VERIFIED', 'Primero verifica tu correo.', 400);
  }
  if (user.phoneVerifiedAt) {
    throw new AppError('PHONE_ALREADY_VERIFIED', 'El celular ya está verificado.', 409);
  }

  await consumeOtp(user.phone, 'verify_phone', input.code);

  const [updated] = await db
    .update(users)
    .set({
      phoneVerifiedAt: new Date(),
      phoneVerificationMethod: 'otp_dev',
      status: 'active',
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning();

  if (!updated) {
    throw new AppError('USER_UPDATE_FAILED', 'No pudimos activar la cuenta.', 500);
  }

  return issueSession(updated, meta);
}

export async function startLoginOtp(input: LoginStartInput, meta: RequestMeta = {}) {
  const user = await findByIdentifier(input.identifier);
  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'No encontramos una cuenta con esos datos.', 404);
  }
  if (user.status === 'blocked') {
    throw new AppError('ACCOUNT_BLOCKED', 'La cuenta está bloqueada.', 403);
  }
  if (user.status === 'pending') {
    throw new AppError(
      'ACCOUNT_PENDING',
      'Termina de verificar tu celular para poder entrar.',
      403,
    );
  }
  if (!user.emailVerifiedAt) {
    throw new AppError('EMAIL_NOT_VERIFIED', 'Debes verificar tu correo para entrar.', 403);
  }

  const { code } = await issueOtp({
    userId: user.id,
    channel: 'email',
    destination: user.email,
    purpose: 'login',
    meta,
  });

  return { next: 'verify' as const, email: user.email, devCode: exposedCode(code) };
}

export async function verifyLoginOtp(
  input: LoginVerifyInput,
  meta: RequestMeta = {},
): Promise<SessionPayload> {
  const user = await findByIdentifier(input.identifier);
  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'No encontramos una cuenta con esos datos.', 404);
  }
  if (user.status === 'blocked') {
    throw new AppError('ACCOUNT_BLOCKED', 'La cuenta está bloqueada.', 403);
  }
  if (user.status === 'pending') {
    throw new AppError(
      'ACCOUNT_PENDING',
      'Termina de verificar tu celular para poder entrar.',
      403,
    );
  }

  await consumeOtp(user.email, 'login', input.code);
  return issueSession(user, meta);
}

export async function loginWithPassword(
  input: LoginPasswordInput,
  meta: RequestMeta = {},
): Promise<SessionPayload> {
  const user = await findByIdentifier(input.identifier);
  if (!user) {
    throw new AppError('INVALID_CREDENTIALS', 'Correo/celular o contraseña incorrectos.', 401);
  }
  if (user.status === 'blocked') {
    throw new AppError('ACCOUNT_BLOCKED', 'La cuenta está bloqueada.', 403);
  }
  if (user.status === 'pending') {
    throw new AppError(
      'ACCOUNT_PENDING',
      'Termina de verificar tu celular para poder entrar.',
      403,
    );
  }
  if (!user.passwordHash) {
    throw new AppError(
      'PASSWORD_NOT_SET',
      'Esta cuenta no tiene contraseña. Entra con un código.',
      409,
    );
  }
  if (!verifyPassword(input.password, user.passwordHash)) {
    throw new AppError('INVALID_CREDENTIALS', 'Correo/celular o contraseña incorrectos.', 401);
  }

  return issueSession(user, meta);
}

export async function requestPasswordReset(
  input: PasswordResetRequestInput,
  meta: RequestMeta = {},
) {
  const email = normalizeEmail(input.email);
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  // Respuesta genérica: no revelamos si el correo existe.
  if (!user) {
    return { sent: true };
  }

  const { code } = await issueOtp({
    userId: user.id,
    channel: 'email',
    destination: email,
    purpose: 'reset',
    meta,
  });

  return { sent: true, devCode: exposedCode(code) };
}

export async function resetPassword(input: PasswordResetInput, meta: RequestMeta = {}) {
  const email = normalizeEmail(input.email);
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    throw new AppError('INVALID_CODE', 'El código no es válido o expiró.', 400);
  }

  await consumeOtp(user.email, 'reset', input.code);

  await db
    .update(users)
    .set({ passwordHash: hashPassword(input.password), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  // Cerramos todas las sesiones activas por seguridad.
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, user.id), isNull(refreshTokens.revokedAt)));

  return { ok: true };
}

export async function resendOtp(input: OtpRequestInput, meta: RequestMeta = {}) {
  const destination =
    input.channel === 'email' ? normalizeEmail(input.destination) : normalizePhone(input.destination);
  const where =
    input.channel === 'email' ? eq(users.email, destination) : eq(users.phone, destination);

  const [user] = await db.select().from(users).where(where).limit(1);
  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'No encontramos una cuenta con esos datos.', 404);
  }
  if (input.purpose === 'verify_phone' && !user.emailVerifiedAt) {
    throw new AppError('EMAIL_NOT_VERIFIED', 'Primero verifica tu correo.', 400);
  }

  const { code } = await issueOtp({
    userId: user.id,
    channel: input.channel,
    destination,
    purpose: input.purpose,
    meta,
  });

  return { sent: true, devCode: exposedCode(code) };
}

export async function refreshSession(
  token: string,
  meta: RequestMeta = {},
): Promise<SessionPayload> {
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, hashToken(token)),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) {
    throw new AppError('INVALID_REFRESH_TOKEN', 'Tu sesión expiró. Inicia sesión de nuevo.', 401);
  }

  const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  if (!user || user.status === 'blocked') {
    throw new AppError('ACCOUNT_UNAVAILABLE', 'La cuenta no está disponible.', 401);
  }

  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date(), lastUsedAt: new Date() })
    .where(eq(refreshTokens.id, row.id));

  return issueSession(user, meta);
}

export async function logout(token: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.tokenHash, hashToken(token)));
}
