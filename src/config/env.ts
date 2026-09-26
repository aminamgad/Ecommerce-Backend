import dotenv from 'dotenv';

dotenv.config();

export type NodeEnv = 'development' | 'production' | 'test';

/**
 * Names of variables that hold secrets. Values must never appear in logs or errors.
 * Messages may only mention the variable name.
 */
const SECRET_ENV_NAMES = new Set([
  'MONGODB_URI',
  'JWT_SECRET',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'PAYMOB_API_KEY',
]);

/** Placeholder / example values rejected in production. Compared case-insensitively. */
const PRODUCTION_SECRET_PLACEHOLDERS = [
  'change-me',
  'changeme',
  'replace-me',
  'your-secret',
  'your-api-key',
  'example',
  'password',
  'todo',
  'xxx',
  'dummy',
  'dev-access-secret',
  'change-me-to-a-long-random-access-secret',
];

export class EnvValidationError extends Error {
  public readonly details: string[];

  constructor(details: string[]) {
    super(`Invalid environment configuration:\n- ${details.join('\n- ')}`);
    this.name = 'EnvValidationError';
    this.details = details;
    Object.setPrototypeOf(this, EnvValidationError.prototype);
  }
}

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === '';
}

function looksLikePlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return PRODUCTION_SECRET_PLACEHOLDERS.some(
    (placeholder) =>
      normalized === placeholder ||
      normalized.includes(placeholder) ||
      normalized.startsWith('replace-me') ||
      normalized.startsWith('change-me')
  );
}

function parseNodeEnv(raw: string | undefined, errors: string[]): NodeEnv {
  if (isBlank(raw)) {
    return 'development';
  }

  const value = raw!.trim().toLowerCase();

  if (value === 'development' || value === 'production' || value === 'test') {
    return value;
  }

  errors.push('NODE_ENV must be one of: development, production, test');
  return 'development';
}

function readInteger(
  name: string,
  raw: string | undefined,
  fallback: number,
  errors: string[],
  options: { min?: number; max?: number } = {}
): number {
  const value = raw === undefined || raw.trim() === '' ? fallback : Number(raw);

  if (!Number.isInteger(value)) {
    errors.push(`${name} must be an integer`);
    return fallback;
  }

  if (options.min !== undefined && value < options.min) {
    errors.push(`${name} must be >= ${options.min}`);
    return fallback;
  }

  if (options.max !== undefined && value > options.max) {
    errors.push(`${name} must be <= ${options.max}`);
    return fallback;
  }

  return value;
}

function requireNonEmpty(name: string, errors: string[]): string | undefined {
  const value = process.env[name];
  if (isBlank(value)) {
    errors.push(`Missing required environment variable: ${name}`);
    return undefined;
  }
  return value!.trim();
}

function validateSecretStrength(
  name: string,
  value: string,
  nodeEnv: NodeEnv,
  errors: string[],
  options: { minLengthDev: number; minLengthProd: number }
): void {
  const minLength =
    nodeEnv === 'production' ? options.minLengthProd : options.minLengthDev;

  if (value.length < minLength) {
    errors.push(`${name} must be at least ${minLength} characters`);
  }

  if (nodeEnv === 'production' && looksLikePlaceholder(value)) {
    errors.push(
      `${name} appears to be a placeholder; set a real secret for production`
    );
  }
}

