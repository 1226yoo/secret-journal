import express from "express";
import sqlite3 from "sqlite3";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import session from "express-session";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 10000;
const SESSION_SECRET = process.env.SESSION_SECRET || "your-secret";
const DB_PATH = path.join(__dirname, process.env.DB_PATH || "journal.sqlite");
const ORIGIN_URL = process.env.ORIGIN_URL || "http://localhost:5173";

app.set("trust proxy", 1);

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.use(express.json());
app.use(cors({ origin: ORIGIN_URL, credentials: true }));
app.use("/uploads", express.static(uploadDir));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      maxAge: 60 * 60 * 1000,
      secure: true,
      sameSite: "none",
      httpOnly: true,
    },
  }),
);

const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)",
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, content TEXT, image_url TEXT, date TEXT)",
  );
});

const checkAuth = (req, res, next) => {
  if (req.session && req.session.user) next();
  else res.status(401).json({ message: "인증이 필요합니다." });
};

// --- AUTH API (유효성 검사 추가) ---
app.post("/api/signup", async (req, res) => {
  const { username, password } = req.body;

  // [보안] 빈 값 체크
  if (!username || !password || username.length < 2 || password.length < 4) {
    return res
      .status(400)
      .json({
        message: "아이디(2자 이상)와 비밀번호(4자 이상)를 확인해주세요.",
      });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  db.run(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [username, hashedPassword],
    (err) => {
      if (err)
        return res
          .status(400)
          .json({ message: "이미 사용 중인 아이디입니다." });
      res.json({ success: true });
    },
  );
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, user) => {
      if (!user)
        return res.status(401).json({ message: "가입되지 않은 아이디입니다." });
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        req.session.user = { id: user.id, username: user.username };
        req.session.save(() => res.json({ success: true }));
      } else res.status(401).json({ message: "비밀번호가 일치하지 않습니다." });
    },
  );
});

app.get("/api/me", (req, res) => {
  if (req.session.user)
    res.json({ isLoggedIn: true, username: req.session.user.username });
  else res.json({ isLoggedIn: false });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// --- CRUD API (유효성 검사 강화) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

app.get("/api/notes", checkAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  const offset = parseInt(req.query.offset) || 0;
  db.all(
    "SELECT * FROM notes WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
    [req.session.user.id, limit, offset],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "서버 오류" });
      res.json(rows || []);
    },
  );
});

app.post("/api/notes", checkAuth, upload.single("image"), (req, res) => {
  const { content } = req.body;

  // [데이터 무결성] 서버에서 한 번 더 글자 수 및 존재 여부 체크
  if (!content || content.trim().length === 0)
    return res.status(400).json({ message: "내용을 입력하세요." });
  if (content.length > 500)
    return res.status(400).json({ message: "500자 이내로 입력하세요." });

  const date = new Date().toLocaleString();
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  db.run(
    "INSERT INTO notes (user_id, content, image_url, date) VALUES (?, ?, ?, ?)",
    [req.session.user.id, content, imageUrl, date],
    function () {
      res.json({ id: this.lastID, content, image_url: imageUrl, date });
    },
  );
});

app.patch("/api/notes/:id", checkAuth, (req, res) => {
  const { content } = req.body;
  if (!content || content.trim().length === 0)
    return res.status(400).json({ message: "수정할 내용을 입력하세요." });

  db.run(
    "UPDATE notes SET content = ? WHERE id = ? AND user_id = ?",
    [content, req.params.id, req.session.user.id],
    function (err) {
      if (err) return res.status(500).json({ message: "수정 중 오류 발생" });
      res.json({ success: true });
    },
  );
});

app.delete("/api/notes/:id", checkAuth, (req, res) => {
  const noteId = req.params.id;
  db.get(
    "SELECT image_url FROM notes WHERE id = ? AND user_id = ?",
    [noteId, req.session.user.id],
    (err, row) => {
      if (row && row.image_url) {
        const absPath = path.join(__dirname, row.image_url);
        if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
      }
      db.run(
        "DELETE FROM notes WHERE id = ? AND user_id = ?",
        [noteId, req.session.user.id],
        () => res.json({ success: true }),
      );
    },
  );
});

app.listen(PORT, () => console.log(`🚀 Secure Server running on ${PORT}`));
