import express from "express";
import sqlite3 from "sqlite3";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import session from "express-session";
import multer from "multer";
import fs from "fs"; // 파일 시스템 모듈
import dotenv from "dotenv";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// const dbPath = path.join(__dirname, "journal.sqlite");
const PORT = process.env.PORT || 5000;
const SESSION_SECRET = process.env.SESSION_SECRET || "fallback-secret-key";
const DB_PATH = path.join(__dirname, process.env.DB_PATH || "journal.sqlite");
const ORIGIN_URL = process.env.ORIGIN_URL || "http://localhost:5173";

// [설정] 업로드 폴더 체크
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// 1. 미들웨어 설정
app.use(express.json());
app.use(
  cors({
    origin: ORIGIN_URL,
    credentials: true,
  }),
);
app.use("/uploads", express.static(uploadDir));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 60 * 60 * 1000,
      secure: false,
      httpOnly: true,
      sameSite: "lax",
    },
  }),
);

// 2. Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

// 3. 데이터베이스 연결 및 스키마 설정
const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)",
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, content TEXT, image_url TEXT, date TEXT)",
  );
});

// 보안 미들웨어
const checkAuth = (req, res, next) => {
  if (req.session && req.session.user) next();
  else res.status(401).json({ message: "로그인이 필요합니다." });
};

// --- AUTH API ---
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
      if (!user) return res.status(401).json({ message: "아이디 없음" });
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        req.session.user = { id: user.id, username: user.username };
        req.session.save(() => res.json({ success: true }));
      } else res.status(401).json({ message: "비번 틀림" });
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

// --- CRUD API ---

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
  const userId = req.session.user.id;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  db.run(
    "INSERT INTO notes (user_id, content, image_url, date) VALUES (?, ?, ?, ?)",
    [userId, content, imageUrl, date],
    function () {
      res.json({ id: this.lastID, content, image_url: imageUrl, date });
    },
  );
});

// [변경] 삭제 시 물리적 파일 삭제 로직 추가
app.delete("/api/notes/:id", checkAuth, (req, res) => {
  const noteId = req.params.id;
  const userId = req.session.user.id;

  // 1. 먼저 삭제할 메모의 이미지 경로를 조회합니다.
  db.get(
    "SELECT image_url FROM notes WHERE id = ? AND user_id = ?",
    [noteId, userId],
    (err, row) => {
      if (err) return res.status(500).json({ message: "DB 에러" });
      if (!row)
        return res.status(404).json({ message: "메모를 찾을 수 없습니다." });

      const targetImageUrl = row.image_url;

      // 2. DB에서 레코드를 삭제합니다.
      db.run(
        "DELETE FROM notes WHERE id = ? AND user_id = ?",
        [noteId, userId],
        function (err) {
          if (err) return res.status(500).json({ message: "삭제 실패" });

          // 3. DB 삭제 성공 후, 연결된 파일이 있다면 서버에서도 삭제합니다.
          if (targetImageUrl) {
            const absolutePath = path.join(__dirname, targetImageUrl);
            fs.unlink(absolutePath, (unlinkErr) => {
              if (unlinkErr) {
                console.error(
                  "⚠️ 파일 삭제 실패 (파일이 이미 없을 수 있음):",
                  unlinkErr.message,
                );
              } else {
                console.log("✅ 물리적 파일 삭제 완료:", absolutePath);
              }
            });
          }

          res.json({ success: true });
        },
      );
    },
  );
});

app.patch("/api/notes/:id", checkAuth, (req, res) => {
  const { content } = req.body;
  db.run(
    "UPDATE notes SET content = ? WHERE id = ? AND user_id = ?",
    [content, req.params.id, req.session.user.id],
    function () {
      res.json({ success: true });
    },
  );
});

app.listen(PORT, () =>
  console.log("🚀 파일 관리 보안 서버 가동: http://localhost:5000"),
);
