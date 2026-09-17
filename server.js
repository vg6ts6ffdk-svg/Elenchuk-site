import express from "express";
import multer from "multer";
import cors from "cors";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";
import pg from "pg";
import path from "node:path";
import fs from "node:fs";

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@roseen.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me-now";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const ROOT = process.cwd();
const usePostgres = Boolean(DATABASE_URL);

if (isProduction && JWT_SECRET === "change-this-secret-in-production") {
  throw new Error("JWT_SECRET must be configured in production");
}
if (isProduction && ADMIN_PASSWORD === "change-me-now") {
  throw new Error("ADMIN_PASSWORD must be configured in production");
}

function resolveDataDir() {
  const configured = process.env.ROSEEN_DATA_DIR || path.join(ROOT, "data");
  try {
    fs.mkdirSync(configured, { recursive: true });
    return configured;
  } catch {
    const fallback = path.join("/tmp", "roseen-data");
    fs.mkdirSync(fallback, { recursive: true });
    console.warn(`ROSEEN_DATA_DIR is not writable (${configured}); using ephemeral ${fallback}`);
    return fallback;
  }
}

const DATA_DIR = usePostgres ? null : resolveDataDir();
const UPLOADS = usePostgres ? null : path.join(DATA_DIR, "uploads");
const DB_PATH = usePostgres ? null : path.join(DATA_DIR, "roseen.db");
if (UPLOADS) fs.mkdirSync(UPLOADS, { recursive: true });

let sqlite = null;
let pool = null;

async function initDatabase() {
  if (usePostgres) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
      max: 5
    });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id BIGSERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS requests (
        id BIGSERIAL PRIMARY KEY,
        equipment_type TEXT NOT NULL,
        model TEXT,
        problem TEXT NOT NULL,
        contact TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        comment TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS files (
        id BIGSERIAL PRIMARY KEY,
        request_id BIGINT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
        original_name TEXT NOT NULL,
        mime TEXT,
        size BIGINT,
        content BYTEA NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_files_request_id ON files(request_id);
      CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC);
    `);

    const existing = await pool.query("SELECT id FROM admins WHERE email=$1 LIMIT 1", [ADMIN_EMAIL]);
    if (existing.rowCount === 0) {
      const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
      await pool.query("INSERT INTO admins(email,password_hash) VALUES($1,$2)", [ADMIN_EMAIL, hash]);
      console.log(`Initial admin created: ${ADMIN_EMAIL}`);
    }
    console.log("Database backend: PostgreSQL");
    return;
  }

  sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_type TEXT NOT NULL,
      model TEXT,
      problem TEXT NOT NULL,
      contact TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      comment TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime TEXT,
      size INTEGER,
      FOREIGN KEY(request_id) REFERENCES requests(id) ON DELETE CASCADE
    );
  `);

  const existing = sqlite.prepare("SELECT id FROM admins WHERE email=?").get(ADMIN_EMAIL);
  if (!existing) {
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
    sqlite.prepare("INSERT INTO admins(email,password_hash) VALUES(?,?)").run(ADMIN_EMAIL, hash);
    console.log(`Initial admin created: ${ADMIN_EMAIL}`);
  }
  console.log(`Database backend: SQLite (${DB_PATH})`);
}

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (!FRONTEND_ORIGIN) return callback(new Error("FRONTEND_ORIGIN must be configured for cross-origin requests"), false);
    const allowed = FRONTEND_ORIGIN.split(",").map(value => value.trim()).filter(Boolean);
    return callback(null, allowed.includes(origin));
  },
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
  "video/mp4", "video/webm", "video/quicktime",
  "application/pdf"
]);