function validateMongodbUri(
  value: string,
  nodeEnv: NodeEnv,
  errors: string[]
): void {
  if (
    !value.startsWith('mongodb://') &&
    !value.startsWith('mongodb+srv://')
  ) {
    errors.push('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }

  if (nodeEnv === 'production' && looksLikePlaceholder(value)) {
    errors.push(
      'MONGODB_URI appears to be a placeholder; set a real connection string for production'
    );
  }
}

function loadEnv() {
  const errors: string[] = [];
  const nodeEnv = parseNodeEnv(process.env.NODE_ENV, errors);

  const mongodbUri = requireNonEmpty('MONGODB_URI', errors);
  const jwtSecret = requireNonEmpty('JWT_SECRET', errors);
  const cloudinaryCloudName = requireNonEmpty('CLOUDINARY_CLOUD_NAME', errors);
  const cloudinaryApiKey = requireNonEmpty('CLOUDINARY_API_KEY', errors);
  const cloudinaryApiSecret = requireNonEmpty('CLOUDINARY_API_SECRET', errors);
  const paymobApiKey = requireNonEmpty('PAYMOB_API_KEY', errors);

  if (mongodbUri) {
    validateMongodbUri(mongodbUri, nodeEnv, errors);
  }

  if (jwtSecret) {
    validateSecretStrength('JWT_SECRET', jwtSecret, nodeEnv, errors, {
      minLengthDev: 16,
      minLengthProd: 32,
    });
  }

  if (cloudinaryApiKey) {
    validateSecretStrength('CLOUDINARY_API_KEY', cloudinaryApiKey, nodeEnv, errors, {
      minLengthDev: 8,
      minLengthProd: 16,
    });
  }

  if (cloudinaryApiSecret) {
    validateSecretStrength(
      'CLOUDINARY_API_SECRET',
      cloudinaryApiSecret,
      nodeEnv,
      errors,
      { minLengthDev: 8, minLengthProd: 16 }
    );
  }

  if (paymobApiKey) {
    validateSecretStrength('PAYMOB_API_KEY', paymobApiKey, nodeEnv, errors, {
      minLengthDev: 8,
      minLengthProd: 16,
    });
  }

  if (
    cloudinaryCloudName &&
    nodeEnv === 'production' &&
    looksLikePlaceholder(cloudinaryCloudName)
  ) {
    errors.push(
      'CLOUDINARY_CLOUD_NAME appears to be a placeholder; set a real value for production'
    );
  }

  const port = readInteger('PORT', process.env.PORT, 5000, errors, {
    min: 1,
    max: 65535,
  });

  const bcryptSaltRounds = readInteger(
    'BCRYPT_SALT_ROUNDS',
    process.env.BCRYPT_SALT_ROUNDS,
    12,
    errors,
    { min: 10, max: 15 }
  );

  const jwtAccessExpiresInSec = readInteger(
    'JWT_ACCESS_EXPIRES_IN_SEC',
    process.env.JWT_ACCESS_EXPIRES_IN_SEC,
    900,
    errors,
    {
      min: 60,
      max: nodeEnv === 'production' ? 3600 : 86400,
    }
  );

  if (errors.length > 0) {
    throw new EnvValidationError(errors);
  }

  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    isDevelopment: nodeEnv === 'development',
    isTest: nodeEnv === 'test',
    port,
    mongodbUri: mongodbUri as string,
    bcryptSaltRounds,
    jwtSecret: jwtSecret as string,
    jwtIssuer: (process.env.JWT_ISSUER ?? 'ecommerce-api').trim(),
    jwtAudience: (process.env.JWT_AUDIENCE ?? 'ecommerce-client').trim(),
    jwtAccessExpiresInSec,
    cloudinaryCloudName: cloudinaryCloudName as string,
    cloudinaryApiKey: cloudinaryApiKey as string,
    cloudinaryApiSecret: cloudinaryApiSecret as string,
    cloudinaryFolder: (process.env.CLOUDINARY_FOLDER ?? 'ecommerce').trim(),
    paymobApiKey: paymobApiKey as string,
  };
}

/**
 * Validated process environment.
 * Importing this module throws EnvValidationError at startup if config is invalid.
 * Secret values are never included in validation error messages.
 */
export const env = loadEnv();

export type AppEnv = typeof env;

/** True if the env var name holds a secret (for log redaction helpers). */
export function isSecretEnvName(name: string): boolean {
  return SECRET_ENV_NAMES.has(name);
}
