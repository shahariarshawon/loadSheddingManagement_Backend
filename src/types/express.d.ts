import { Role } from '../generated/prisma/client.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  areaId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