const storage = usePostgres
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, UPLOADS),
      filename: (_req, file, cb) => {
        const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safe}`);
      }
    });

const upload = multer({
  storage,
  limits: { files: 8, fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("Разрешены только изображения, видео и PDF"));
    }
    cb(null, true);
  }
});

function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Требуется авторизация" });
  }
}

app.get("/api/health", async (_req, res) => {
  try {
    if (usePostgres) await pool.query("SELECT 1");
    else sqlite.prepare("SELECT 1").get();
    res.json({ ok: true, service: "roseen-api", database: usePostgres ? "postgres" : "sqlite" });
  } catch {
    res.status(503).json({ ok: false, service: "roseen-api", database: "unavailable" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  let admin;
  if (usePostgres) {
    const result = await pool.query("SELECT * FROM admins WHERE email=$1 LIMIT 1", [email]);
    admin = result.rows[0];
  } else {
    admin = sqlite.prepare("SELECT * FROM admins WHERE email=?").get(email);
  }
  if (!admin || !bcrypt.compareSync(password || "", admin.password_hash)) {
    return res.status(401).json({ error: "Неверный логин или пароль" });
  }
  const token = jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: "8h" });
  res.json({ token });
});

app.post("/api/requests", upload.array("files", 8), async (req, res) => {
  const { equipment_type, model, problem, contact } = req.body || {};
  if (!equipment_type || !problem || !contact) {
    return res.status(400).json({ error: "Заполните обязательные поля" });
  }

  if (usePostgres) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        "INSERT INTO requests(equipment_type,model,problem,contact) VALUES($1,$2,$3,$4) RETURNING id",
        [equipment_type, model || "", problem, contact]
      );
      const requestId = Number(inserted.rows[0].id);
      for (const f of (req.files || [])) {
        await client.query(
          "INSERT INTO files(request_id,original_name,mime,size,content) VALUES($1,$2,$3,$4,$5)",
          [requestId, f.originalname, f.mimetype, f.size, f.buffer]
        );
      }
      await client.query("COMMIT");
      return res.status(201).json({ id: requestId, status: "new" });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  const info = sqlite.prepare(
    "INSERT INTO requests(equipment_type,model,problem,contact) VALUES(?,?,?,?)"
  ).run(equipment_type, model || "", problem, contact);
  const requestId = Number(info.lastInsertRowid);
  const insertFile = sqlite.prepare(
    "INSERT INTO files(request_id,original_name,stored_name,mime,size) VALUES(?,?,?,?,?)"
  );
  for (const f of (req.files || [])) {
    insertFile.run(requestId, f.originalname, f.filename, f.mimetype, f.size);
  }
  res.status(201).json({ id: requestId, status: "new" });
});

app.get("/api/requests", auth, async (_req, res) => {
  if (usePostgres) {
    const result = await pool.query(`
      SELECT r.*, COUNT(f.id)::int AS files_count
      FROM requests r LEFT JOIN files f ON f.request_id=r.id
      GROUP BY r.id ORDER BY r.id DESC
    `);
    return res.json(result.rows);
  }
  const rows = sqlite.prepare(`
    SELECT r.*, COUNT(f.id) AS files_count
    FROM requests r LEFT JOIN files f ON f.request_id=r.id
    GROUP BY r.id ORDER BY r.id DESC
  `).all();
  res.json(rows);
});

app.get("/api/requests/:id", auth, async (req, res) => {
  if (usePostgres) {
    const result = await pool.query("SELECT * FROM requests WHERE id=$1", [req.params.id]);
    const request = result.rows[0];
    if (!request) return res.status(404).json({ error: "Заявка не найдена" });
    const files = await pool.query(
      "SELECT id,original_name,mime,size FROM files WHERE request_id=$1 ORDER BY id",
      [req.params.id]
    );
    request.files = files.rows;
    return res.json(request);
  }

  const request = sqlite.prepare("SELECT * FROM requests WHERE id=?").get(req.params.id);
  if (!request) return res.status(404).json({ error: "Заявка не найдена" });
  request.files = sqlite.prepare("SELECT id,original_name,mime,size FROM files WHERE request_id=?").all(req.params.id);
  res.json(request);
});

app.patch("/api/requests/:id", auth, async (req, res) => {
  const { status, comment } = req.body || {};
  const allowed = ["new", "diagnostics", "approval", "repair", "ready", "closed"];
  if (status && !allowed.includes(status)) return res.status(400).json({ error: "Недопустимый статус" });

  if (usePostgres) {
    const current = await pool.query("SELECT id FROM requests WHERE id=$1", [req.params.id]);
    if (current.rowCount === 0) return res.status(404).json({ error: "Заявка не найдена" });
    const result = await pool.query(
      `UPDATE requests
       SET status=COALESCE($1,status), comment=COALESCE($2,comment), updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [status || null, comment === undefined ? null : comment, req.params.id]
    );
    return res.json(result.rows[0]);
  }

  const current = sqlite.prepare("SELECT * FROM requests WHERE id=?").get(req.params.id);
  if (!current) return res.status(404).json({ error: "Заявка не найдена" });
  sqlite.prepare("UPDATE requests SET status=COALESCE(?,status), comment=COALESCE(?,comment), updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(status || null, comment === undefined ? null : comment, req.params.id);
  res.json(sqlite.prepare("SELECT * FROM requests WHERE id=?").get(req.params.id));
});

app.get("/api/files/:id", auth, async (req, res) => {
  if (usePostgres) {
    const result = await pool.query("SELECT original_name,mime,content FROM files WHERE id=$1", [req.params.id]);
    const file = result.rows[0];
    if (!file) return res.status(404).end();
    res.setHeader("Content-Type", file.mime || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
    return res.send(file.content);
  }

  const file = sqlite.prepare("SELECT * FROM files WHERE id=?").get(req.params.id);
  if (!file) return res.status(404).end();
  const absolutePath = path.resolve(UPLOADS, file.stored_name);
  if (!absolutePath.startsWith(`${path.resolve(UPLOADS)}${path.sep}`)) return res.status(400).end();
  res.download(absolutePath, file.original_name);
});

app.use((req, res, next) => {
  const blocked = [
    "/server.js", "/package.json", "/package-lock.json", "/.env",
    "/README.md", "/README-BACKEND.md", "/render.yaml", "/roseen.db",
    "/roseen.db-shm", "/roseen.db-wal"
  ];
  if (blocked.includes(req.path) || req.path.startsWith("/.git") || req.path.startsWith("/uploads/")) {
    return res.status(404).end();
  }
  next();
});

app.use(express.static(ROOT));

app.get("/{*splat}", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).end();
  res.sendFile(path.join(ROOT, "index.html"));
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: "Слишком большой файл или превышено количество файлов" });
  }
  if (err?.message === "Разрешены только изображения, видео и PDF") {
    return res.status(400).json({ error: err.message });
  }
  if (err?.message === "FRONTEND_ORIGIN must be configured for cross-origin requests") {
    return res.status(500).json({ error: "CORS не настроен для frontend" });
  }
  console.error(err);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});

await initDatabase();
app.listen(PORT, "0.0.0.0", () => console.log(`ROSEEN server listening on ${PORT}`));
