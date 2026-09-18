import express from "express";
import multer from "multer";
import cors from "cors";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from 'node:url';
import { publicFiles } from './public-files.mjs';
import { cleanFiles, fields, fileFilter, validateFiles, rateLimit } from './security.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
if (fs.existsSync(path.join(ROOT,'.env'))) process.loadEnvFile(path.join(ROOT,'.env'));

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@roseen.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me-now";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const STORAGE_SIGNER_URL = (process.env.STORAGE_SIGNER_URL || "").replace(/\/+$/, "");
const STORAGE_SIGNER_KEY = process.env.STORAGE_SIGNER_KEY || "";
const usePostgres = Boolean(DATABASE_URL);
const useObjectStorage = Boolean(usePostgres && STORAGE_SIGNER_URL && STORAGE_SIGNER_KEY);
const configurationErrors=[];

if (isProduction && (JWT_SECRET.length < 32 || JWT_SECRET === "change-this-secret-in-production")) {
  configurationErrors.push('JWT_SECRET');
}
if (isProduction && ADMIN_PASSWORD === "change-me-now") {
  configurationErrors.push('ADMIN_PASSWORD');
}
if(isProduction && !usePostgres) configurationErrors.push('DATABASE_URL');

function resolveDataDir() {
  if (isProduction) throw new Error('Production requires persistent DATABASE_URL; SQLite fallback is disabled');
  const configured = process.env.ROSEEN_DATA_DIR || path.join(ROOT, "data");
  fs.mkdirSync(configured, { recursive: true });
  return configured;
}

const DATA_DIR = usePostgres || isProduction ? null : resolveDataDir();
const UPLOADS = DATA_DIR ? path.join(DATA_DIR, "uploads") : null;
const DB_PATH = DATA_DIR ? path.join(DATA_DIR, "roseen.db") : null;
if (UPLOADS) fs.mkdirSync(UPLOADS, { recursive: true });

let sqlite = null;
let pool = null;

async function initDatabase() {
  if (usePostgres) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: true } : false,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
      max: 5
    });
    pool.on('error',error=>console.error('Database pool error:',error.code || 'connection failure'));

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
        content BYTEA,
        object_key TEXT
      );
      ALTER TABLE files ADD COLUMN IF NOT EXISTS object_key TEXT;
      ALTER TABLE files ALTER COLUMN content DROP NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_files_request_id ON files(request_id);
      CREATE INDEX IF NOT EXISTS idx_files_object_key ON files(object_key);
      CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC);
    `);

    const existing = await pool.query("SELECT id FROM admins WHERE email=$1 LIMIT 1", [ADMIN_EMAIL]);
    if (existing.rowCount === 0) {
      const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
      await pool.query("INSERT INTO admins(email,password_hash) VALUES($1,$2)", [ADMIN_EMAIL, hash]);
      console.log(`Initial admin created: ${ADMIN_EMAIL}`);
    }
    console.log("Database backend: PostgreSQL");
    console.log(`Attachment backend: ${useObjectStorage ? "Neon Object Storage" : "PostgreSQL fallback"}`);
    return;
  }

  const { default: Database } = await import('better-sqlite3');
  sqlite = new Database(DB_PATH);
  sqlite.pragma('foreign_keys = ON');
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
  console.log("Attachment backend: local filesystem");
}

app.disable('x-powered-by');
if (process.env.TRUST_PROXY_HOPS) {
  const hops=Number(process.env.TRUST_PROXY_HOPS);
  if(!Number.isInteger(hops)||hops<0||hops>3) throw new Error('TRUST_PROXY_HOPS must be 0..3');
  app.set('trust proxy',hops);
}
app.use(helmet({ contentSecurityPolicy: { directives: {
  scriptSrc: ["'self'"], scriptSrcAttr: ["'none'"],
  connectSrc: ["'self'",'https://api.roseen.ru'], formAction: ["'self'",'https://api.roseen.ru'],
  upgradeInsecureRequests: isProduction ? [] : null
}}}));
app.use('/api', (req,res,next) => {
  res.set('Cache-Control','no-store');
  const origin=req.headers.origin;
  const allowed=FRONTEND_ORIGIN.split(',').map(v=>v.trim());
  const own=(isProduction?'https://':'http://')+req.get('host');
  if(origin && origin!==own && !allowed.includes(origin)) return res.status(403).json({error:'Источник запроса не разрешён'});
  next();
});
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    return callback(null, origin);
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
let databaseReady;
async function initialize() {
  await initDatabase();
  if(usePostgres) await pool.query('CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, expires_at BIGINT NOT NULL)');
  else sqlite.exec('CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)');
}
// Public pages must remain available during an API/storage outage.
app.use('/api',async (_req,res,next)=>{
  if(configurationErrors.length) {
    console.error('Missing or invalid configuration:',configurationErrors.join(', '));
    return res.status(503).json({error:'Сервис приёма заявок временно не настроен. Данные остались в форме.',code:'CONFIGURATION_ERROR'});
  }
  try { databaseReady ||= initialize(); await databaseReady; next(); }
  catch(error) {
    console.error('Database initialization failed:',error.code || error.name);
    res.status(503).json({error:'Сервис временно недоступен. Данные остались в форме.',code:'DATABASE_UNAVAILABLE'});
  }
});

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
  limits: { files: 3, fileSize: 3 * 1024 * 1024, fields:4, fieldSize:20*1024, parts:7 },
  fileFilter
});

const cookieName = isProduction ? '__Host-roseen_session' : 'roseen_session';
const cookieOptions = {httpOnly:true, secure:isProduction, sameSite:'lax', path:'/'};
const getToken = req => (req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1) || '';
async function sessionQuery(sql, params) {
  if(usePostgres) return (await pool.query(sql,params)).rows;
  const query=sql.replace(/\$\d+/g,'?');
  if(/^SELECT/.test(query)) return sqlite.prepare(query).all(...params);
  sqlite.prepare(query).run(...params); return [];
}
async function auth(req, res, next) {
  try {
    req.admin = jwt.verify(getToken(req), JWT_SECRET, {algorithms:['HS256'],issuer:'roseen-api',audience:'roseen-admin'});
    const sessions=await sessionQuery('SELECT id FROM sessions WHERE id=$1 AND expires_at>$2',[req.admin.jti,Date.now()]);
    if(!sessions.length) throw new Error('Session expired');
    next();
  } catch {
    res.status(401).json({ error: "Требуется авторизация" });
  }
}

function safeObjectName(name) {
  const base = path.basename(name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
  return base || "file";
}

function createObjectKey(requestId, originalName) {
  return `requests/${requestId}/${Date.now()}-${randomUUID()}-${safeObjectName(originalName)}`;
}

async function getSignedStorageUrl(method, key, expiresIn = 300) {
  if (!useObjectStorage) throw new Error("Object storage is not configured");
  const response = await fetch(`${STORAGE_SIGNER_URL}/sign`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-roseen-storage-key": STORAGE_SIGNER_KEY
    },
    body: JSON.stringify({ method, key, expiresIn })
  });
  if (!response.ok) {
    throw new Error(`Storage signer failed with HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!payload?.url) throw new Error("Storage signer returned no URL");
  return payload.url;
}

