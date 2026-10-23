import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z
    .string()
    .default('postgres://postgres:postgres@localhost:5432/buyersclub'),
  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  JWT_SECRET: z.string().min(16).default('dev-only-secret-change-me-please-32'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  SMTP_URL: z.string().default('smtp://localhost:1025'),
  MAIL_FROM: z.string().default('ClubSellBuy <no-reply@clubsellbuy.local>'),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  UPLOAD_DIR: z.string().default('.uploads'),
  DEFAULT_TIMEZONE: z.string().default('America/Bogota'),
  PUBLIC_APP_URL: z.string().default('http://localhost:8081'),
  EXPO_PUSH_URL: z.string().default('https://exp.host/--/api/v2/push/send'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  EXPOSE_DEV_CODES: z
    .string()
    .default('true')
    .transform((value) => value.toLowerCase() !== 'false'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variables de entorno inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

if (config.NODE_ENV === 'production') {
  if (config.JWT_SECRET === 'dev-only-secret-change-me-please-32') {
    console.error('JWT_SECRET inseguro en producción. Configura uno propio.');
    process.exit(1);
  }
  if (config.CORS_ORIGIN === '*') {
    console.warn('[config] CORS abierto en producción; restringe CORS_ORIGIN.');
  }
  if (/localhost|127\.0\.0\.1/.test(config.PUBLIC_APP_URL)) {
    console.warn(
      '[config] PUBLIC_APP_URL apunta a localhost; configura el dominio público para los QR.',
    );
  }
}
