import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is missing.');
}

export interface AuthPayload {
  id: string;
  name: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 401,
        message: 'Unauthorized: Missing or invalid Bearer token'
      }
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({
      error: {
        code: 401,
        message: 'Unauthorized: Invalid or expired token'
      }
    });
  }
};

export const authorizeRole = (requiredRole: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 401,
          message: 'Unauthorized: User not authenticated'
        }
      });
      return;
    }

    if (req.user.role !== requiredRole) {
      res.status(403).json({
        error: {
          code: 403,
          message: 'Forbidden: Insufficient permissions'
        }
      });
      return;
    }

    next();
  };
};