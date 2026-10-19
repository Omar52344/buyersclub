import { z } from 'zod';
import { CURRENCIES } from './currency';

export const currencySchema = z.enum(CURRENCIES);

export const phoneSchema = z
  .string()
  .regex(
    /^\+[1-9]\d{9,14}$/,
    'Usa formato E.164 con al menos 10 dígitos, por ejemplo +573001234567',
  );

export const mobilePhoneSchema = z
  .string()
  .refine(
    (value) => {
      const digits = value.replace(/\D/g, '').length;
      return digits >= 10 && digits <= 15;
    },
    'El celular debe tener al menos 10 dígitos',
  );

export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña es demasiado larga')
  .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra')
  .regex(/\d/, 'La contraseña debe incluir al menos un número');

export const signupSchema = z.object({
  email: z.string().email(),
  phone: phoneSchema,
  password: passwordSchema,
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

export const loginPasswordSchema = z.object({
  identifier: z.string().min(5).max(120),
  password: z.string().min(1).max(72),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const passwordResetSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, 'El código tiene 6 dígitos'),
  password: passwordSchema,
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

export const profileUpdateSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
});

export const businessCreateSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  categoryId: z.string().uuid().optional(),
  currency: currencySchema.default('COP'),
});

export const businessUpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional(),
  categoryId: z.string().uuid().optional(),
  currency: currencySchema.optional(),
});

export const branchCreateSchema = z
  .object({
    name: z.string().min(2).max(80),
    addressLine: z.string().min(5).max(200),
    city: z.string().min(2).max(80),
    region: z.string().max(80).optional(),
    country: z.string().length(2).default('CO'),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    phone: z.string().max(30).optional(),
    timezone: z.string().default('America/Bogota'),
    pickupEnabled: z.boolean().default(true),
    deliveryEnabled: z.boolean().default(true),
    deliveryFeeCents: z.number().int().nonnegative().default(0),
    minOrderCents: z.number().int().nonnegative().default(0),
    prepTimeMinutes: z.number().int().min(0).max(240).default(20),
    deliveryEtaMinutes: z.number().int().min(0).max(240).default(20),
  })
  .refine((value) => (value.lat === undefined) === (value.lng === undefined), {
    message: 'lat y lng deben enviarse juntos',
    path: ['lat'],
  });

export const branchUpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  addressLine: z.string().min(5).max(200).optional(),
  city: z.string().min(2).max(80).optional(),
  region: z.string().max(80).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  phone: z.string().max(30).optional(),
  timezone: z.string().optional(),
  pickupEnabled: z.boolean().optional(),
  deliveryEnabled: z.boolean().optional(),
  deliveryFeeCents: z.number().int().nonnegative().optional(),
  minOrderCents: z.number().int().nonnegative().optional(),
  prepTimeMinutes: z.number().int().min(0).max(240).optional(),
  deliveryEtaMinutes: z.number().int().min(0).max(240).optional(),
  status: z.enum(['active', 'paused', 'closed']).optional(),
});

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const branchHoursUpdateSchema = z.object({
  ranges: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        opensAt: z.string().regex(timePattern, 'Usa HH:MM'),
        closesAt: z.string().regex(timePattern, 'Usa HH:MM'),
      }),
    )
    .max(21),
  exceptions: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa YYYY-MM-DD'),
        isClosed: z.boolean().default(true),
        opensAt: z.string().regex(timePattern).optional(),
        closesAt: z.string().regex(timePattern).optional(),
        note: z.string().max(120).optional(),
      }),
    )
    .max(50)
    .default([]),
});

export const branchOpenSchema = z.object({
  manualOpen: z.boolean(),
});

export const productCreateSchema = z
  .object({
    businessId: z.string().uuid(),
    name: z.string().min(2).max(120),
    description: z.string().max(1000).optional(),
    categoryId: z.string().uuid().optional(),
    basePriceCents: z.number().int().nonnegative(),
    imageFileId: z.string().uuid().optional(),
    shareWithAllBranches: z.boolean().default(false),
    branchIds: z.array(z.string().uuid()).min(1).optional(),
  })
  .refine(
    (input) =>
      input.shareWithAllBranches || (input.branchIds?.length ?? 0) > 0,
    {
      message: 'Selecciona al menos una sucursal para el producto.',
      path: ['branchIds'],
    },
  );

