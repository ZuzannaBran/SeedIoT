export interface UserJwtPayload {
  sub: string;
  email: string;
  role: string;
  type: 'user';
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

export interface AuthenticatedStation {
  id: string;
  name: string;
}
