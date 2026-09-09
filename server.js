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
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";
const ROOT = process.cwd();
const UPLOADS = path.join(ROOT, "uploads");
fs.mkdirSync(UPLOADS, { recursive: true });

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors());
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

const adminEmail = process.env.ADMIN_EMAIL || "admin@roseen.local";
const adminPassword = process.env.ADMIN_PASSWORD || "change-me-now";
const existing = db.prepare("SELECT id FROM admins WHERE email=?").get(adminEmail);
if (!existing) {
  const hash = bcrypt.hashSync(adminPassword, 12);
  db.prepare("INSERT INTO admins(email,password_hash) VALUES(?,?)").run(adminEmail, hash);
  console.log(`Initial admin created: ${adminEmail}`);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS),
  filename: (_req, file, cb) => {
    const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,9)}-${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { files: 8, fileSize: 50 * 1024 * 1024 }
});

function auth(req,res,next){
  const h=req.headers.authorization || "";
  const token=h.startsWith("Bearer ") ? h.slice(7) : "";
  try { req.admin=jwt.verify(token,JWT_SECRET); next(); }
  catch { res.status(401).json({error:"Требуется авторизация"}); }
}

app.post("/api/auth/login", (req,res)=>{
  const {email,password}=req.body||{};
  const admin=db.prepare("SELECT * FROM admins WHERE email=?").get(email);
  if(!admin || !bcrypt.compareSync(password||"",admin.password_hash))
    return res.status(401).json({error:"Неверный логин или пароль"});
  const token=jwt.sign({id:admin.id,email:admin.email},JWT_SECRET,{expiresIn:"8h"});
  res.json({token});
});

app.post("/api/requests", upload.array("files",8), (req,res)=>{
  const {equipment_type,model,problem,contact}=req.body||{};
  if(!equipment_type || !problem || !contact)
    return res.status(400).json({error:"Заполните обязательные поля"});
  const info=db.prepare(
    "INSERT INTO requests(equipment_type,model,problem,contact) VALUES(?,?,?,?)"
  ).run(equipment_type,model||"",problem,contact);
  const requestId=Number(info.lastInsertRowid);
  const insertFile=db.prepare(
    "INSERT INTO files(request_id,original_name,stored_name,mime,size) VALUES(?,?,?,?,?)"
  );
  for(const f of (req.files||[])) insertFile.run(requestId,f.originalname,f.filename,f.mimetype,f.size);
  res.status(201).json({id:requestId,status:"new"});
});

app.get("/api/requests", auth, (_req,res)=>{
  const rows=db.prepare(`
    SELECT r.*, COUNT(f.id) AS files_count
    FROM requests r LEFT JOIN files f ON f.request_id=r.id
    GROUP BY r.id ORDER BY r.id DESC
  `).all();
  res.json(rows);
});

app.get("/api/requests/:id", auth, (req,res)=>{
  const r=db.prepare("SELECT * FROM requests WHERE id=?").get(req.params.id);
  if(!r) return res.status(404).json({error:"Заявка не найдена"});
  r.files=db.prepare("SELECT id,original_name,mime,size FROM files WHERE request_id=?").all(req.params.id);
  res.json(r);
});

app.patch("/api/requests/:id", auth, (req,res)=>{
  const {status,comment}=req.body||{};
  const allowed=["new","diagnostics","approval","repair","ready","closed"];
  if(status && !allowed.includes(status)) return res.status(400).json({error:"Недопустимый статус"});
  const current=db.prepare("SELECT * FROM requests WHERE id=?").get(req.params.id);
  if(!current) return res.status(404).json({error:"Заявка не найдена"});
  db.prepare("UPDATE requests SET status=COALESCE(?,status), comment=COALESCE(?,comment), updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(status||null, comment===undefined?null:comment, req.params.id);
  res.json(db.prepare("SELECT * FROM requests WHERE id=?").get(req.params.id));
});

app.get("/api/files/:id", auth, (req,res)=>{
  const f=db.prepare("SELECT * FROM files WHERE id=?").get(req.params.id);
  if(!f) return res.status(404).end();
  res.download(path.join(UPLOADS,f.stored_name), f.original_name);
});

app.use(express.static(ROOT));
app.get("*", (req,res)=>{
  if(req.path.startsWith("/api/")) return res.status(404).end();
  res.sendFile(path.join(ROOT,"index.html"));
});
app.listen(PORT,()=>console.log(`ROSEEN server: http://localhost:${PORT}`));
