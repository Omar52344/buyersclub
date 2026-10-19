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
  MAIL_FROM: z.string().default('BuyersClub <no-reply@buyersclub.local>'),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  UPLOAD_DIR: z.string().default('.uploads'),
  DEFAULT_TIMEZONE: z.string().default('America/Bogota'),
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
