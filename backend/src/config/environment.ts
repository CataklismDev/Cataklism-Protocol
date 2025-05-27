import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),

  // Database
  MONGODB_URI: Joi.string().default('mongodb://localhost:27017/cataklism'),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),

  // Blockchain
  ETHEREUM_RPC_URL: Joi.string().required(),
  POLYGON_RPC_URL: Joi.string().required(),
  BSC_RPC_URL: Joi.string().required(),
  ARBITRUM_RPC_URL: Joi.string().required(),
  PRIVATE_KEY: Joi.string().required(),

  // Contract Addresses
  CATAKLISM_TOKEN_ADDRESS: Joi.string().required(),
  CATAKLISM_CORE_ADDRESS: Joi.string().required(),
  CATAKLISM_VAULT_ADDRESS: Joi.string().required(),

  // Authentication
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  REFRESH_TOKEN_SECRET: Joi.string().min(32).required(),
  REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('30d'),

  // External APIs
  ETHERSCAN_API_KEY: Joi.string().required(),
  POLYGONSCAN_API_KEY: Joi.string().required(),
  BSCSCAN_API_KEY: Joi.string().required(),
  ARBISCAN_API_KEY: Joi.string().required(),
  COINGECKO_API_KEY: Joi.string(),
  DEFIPULSE_API_KEY: Joi.string(),

  // Email
  SMTP_HOST: Joi.string().default('smtp.gmail.com'),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().required(),
  SMTP_PASS: Joi.string().required(),

  // Security
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
  API_RATE_LIMIT: Joi.number().default(100),
  WEBHOOK_SECRET: Joi.string().required(),
  ENCRYPTION_KEY: Joi.string().min(32).required(),

  // Monitoring
  SENTRY_DSN: Joi.string(),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),

  // Features
  ENABLE_SWAGGER: Joi.boolean().default(true),
  ENABLE_RATE_LIMITING: Joi.boolean().default(true),
  ENABLE_ANALYTICS: Joi.boolean().default(true),
  ENABLE_NOTIFICATIONS: Joi.boolean().default(true),

}).unknown(true);

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  NODE_ENV: envVars.NODE_ENV,
  PORT: envVars.PORT,

  // Database
  MONGODB_URI: envVars.MONGODB_URI,
  REDIS_URL: envVars.REDIS_URL,

  // Blockchain Networks
  NETWORKS: {
    ethereum: {
      name: 'Ethereum',
      chainId: 1,
      rpcUrl: envVars.ETHEREUM_RPC_URL,
      explorer: 'https://etherscan.io',
      apiKey: envVars.ETHERSCAN_API_KEY,
    },
    polygon: {
      name: 'Polygon',
      chainId: 137,
      rpcUrl: envVars.POLYGON_RPC_URL,
      explorer: 'https://polygonscan.com',
      apiKey: envVars.POLYGONSCAN_API_KEY,
    },
    bsc: {
      name: 'BSC',
      chainId: 56,
      rpcUrl: envVars.BSC_RPC_URL,
      explorer: 'https://bscscan.com',
      apiKey: envVars.BSCSCAN_API_KEY,
    },
    arbitrum: {
      name: 'Arbitrum',
      chainId: 42161,
      rpcUrl: envVars.ARBITRUM_RPC_URL,
      explorer: 'https://arbiscan.io',
      apiKey: envVars.ARBISCAN_API_KEY,
    },
  },

  // Contracts
  CONTRACTS: {
    CATAKLISM_TOKEN: envVars.CATAKLISM_TOKEN_ADDRESS,
    CATAKLISM_CORE: envVars.CATAKLISM_CORE_ADDRESS,
    CATAKLISM_VAULT: envVars.CATAKLISM_VAULT_ADDRESS,
  },

  // Authentication
  JWT: {
    SECRET: envVars.JWT_SECRET,
    EXPIRES_IN: envVars.JWT_EXPIRES_IN,
    REFRESH_SECRET: envVars.REFRESH_TOKEN_SECRET,
    REFRESH_EXPIRES_IN: envVars.REFRESH_TOKEN_EXPIRES_IN,
  },

  // External APIs
  EXTERNAL_APIS: {
    COINGECKO: {
      BASE_URL: 'https://api.coingecko.com/api/v3',
      API_KEY: envVars.COINGECKO_API_KEY,
    },
    DEFIPULSE: {
      BASE_URL: 'https://data-api.defipulse.com/api/v1',
      API_KEY: envVars.DEFIPULSE_API_KEY,
    },
  },

  // Email
  EMAIL: {
    HOST: envVars.SMTP_HOST,
    PORT: envVars.SMTP_PORT,
    USER: envVars.SMTP_USER,
    PASS: envVars.SMTP_PASS,
  },

  // Security
  SECURITY: {
    PRIVATE_KEY: envVars.PRIVATE_KEY,
    CORS_ORIGIN: envVars.CORS_ORIGIN,
    API_RATE_LIMIT: envVars.API_RATE_LIMIT,
    WEBHOOK_SECRET: envVars.WEBHOOK_SECRET,
    ENCRYPTION_KEY: envVars.ENCRYPTION_KEY,
  },

  // Monitoring
  MONITORING: {
    SENTRY_DSN: envVars.SENTRY_DSN,
    LOG_LEVEL: envVars.LOG_LEVEL,
  },

  // Features
  FEATURES: {
    SWAGGER: envVars.ENABLE_SWAGGER,
    RATE_LIMITING: envVars.ENABLE_RATE_LIMITING,
    ANALYTICS: envVars.ENABLE_ANALYTICS,
    NOTIFICATIONS: envVars.ENABLE_NOTIFICATIONS,
  },

  // Cache TTL (in seconds)
  CACHE_TTL: {
    SHORT: 60, // 1 minute
    MEDIUM: 300, // 5 minutes
    LONG: 3600, // 1 hour
    VERY_LONG: 86400, // 24 hours
  },

  // Pagination
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },

  // Blockchain sync
  SYNC: {
    BLOCK_CONFIRMATIONS: 12,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 5000, // 5 seconds
    BATCH_SIZE: 1000,
  },

  // Fees and limits
  PROTOCOL: {
    MIN_STAKE_AMOUNT: '1000000000000000000', // 1 token
    MAX_STAKE_AMOUNT: '1000000000000000000000000', // 1M tokens
    WITHDRAWAL_DELAY: 7 * 24 * 60 * 60, // 7 days
    MAX_SLIPPAGE: 500, // 5%
  },
};
