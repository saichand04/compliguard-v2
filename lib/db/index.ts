import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Use postgres-js for local Docker compatibility (works with any standard PostgreSQL)
// Neon serverless driver only works with Neon cloud — not local containers
const client = postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
})

export const db = drizzle(client, { schema })
export type DB = typeof db
