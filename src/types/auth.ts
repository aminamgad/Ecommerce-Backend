export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export type UserRole = 'customer' | 'admin';

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthUser = {
  id: string;
  role: UserRole;
  tokenVersion: number;
};

export type AccessTokenPayload = {
  sub: string;
  role: UserRole;
  tv: number;
};

export type LoginResult = {
  accessToken: string;
  user: SafeUser;
};
