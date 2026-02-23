import Redis from 'ioredis';
import { env } from '../../../src/config/env';

const redisUrl = env.REDIS_URL;
if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is required');
}

export const redis = new Redis(redisUrl);
