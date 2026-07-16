const { createClient } = require("redis");

let redisClient = null;
let isConnected = false;

const initRedis = async () => {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        return;
    }
    try {
        redisClient = createClient({ url: redisUrl });
        redisClient.on("error", (err) => {
            console.error("Redis Client Error:", err.message);
            isConnected = false;
        });
        redisClient.on("connect", () => {
            isConnected = true;
        });
        await redisClient.connect();
    } catch (err) {
        console.error("Failed to initialize Redis:", err.message);
        isConnected = false;
    }
};

const getRedisKey = async (key) => {
    if (!isConnected || !redisClient) {
        return null;
    }
    try {
        return await redisClient.get(key);
    } catch (err) {
        console.error("Redis GET Error:", err.message);
        return null;
    }
};

const setRedisKey = async (key, value, expirySeconds = 60) => {
    if (!isConnected || !redisClient) {
        return;
    }
    try {
        await redisClient.set(key, value, { EX: expirySeconds });
    } catch (err) {
        console.error("Redis SET Error:", err.message);
    }
};

const delRedisKey = async (key) => {
    if (!isConnected || !redisClient) {
        return;
    }
    try {
        await redisClient.del(key);
    } catch (err) {
        console.error("Redis DEL Error:", err.message);
    }
};

module.exports = {
    initRedis,
    getRedisKey,
    setRedisKey,
    delRedisKey
};
