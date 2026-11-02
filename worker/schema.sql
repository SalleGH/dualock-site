-- D1 database "dualock-waitlist" (EU jurisdiction), bound to the Worker as DB.
CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  source TEXT,
  country TEXT,
  created_at TEXT NOT NULL
);