export const productUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(1000).optional(),
  categoryId: z.string().uuid().optional(),
  basePriceCents: z.number().int().nonnegative().optional(),
  imageFileId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  shareWithAllBranches: z.boolean().optional(),
});

export const productBranchesUpdateSchema = z.object({
  branches: z.array(
    z.object({
      branchId: z.string().uuid(),
      priceCents: z.number().int().nonnegative().nullable().optional(),
      stock: z.number().int().nonnegative().nullable().optional(),
      isAvailable: z.boolean().default(true),
    }),
  ),
});

export const branchProductsBulkSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1).max(200),
  isAvailable: z.boolean(),
});

export const orderItemSchema = z.object({
  productId: z.string().uuid(),
  qty: z.number().int().positive().max(99),
  notes: z.string().max(200).optional(),
});

export const deliveryAddressSchema = z.object({
  line1: z.string().min(5).max(200),
  line2: z.string().max(120).optional(),
  city: z.string().min(2).max(80),
  recipientName: z.string().min(2).max(120).optional(),
  phone: z.string().max(30).optional(),
  notes: z.string().max(200).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const orderCreateSchema = z
  .object({
    branchId: z.string().uuid(),
    fulfillment: z.enum(['delivery', 'pickup']),
    paymentMethod: z.enum(['cash', 'transfer', 'card_terminal', 'other']),
    items: z.array(orderItemSchema).min(1).max(50),
    addressId: z.string().uuid().optional(),
    deliveryAddress: deliveryAddressSchema.optional(),
    notes: z.string().max(500).optional(),
    clientTotalCents: z.number().int().nonnegative().optional(),
  })
  .refine(
    (value) =>
      value.fulfillment !== 'delivery' || Boolean(value.deliveryAddress || value.addressId),
    {
      message: 'La entrega a domicilio requiere una dirección',
      path: ['deliveryAddress'],
    },
  );

export const guestOrderCreateSchema = z
  .object({
    name: z.string().min(2).max(80),
    phone: mobilePhoneSchema,
    fulfillment: z.enum(['delivery', 'pickup']).default('pickup'),
    paymentMethod: z.enum(['cash', 'card_terminal']).default('cash'),
    items: z.array(orderItemSchema).min(1).max(50),
    deliveryAddress: deliveryAddressSchema.optional(),
    notes: z.string().max(300).optional(),
  })
  .refine(
    (value) => value.fulfillment !== 'delivery' || Boolean(value.deliveryAddress),
    {
      message: 'La entrega a domicilio requiere una dirección',
      path: ['deliveryAddress'],
    },
  );

export const orderStatusUpdateSchema = z.object({
  status: z.enum([
    'accepted',
    'preparing',
    'ready',
    'out_for_delivery',
    'completed',
    'rejected',
  ]),
  note: z.string().max(200).optional(),
});

export const orderCancelSchema = z.object({
  reason: z.string().min(3).max(200),
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
export type LoginPasswordInput = z.infer<typeof loginPasswordSchema>;
export type LoginVerifyInput = z.infer<typeof loginVerifySchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type DeviceTokenInput = z.infer<typeof deviceTokenSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type BusinessCreateInput = z.infer<typeof businessCreateSchema>;
export type BusinessUpdateInput = z.infer<typeof businessUpdateSchema>;
export type BranchCreateInput = z.infer<typeof branchCreateSchema>;
export type BranchUpdateInput = z.infer<typeof branchUpdateSchema>;
export type BranchHoursUpdateInput = z.infer<typeof branchHoursUpdateSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductBranchesUpdateInput = z.infer<typeof productBranchesUpdateSchema>;
export type BranchProductsBulkInput = z.infer<typeof branchProductsBulkSchema>;
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type GuestOrderCreateInput = z.infer<typeof guestOrderCreateSchema>;
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;
export type OrderCancelInput = z.infer<typeof orderCancelSchema>;
export type DeliveryAddressInput = z.infer<typeof deliveryAddressSchema>;
export type PaymentEvidenceInput = z.infer<typeof paymentEvidenceSchema>;
