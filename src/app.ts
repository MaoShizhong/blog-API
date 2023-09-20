import express, { RequestHandler } from 'express';
import { ValidationChain } from 'express-validator';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { configDotenv } from 'dotenv';

import { resourceRouter } from './routes/resource_router';
import { authRouter } from './routes/auth_router';

declare global {
    interface Error {
        status?: number;
    }

    type FormPOSTHandler = Array<ValidationChain | RequestHandler>;
}

const app = express();
configDotenv();

/*
    - Mongoose setup
*/
mongoose.set('strictQuery', false);

async function connectToDatabase(): Promise<void> {
    await mongoose.connect(process.env.CONNECTION_STRING!);
}

try {
    connectToDatabase();
} catch (error) {
    console.error(error);
}

/*
    - Initialise middleware
*/
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(helmet());

app.use('/', resourceRouter);
app.use('/auth', authRouter);

/*
    - Listen
*/
app.listen(process.env.PORT || '3000');

/*
    - Close MongoDB connection on program exit
*/
['SIGINT', 'exit'].forEach((exitEvent): void => {
    process.on(exitEvent, (): void => {
        mongoose.connection.close();
    });
});
