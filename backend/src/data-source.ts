// backend/src/data-source.ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

const useUrl = !!process.env.DATABASE_URL;

export default new DataSource(
  useUrl
    ? {
        type: 'mysql',
        url: process.env.DATABASE_URL,
        entities: [__dirname + '/entities/**/*.{ts,js}'],
       migrations: [__dirname + '/migrations/[0-9]*-*.{ts,js}'],
        synchronize: false,
        timezone: 'Z',
      }
    : {
        type: 'mysql',
        host: process.env.DATABASE_HOST || 'localhost',
        port: Number(process.env.DATABASE_PORT || 3306),
        username: process.env.DATABASE_USERNAME || 'root',
        password: process.env.DATABASE_PASSWORD || '',
        database: process.env.DATABASE_NAME || 'drizatx',
        entities: [__dirname + '/entities/**/*.{ts,js}'],
        migrations: [__dirname + '/migrations/[0-9]*-*.{ts,js}'],
        synchronize: false,
        timezone: 'Z',
      },
);
