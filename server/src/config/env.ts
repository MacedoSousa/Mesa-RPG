import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .string()
  .default('false')
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:5174'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  TEST_DATABASE_URL: z.string().optional(),
  DATABASE_SSL: bool,
  DATABASE_LOGGING: bool,
  JWT_SECRET: z.string().min(16, 'JWT_SECRET deve ter pelo menos 16 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET deve ter pelo menos 16 caracteres'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  MASTER_INVITE_CODE: z.string().optional(),
  AUTOSAVE_SECONDS: z.coerce.number().int().min(5).default(60),
  AUTOSAVE_KEEP: z.coerce.number().int().min(1).max(50).default(5),
  // Arte dos monstros com IA local (ComfyUI no PC do Mestre)
  COMFYUI_URL: z.string().url().default('http://127.0.0.1:8188'),
  COMFYUI_CHECKPOINT: z.string().optional(),
  COMFYUI_WORKFLOW: z.string().optional(),
  COMFYUI_TIMEOUT_SECONDS: z.coerce.number().int().min(10).default(300),
  ART_DIR: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas (veja server/.env.example):');
  for (const issue of parsed.error.issues) console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isTest = env.NODE_ENV === 'test';
export const corsOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
export const databaseUrl = isTest && env.TEST_DATABASE_URL ? env.TEST_DATABASE_URL : env.DATABASE_URL;