async function putStoredObject(key, file) {
  const url = await getSignedStorageUrl("PUT", key, 300);
  const response = await fetch(url, {
    method: "PUT",
    headers: { "content-type": file.mimetype || "application/octet-stream" },
    body: file.buffer
  });
  if (!response.ok) throw new Error(`Object upload failed with HTTP ${response.status}`);
}

async function deleteStoredObjects(keys) {
  if (!useObjectStorage || !keys.length) return;
  await Promise.allSettled(keys.map(async key => {
    const url = await getSignedStorageUrl("DELETE", key, 300);
    const response = await fetch(url, { method: "DELETE" });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Object cleanup failed with HTTP ${response.status}`);
    }
  }));
}

app.get("/api/health", async (_req, res) => {
  try {
    if (usePostgres) await pool.query("SELECT 1");
    else sqlite.prepare("SELECT 1").get();
    res.json({
      ok: true,
      service: "roseen-api",
      database: usePostgres ? "postgres" : "sqlite",
      attachments: useObjectStorage ? "object-storage" : (usePostgres ? "database" : "filesystem")
    });
  } catch {
    res.status(503).json({ ok: false, service: "roseen-api", database: "unavailable" });
  }
});

app.post("/api/auth/login", rateLimit(10,15*60*1000), async (req, res) => {
  const { email, password } = req.body || {};
  if(typeof email!=='string' || typeof password!=='string' || email.length>254 || Buffer.byteLength(password)>72) return res.status(400).json({error:'Проверьте логин и пароль'});
  let admin;
  if (usePostgres) {
    const result = await pool.query("SELECT * FROM admins WHERE email=$1 LIMIT 1", [email]);
    admin = result.rows[0];
  } else {
    admin = sqlite.prepare("SELECT * FROM admins WHERE email=?").get(email);
  }
  if (!admin || !await bcrypt.compare(password, admin.password_hash)) {
    return res.status(401).json({ error: "Неверный логин или пароль" });
  }
  const id=randomUUID();
  await sessionQuery('DELETE FROM sessions WHERE expires_at<$1',[Date.now()]);
  await sessionQuery('INSERT INTO sessions(id,expires_at) VALUES($1,$2)',[id,Date.now()+8*3600000]);
  const token = jwt.sign({ id: admin.id }, JWT_SECRET, { expiresIn: '8h', jwtid:id,issuer:'roseen-api',audience:'roseen-admin',algorithm:'HS256' });
  res.cookie(cookieName,token,{...cookieOptions,maxAge:8*3600000}).json({ok:true});
});
app.get('/api/auth/session',auth,(_req,res)=>res.json({ok:true}));
app.post('/api/auth/logout',async (req,res)=>{
  try {const p=jwt.verify(getToken(req),JWT_SECRET);await sessionQuery('DELETE FROM sessions WHERE id=$1',[p.jti]);} catch {}
  res.clearCookie(cookieName,cookieOptions).json({ok:true});
});

app.post("/api/requests", rateLimit(20,3600000), upload.array("files", 3), async (req, res) => {
  const { equipment_type, model, problem, contact } = fields(req.body);
  validateFiles(req.files);
  if (!equipment_type || !problem || !contact) {
    return res.status(400).json({ error: "Заполните обязательные поля" });
  }

  if (usePostgres) {
    const client = await pool.connect();
    const uploadedKeys = [];
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        "INSERT INTO requests(equipment_type,model,problem,contact) VALUES($1,$2,$3,$4) RETURNING id",
        [equipment_type, model || "", problem, contact]
      );
      const requestId = Number(inserted.rows[0].id);

      for (const f of (req.files || [])) {
        if (useObjectStorage) {
          const objectKey = createObjectKey(requestId, f.originalname);
          await putStoredObject(objectKey, f);
          uploadedKeys.push(objectKey);
          await client.query(
            "INSERT INTO files(request_id,original_name,mime,size,object_key) VALUES($1,$2,$3,$4,$5)",
            [requestId, f.originalname, f.mimetype, f.size, objectKey]
          );
        } else {
          await client.query(
            "INSERT INTO files(request_id,original_name,mime,size,content) VALUES($1,$2,$3,$4,$5)",
            [requestId, f.originalname, f.mimetype, f.size, f.buffer]
          );
        }
      }

      await client.query("COMMIT");
      return res.status(201).json({ id: requestId, status: "new" });
    } catch (error) {
      await client.query("ROLLBACK");
      await deleteStoredObjects(uploadedKeys);
      throw error;
    } finally {
      client.release();
    }
  }

  const save = sqlite.transaction(() => {
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
  return requestId;
  });
  const requestId=save();
  res.status(201).json({ id: requestId, status: "new" });
});

app.get("/api/requests", auth, async (req, res) => {
  const limit=Math.min(100,Math.max(1,Math.floor(Number(req.query.limit)||50)));
  const before=Number(req.query.before)||Number.MAX_SAFE_INTEGER;
  if (usePostgres) {
    const result = await pool.query(`
      SELECT r.*, COUNT(f.id)::int AS files_count
      FROM requests r LEFT JOIN files f ON f.request_id=r.id
      WHERE r.id < $1 GROUP BY r.id ORDER BY r.id DESC LIMIT $2
    `,[before,limit]);
    return res.json(result.rows);
  }
  const rows = sqlite.prepare(`
    SELECT r.*, COUNT(f.id) AS files_count
    FROM requests r LEFT JOIN files f ON f.request_id=r.id
    WHERE r.id < ? GROUP BY r.id ORDER BY r.id DESC LIMIT ?
  `).all(before,limit);
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
  if(typeof comment!=='string' || comment.length>5000 || !allowed.includes(status)) return res.status(400).json({error:'Проверьте статус и комментарий'});
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
    const result = await pool.query(
      "SELECT original_name,mime,size,content,object_key FROM files WHERE id=$1",
      [req.params.id]
    );
    const file = result.rows[0];
    if (!file) return res.status(404).end();

    res.setHeader("Content-Type", file.mime || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);

    if (file.object_key && useObjectStorage) {
      const url = await getSignedStorageUrl("GET", file.object_key, 300);
      const stored = await fetch(url);
      if (!stored.ok) return res.status(stored.status === 404 ? 404 : 502).end();
      const length = stored.headers.get("content-length");
      if (length) res.setHeader("Content-Length", length);
      const bytes = Buffer.from(await stored.arrayBuffer());
      return res.end(bytes);
    }

    if (file.content) return res.send(file.content);
    return res.status(404).end();
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

app.get("/{*splat}", (req, res) => {
  const name=req.path==='/'?'index.html':req.path.slice(1);
  const base=fs.existsSync(path.join(ROOT,'dist/index.html'))?path.join(ROOT,'dist'):ROOT;
  if(publicFiles.includes(name)) return res.sendFile(path.join(base,name));
  if (req.path.startsWith('/api/')) return res.status(404).json({error:'Маршрут не найден'});
  res.status(404).sendFile(path.join(base,'404.html'));
});

app.use((err, req, res, _next) => {
  cleanFiles(req.files);
  if(res.headersSent) return;
  if(err.status===400) return res.status(400).json({error:err.message});
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

export default app;
if(!process.env.VERCEL) {
  const server=app.listen(PORT, process.env.HOST || (isProduction?'0.0.0.0':'127.0.0.1'),()=>console.log(`ROSEEN listening on ${server.address().port}`));
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(async()=>{if(pool)await pool.end();if(sqlite)sqlite.close();process.exit(0);}));
}
