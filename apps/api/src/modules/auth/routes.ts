import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import {
  loginPasswordSchema,
  loginStartSchema,
  loginVerifySchema,
  otpRequestSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  refreshTokenSchema,
  signupSchema,
  signupVerifyEmailSchema,
  signupVerifyPhoneSchema,
} from '@buyersclub/core';
import { requireUserId } from '../../lib/auth-guard';
import {
  getPublicUserById,
  loginWithPassword,
  logout,
  refreshSession,
  requestPasswordReset,
  resendOtp,
  resetPassword,
  startLoginOtp,
  startSignup,
  verifyLoginOtp,
  verifySignupEmail,
  verifySignupPhone,
} from './service';

function meta(request: FastifyRequest) {
  const platform = request.headers['x-platform'];
  return {
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    platform: typeof platform === 'string' ? platform : undefined,
  };
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/auth/signup/start',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (request, reply) => {
    const body = signupSchema.parse(request.body);
    return reply.status(201).send(await startSignup(body, meta(request)));
  });

  app.post('/auth/signup/verify-email', async (request) => {
    const body = signupVerifyEmailSchema.parse(request.body);
    return verifySignupEmail(body, meta(request));
  });

  app.post('/auth/signup/verify-phone', async (request) => {
    const body = signupVerifyPhoneSchema.parse(request.body);
    return verifySignupPhone(body, meta(request));
  });

  app.post(
    '/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (request) => {
      const body = loginPasswordSchema.parse(request.body);
      return loginWithPassword(body, meta(request));
    },
  );

  app.post('/auth/login/otp', async (request) => {
    const body = loginStartSchema.parse(request.body);
    return startLoginOtp(body, meta(request));
  });

  app.post('/auth/login/otp/verify', async (request) => {
    const body = loginVerifySchema.parse(request.body);
    return verifyLoginOtp(body, meta(request));
  });

  app.post(
    '/auth/otp/resend',
    { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
    async (request) => {
    const body = otpRequestSchema.parse(request.body);
    return resendOtp(body, meta(request));
  });

  app.post(
    '/auth/password/reset/request',
    { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
    async (request) => {
    const body = passwordResetRequestSchema.parse(request.body);
    return requestPasswordReset(body, meta(request));
  });

  app.post('/auth/password/reset', async (request) => {
    const body = passwordResetSchema.parse(request.body);
    return resetPassword(body, meta(request));
  });

  app.post('/auth/refresh', async (request) => {
    const body = refreshTokenSchema.parse(request.body);
    return refreshSession(body.refreshToken, meta(request));
  });

  app.post('/auth/logout', async (request, reply) => {
    const body = refreshTokenSchema.parse(request.body);
    await logout(body.refreshToken);
    return reply.status(204).send();
  });

  app.get('/me', async (request) => {
    const userId = await requireUserId(request);
    return { user: await getPublicUserById(userId) };
  });
};
