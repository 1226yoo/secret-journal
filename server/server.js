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
const SESSION_SECRET = process.env.SESSION_SECRET || "your-fallback-secret";
const DB_PATH = path.join(__dirname, process.env.DB_PATH || "journal.sqlite");
const ORIGIN_URL = process.env.ORIGIN_URL || "http://localhost:5173";

// [중요] Render와 같은 프록시 환경에서 HTTPS 쿠키를 전송하기 위한 설정
app.set("trust proxy", 1);

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.use(express.json());

// 1. CORS 설정: 반드시 주소 끝에 /가 없어야 하며, credentials: true가 필수입니다.
app.use(
  cors({
    origin: ORIGIN_URL,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use("/uploads", express.static(uploadDir));

// 2. 세션 설정 (배포 환경 최적화)
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true, // 프록시 환경(Render) 인정
    cookie: {
      maxAge: 60 * 60 * 1000,
      // [핵심] 배포 환경(HTTPS)에서는 아래 두 설정이 필수입니다.
      // 로컬 테스트 중이라면 secure: false로 잠시 바꿔야 할 수도 있습니다.
      secure: true,
      sameSite: "none", // 서로 다른 도메인(subdomain) 간 쿠키 허용
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
  else res.status(401).json({ message: "로그인이 필요합니다." });
};

// --- API 영역 (기존과 동일하되 에러 로그 강화) ---
app.post("/api/signup", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  db.run(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [username, hashedPassword],
    (err) => {
      if (err) return res.status(400).json({ message: "아이디 중복" });
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
        return res.status(401).json({ message: "사용자를 찾을 수 없음" });
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        req.session.user = { id: user.id, username: user.username };
        // 세션 저장 후 응답을 보내는 것이 안전합니다.
        req.session.save((saveErr) => {
          if (saveErr)
            return res.status(500).json({ message: "세션 저장 실패" });
          res.json({ success: true });
        });
      } else res.status(401).json({ message: "비밀번호 불일치" });
    },
  );
});

app.get("/api/me", (req, res) => {
  if (req.session.user)
    res.json({ isLoggedIn: true, username: req.session.user.username });
  else res.json({ isLoggedIn: false });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid"); // 쿠키 강제 삭제
    res.json({ success: true });
  });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

app.get("/api/notes", checkAuth, (req, res) => {
  db.all(
    "SELECT * FROM notes WHERE user_id = ? ORDER BY id DESC",
    [req.session.user.id],
    (err, rows) => {
      res.json(rows || []);
    },
  );
});

app.post("/api/notes", checkAuth, upload.single("image"), (req, res) => {
  const { content } = req.body;
  const date = new Date().toLocaleString();
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  db.run(
    "INSERT INTO notes (user_id, content, image_url, date) VALUES (?, ?, ?, ?)",
    [req.session.user.id, content, imageUrl, date],
    function (err) {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ id: this.lastID, content, image_url: imageUrl, date });
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

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
