import express from "express";
import multer from "multer";
import cors from "cors";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@roseen.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me-now";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "";
const ROOT = process.cwd();
const UPLOADS = path.join(ROOT, "uploads");

if (isProduction && JWT_SECRET === "change-this-secret-in-production") {
  throw new Error("JWT_SECRET must be configured in production");
}
if (isProduction && ADMIN_PASSWORD === "change-me-now") {
  throw new Error("ADMIN_PASSWORD must be configured in production");
}

fs.mkdirSync(UPLOADS, { recursive: true });

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

const db = new Database(path.join(ROOT, "roseen.db"));
db.pragma("journal_mode = WAL");
db.exec(`
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

const existing = db.prepare("SELECT id FROM admins WHERE email=?").get(ADMIN_EMAIL);
if (!existing) {
  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
  db.prepare("INSERT INTO admins(email,password_hash) VALUES(?,?)").run(ADMIN_EMAIL, hash);
  console.log(`Initial admin created: ${ADMIN_EMAIL}`);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS),
  filename: (_req, file, cb) => {
    const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,9)}-${safe}`);
  }
});

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
  "video/mp4", "video/webm", "video/quicktime",
  "application/pdf"
]);

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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "roseen-api" });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const admin = db.prepare("SELECT * FROM admins WHERE email=?").get(email);
  if (!admin || !bcrypt.compareSync(password || "", admin.password_hash)) {
    return res.status(401).json({ error: "Неверный логин или пароль" });
  }
  const token = jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: "8h" });
  res.json({ token });
});

app.post("/api/requests", upload.array("files", 8), (req, res) => {
  const { equipment_type, model, problem, contact } = req.body || {};
  if (!equipment_type || !problem || !contact) {
    return res.status(400).json({ error: "Заполните обязательные поля" });
  }

  const info = db.prepare(
    "INSERT INTO requests(equipment_type,model,problem,contact) VALUES(?,?,?,?)"
  ).run(equipment_type, model || "", problem, contact);
  const requestId = Number(info.lastInsertRowid);
  const insertFile = db.prepare(
    "INSERT INTO files(request_id,original_name,stored_name,mime,size) VALUES(?,?,?,?,?)"
  );
  for (const f of (req.files || [])) {
    insertFile.run(requestId, f.originalname, f.filename, f.mimetype, f.size);
  }
  res.status(201).json({ id: requestId, status: "new" });
});

app.get("/api/requests", auth, (_req, res) => {
  const rows = db.prepare(`
    SELECT r.*, COUNT(f.id) AS files_count
    FROM requests r LEFT JOIN files f ON f.request_id=r.id
    GROUP BY r.id ORDER BY r.id DESC
  `).all();
  res.json(rows);
});

app.get("/api/requests/:id", auth, (req, res) => {
  const r = db.prepare("SELECT * FROM requests WHERE id=?").get(req.params.id);
  if (!r) return res.status(404).json({ error: "Заявка не найдена" });
  r.files = db.prepare("SELECT id,original_name,mime,size FROM files WHERE request_id=?").all(req.params.id);
  res.json(r);
});

app.patch("/api/requests/:id", auth, (req, res) => {
  const { status, comment } = req.body || {};
  const allowed = ["new", "diagnostics", "approval", "repair", "ready", "closed"];
  if (status && !allowed.includes(status)) return res.status(400).json({ error: "Недопустимый статус" });
  const current = db.prepare("SELECT * FROM requests WHERE id=?").get(req.params.id);
  if (!current) return res.status(404).json({ error: "Заявка не найдена" });
  db.prepare("UPDATE requests SET status=COALESCE(?,status), comment=COALESCE(?,comment), updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(status || null, comment === undefined ? null : comment, req.params.id);
  res.json(db.prepare("SELECT * FROM requests WHERE id=?").get(req.params.id));
});

app.get("/api/files/:id", auth, (req, res) => {
  const f = db.prepare("SELECT * FROM files WHERE id=?").get(req.params.id);
  if (!f) return res.status(404).end();
  const absolutePath = path.resolve(UPLOADS, f.stored_name);
  if (!absolutePath.startsWith(`${path.resolve(UPLOADS)}${path.sep}`)) return res.status(400).end();
  res.download(absolutePath, f.original_name);
});

// The repository root contains server-side files and the private upload store.
// Keep those paths out of the public static middleware.
app.use((req, res, next) => {
  const blocked = [
    "/server.js", "/package.json", "/package-lock.json", "/roseen.db",
    "/roseen.db-shm", "/roseen.db-wal", "/.env"
  ];
  if (blocked.includes(req.path) || req.path.startsWith("/.git") || req.path.startsWith("/uploads/")) {
    return res.status(404).end();
  }
  next();
});

app.use(express.static(ROOT));

// Express 5 requires a named wildcard; this also matches the root path.
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

app.listen(PORT, "0.0.0.0", () => console.log(`ROSEEN server: http://localhost:${PORT}`));
