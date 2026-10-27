import { DataSource } from 'typeorm';
import { User } from './entities/User';
import { Book } from './entities/Book';
import { Loan } from './entities/Loan';

const host = process.env.DB_HOST;
const port = process.env.DB_PORT;
const username = process.env.DB_USERNAME;
const password = process.env.DB_PASSWORD;
const database = process.env.DB_DATABASE;

if (!host || !port || !username || !password || !database) {
    throw new Error("Missing required database environment variables: DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE must all be set.");
}

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: host,
    port: parseInt(port, 10),
    username: username,
    password: password,
    database: database,
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV !== 'production',
    entities: [User, Book, Loan],
    migrations: [],
    subscribers: [],
});