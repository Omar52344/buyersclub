import { z } from 'zod';
import { CURRENCIES } from './currency';

export const currencySchema = z.enum(CURRENCIES);

export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Usa formato E.164, por ejemplo +573001234567');

export const signupSchema = z.object({
  email: z.string().email(),
  phone: phoneSchema,
  fullName: z.string().min(2).max(120).optional(),
  role: z.enum(['buyer', 'vendor']).default('buyer'),
});

export const otpRequestSchema = z.object({
  channel: z.enum(['email', 'sms']),
  destination: z.string().min(3),
  purpose: z.enum(['signup', 'login', 'verify_email', 'verify_phone', 'reset']),
});

export const otpVerifySchema = z.object({
  destination: z.string().min(3),
  code: z.string().regex(/^\d{6}$/, 'El código tiene 6 dígitos'),
});

export const signupVerifyEmailSchema = z.object({
  signupId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, 'El código tiene 6 dígitos'),
});

export const signupVerifyPhoneSchema = signupVerifyEmailSchema;

export const loginStartSchema = z.object({
  identifier: z.string().min(5).max(120),
});

export const loginVerifySchema = z.object({
  identifier: z.string().min(5).max(120),
  code: z.string().regex(/^\d{6}$/, 'El código tiene 6 dígitos'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20),
});

export const deviceTokenSchema = z.object({
  expoPushToken: z.string().min(10),
  platform: z.enum(['ios', 'android']),
});

export const businessCreateSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  categoryId: z.string().uuid().optional(),
  currency: currencySchema.default('COP'),
});

export const branchCreateSchema = z.object({
  name: z.string().min(2).max(80),
  addressLine: z.string().min(5).max(200),
  city: z.string().min(2).max(80),
  region: z.string().max(80).optional(),
  country: z.string().length(2).default('CO'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  phone: z.string().max(30).optional(),
  timezone: z.string().default('America/Bogota'),
});

export const productCreateSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  categoryId: z.string().uuid().optional(),
  basePriceCents: z.number().int().nonnegative(),
  imageFileId: z.string().uuid().optional(),
  shareWithAllBranches: z.boolean().default(true),
  branchIds: z.array(z.string().uuid()).optional(),
});

export const orderItemSchema = z.object({
  productId: z.string().uuid(),
  qty: z.number().int().positive().max(99),
  notes: z.string().max(200).optional(),
});

export const orderCreateSchema = z.object({
  branchId: z.string().uuid(),
  fulfillment: z.enum(['delivery', 'pickup']),
  paymentMethod: z.enum(['cash', 'transfer', 'card_terminal', 'other']),
  items: z.array(orderItemSchema).min(1).max(50),
  addressId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
  clientTotalCents: z.number().int().nonnegative().optional(),
});

export const paymentEvidenceSchema = z.object({
  fileId: z.string().uuid(),
  note: z.string().max(200).optional(),
});

export type CurrencyCode = z.infer<typeof currencySchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
export type SignupVerifyEmailInput = z.infer<typeof signupVerifyEmailSchema>;
export type SignupVerifyPhoneInput = z.infer<typeof signupVerifyPhoneSchema>;
export type LoginStartInput = z.infer<typeof loginStartSchema>;
export type LoginVerifyInput = z.infer<typeof loginVerifySchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type DeviceTokenInput = z.infer<typeof deviceTokenSchema>;
export type BusinessCreateInput = z.infer<typeof businessCreateSchema>;
export type BranchCreateInput = z.infer<typeof branchCreateSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type PaymentEvidenceInput = z.infer<typeof paymentEvidenceSchema>;
