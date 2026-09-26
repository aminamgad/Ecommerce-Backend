import bcrypt from 'bcrypt';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { hashPassword, comparePassword } from '../utils/password';
import { signAccessToken } from '../utils/jwt';
import {
  LoginInput,
  LoginResult,
  RegisterInput,
  SafeUser,
} from '../types/auth';

/** Used only to reduce timing differences when the email does not exist. */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('__timing_dummy__', 10);

function isEmailDuplicateKeyError(error: unknown): boolean {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    (error as { code: unknown }).code !== 11000
  ) {
    return false;
  }

  const duplicate = error as {
    keyPattern?: Record<string, unknown>;
    keyValue?: Record<string, unknown>;
    message?: string;
  };

  if (duplicate.keyPattern && 'email' in duplicate.keyPattern) {
    return true;
  }

  if (duplicate.keyValue && 'email' in duplicate.keyValue) {
    return true;
  }

  return (
    typeof duplicate.message === 'string' && duplicate.message.includes('email')
  );
}

const INVALID_CREDENTIALS = 'Invalid email or password';

export async function registerUser(input: RegisterInput): Promise<SafeUser> {
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await User.create({
      name: input.name,
      email: input.email,
      password: passwordHash,
      role: 'customer',
      isActive: true,
      tokenVersion: 0,
    });

    return user.toSafeObject();
  } catch (error) {
    if (isEmailDuplicateKeyError(error)) {
      throw new ApiError(409, 'Email is already registered');
    }
    throw error;
  }
}

export async function loginUser(input: LoginInput): Promise<LoginResult> {
  const user = await User.findOne({ email: input.email })
    .select('+password')
    .exec();

  const hash = user?.password ?? DUMMY_PASSWORD_HASH;
  const passwordMatches = await comparePassword(input.password, hash);

  if (!user || !passwordMatches || !user.isActive) {
    throw new ApiError(401, INVALID_CREDENTIALS);
  }

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    tv: user.tokenVersion,
  });

  return {
    accessToken,
    user: user.toSafeObject(),
  };
}

export async function getCurrentUser(userId: string): Promise<SafeUser> {
  const user = await User.findById(userId).exec();
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Authentication required');
  }
  return user.toSafeObject();
}
