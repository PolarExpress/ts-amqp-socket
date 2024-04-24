/*
 * This program has been developed by students from the bachelor
 * Computer Science at Utrecht University within the Software Project course.
 *
 * © Copyright Utrecht University
 * (Department of Information and Computing Sciences)
 */

import { createClient } from "redis";
import { panic } from "./utils";

/**
 * A store for getting routing keys from Redis.
 * Routing keys are used to route messages to the correct web socket.
 */
export class RoutingKeyStore {
  private redis: ReturnType<typeof createClient>;

  constructor(redis: ReturnType<typeof createClient>) {
    this.redis = redis;
  }

  async get(sessionID: string): Promise<string | null> {
    const redisResponse = await this.redis.get(`routing ${sessionID}`);
    if (!redisResponse) {
      return null;
    }
    return JSON.parse(redisResponse).QueueID;
  }
}
/**
 * Creates a new `RoutingKeyStore` for getting routing keys from Redis.
 * Routing keys are used to route messages to the correct web socket.
 * @returns The created `RoutingKeyStore`
 */
export async function createRoutingKeyStore() {
  const [redis_host, redis_port] =
    process.env.REDIS_ADDRESS?.split(":") ?? panic("REDIS_ADDRESS not set");
  const redis = createClient({
    socket: {
      host: redis_host,
      port: Number(redis_port)
    },
    password: process.env.REDIS_PASSWORD ?? panic("REDIS_PASSWORD not set")
  });

  await redis.connect();

  return new RoutingKeyStore(redis);
}
