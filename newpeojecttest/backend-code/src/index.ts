import express from 'express';
import { AppDataSource } from './data-source';
import { apiRouter } from './routes/index';

const app = express();

app.use(express.json());

app.use('/api/v1', apiRouter);

const port = process.env.PORT;
if (!port) {
    console.error("PORT environment variable is required.");
    process.exit(1);
}

AppDataSource.initialize()
    .then(() => {
        console.log("Data Source has been initialized!");
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    })
    .catch((err) => {
        console.error("Error during Data Source initialization:", err);
        process.exit(1);
    });