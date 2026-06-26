import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Connection, Platform, User } from "./types";

// Simple server-side persistence for now: a JSON file under .data/ (gitignored).
// TODO: replace with a real database. This naive read-modify-write is fine for
// single-instance local dev but is not safe under concurrency or at scale.
const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "auth.json");

interface DB {
  users: Record<string, User>;
}

async function read(): Promise<DB> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as DB;
  } catch {
    return { users: {} };
  }
}

async function write(db: DB): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
}

export async function getUserById(id: string): Promise<User | null> {
  const db = await read();
  return db.users[id] ?? null;
}

// Upsert a connection, keyed by (platform, platformUserId). Reuses the existing
// Prismarity user that owns that connection, otherwise creates a new one.
export async function upsertConnection(conn: Connection): Promise<User> {
  const db = await read();

  let user = Object.values(db.users).find((u) =>
    u.connections.some(
      (c) => c.platform === conn.platform && c.platformUserId === conn.platformUserId
    )
  );

  if (!user) {
    user = { id: randomUUID(), createdAt: Date.now(), connections: [] };
    db.users[user.id] = user;
  }

  const idx = user.connections.findIndex(
    (c) => c.platform === conn.platform && c.platformUserId === conn.platformUserId
  );
  if (idx >= 0) user.connections[idx] = conn;
  else user.connections.push(conn);

  await write(db);
  return user;
}

// Remove a single platform connection from a user. Returns the updated user,
// or null if the user doesn't exist. Does NOT delete the user record even if
// all connections are removed — the caller decides whether to clear the session.
export async function removeConnection(
  userId: string,
  platform: Platform
): Promise<User | null> {
  const db = await read();
  const user = db.users[userId];
  if (!user) return null;
  user.connections = user.connections.filter((c) => c.platform !== platform);
  await write(db);
  return user;
}

// Attach a connection, preferring (in order): the user who already owns this
// exact connection, then the current session user (so a second platform links
// to the same Prismarity account), then a brand-new user.
// TODO: if the connection is owned by user A but the session is user B, this
// keeps it on A — fine for single-user local dev; revisit when merging accounts.
export async function attachConnection(
  conn: Connection,
  currentUserId?: string | null
): Promise<User> {
  const db = await read();

  let owner = Object.values(db.users).find((u) =>
    u.connections.some(
      (c) => c.platform === conn.platform && c.platformUserId === conn.platformUserId
    )
  );

  if (!owner && currentUserId && db.users[currentUserId]) {
    owner = db.users[currentUserId];
  }

  if (!owner) {
    owner = { id: randomUUID(), createdAt: Date.now(), connections: [] };
    db.users[owner.id] = owner;
  }

  const idx = owner.connections.findIndex(
    (c) => c.platform === conn.platform && c.platformUserId === conn.platformUserId
  );
  if (idx >= 0) owner.connections[idx] = conn;
  else owner.connections.push(conn);

  await write(db);
  return owner;
}
