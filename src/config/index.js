/**
 * Application Configuration
 * Centralized configuration management with environment validation
 */
import 'dotenv/config';

const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Server
  port: parseInt(process.env.PORT, 10) || 5000,

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 1433,
    name: process.env.DB_NAME || 'clinic_management',
    username: process.env.DB_TRUSTED_CONNECTION === 'true' ? undefined : (process.env.DB_USER || 'sa'),
    password: process.env.DB_TRUSTED_CONNECTION === 'true' ? undefined : (process.env.DB_PASSWORD || ''),
    dialect: 'mssql',
    dialectOptions: {
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === 'true',
        enableArithAbort: true,
        // Support Multiple Active Result Sets (MARS)
        multipleActiveResultSets: process.env.DB_MARS === 'true' || false,
        // Support named instance via instanceName (optional)
        instanceName: process.env.DB_INSTANCE || undefined,
      },
      // Windows Authentication (Trusted Connection)
      authentication: process.env.DB_TRUSTED_CONNECTION === 'true' ? {
        type: 'ntlm',
        options: {
          domain: process.env.DB_DOMAIN || '',
          userName: process.env.DB_NTLM_USER || '',
          password: process.env.DB_NTLM_PASSWORD || '',
        },
      } : undefined,
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-default-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // Bcrypt
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },

  // Pagination defaults
  pagination: {
    defaultPage: 1,
    defaultLimit: 10,
    // Increased maxLimit to allow larger fetch requests (e.g., limit=1000)
    maxLimit: 1000,
  },

  // AI Medical Chatbot
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    summary: {
      rateLimit: {
        perPatient: parseInt(process.env.AI_SUMMARY_RATE_LIMIT_PER_PATIENT, 10) || 10,
        global: parseInt(process.env.AI_SUMMARY_RATE_LIMIT_GLOBAL, 10) || 30,
      },
      timeout: parseInt(process.env.AI_SUMMARY_TIMEOUT_MS, 10) || 30000,
      cacheTTL: parseInt(process.env.AI_SUMMARY_CACHE_TTL_MS, 10) || 3600000,
    },
  },
};

// Validate required configuration
const requiredEnvVars = ['JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(
  (envVar) => !process.env[envVar] && config.isProduction
);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}`
  );
}

// Validate AI configuration
if (!process.env.GEMINI_API_KEY) {
  console.warn(
    'Warning: GEMINI_API_KEY is not set. AI Medical Chatbot and AI Medical Summary features will not be available.'
  );
}

export default config;
