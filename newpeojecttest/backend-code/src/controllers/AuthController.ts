import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../data-source';
import { User, UserRole } from '../entities/User';

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET environment variable is not set.');
        }

        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({
                error: {
                    code: 400,
                    message: 'Email and password are required.'
                }
            });
            return;
        }

        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({ where: { email } });

        if (!user) {
            res.status(401).json({
                error: {
                    code: 401,
                    message: 'Invalid credentials.'
                }
            });
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            res.status(401).json({
                error: {
                    code: 401,
                    message: 'Invalid credentials.'
                }
            });
            return;
        }

        const roleString = user.role === UserRole.LIBRARIAN ? 'librarian' : 'member';

        const token = jwt.sign(
            { userId: user.id, role: roleString },
            jwtSecret,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            data: {
                token,
                user: {
                    id: user.id,
                    name: user.fullName,
                    role: roleString
                }
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: {
                code: 500,
                message: 'Internal server error.'
            }
        });
    }
};