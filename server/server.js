import express from "express";
import pg from "pg";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import session from "express-session";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 10000;
const SESSION_SECRET = process.env.SESSION_SECRET || "your-secret";
const ORIGIN_URL = process.env.ORIGIN_URL || "http://localhost:5173";

// 2. Supabase 연결 통로(Pool) 설정 강화
// 6543 포트(Transaction Mode)를 사용하는 것을 권장합니다.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000, // 연결 시도 제한 시간 추가
});

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

// 3. DB 테이블 초기화 로직 (에러 핸들링 강화)
const initDB = async () => {
  try {
    // 연결 테스트를 먼저 수행합니다.
    const client = await pool.connect();
    console.log("✅ Supabase 금고 본체 연결 성공!");
    client.release();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        content TEXT,
        image_url TEXT,
        date TEXT
      );
    `);
    console.log("📡 모든 테이블 준비 완료!");
  } catch (err) {
    console.error("❌ 금고 건설 실패 (DB 연결 오류):");
    console.error(`이유: ${err.message}`);
    console.error(
      "팁: Supabase 주소의 포트가 6543인지, 비밀번호가 맞는지 확인하세요.",
    );
  }
};
initDB();

const checkAuth = (req, res, next) => {
  if (req.session && req.session.user) next();
  else res.status(401).json({ message: "로그인이 필요합니다." });
};

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

// --- API 로직들 ---

app.post("/api/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: "정보 부족" });

  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    await pool.query("INSERT INTO users (username, password) VALUES ($1, $2)", [
      username,
      hashedPassword,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: "이미 사용 중인 ID입니다." });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    const user = result.rows[0];
    if (user && (await bcrypt.compare(password, user.password))) {
      req.session.user = { id: user.id, username: user.username };
      req.session.save(() => res.json({ success: true }));
    } else {
      res.status(401).json({ message: "아이디나 비밀번호가 틀렸습니다." });
    }
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

app.get("/api/me", (req, res) => {
  if (req.session.user)
    res.json({ isLoggedIn: true, username: req.session.user.username });
  else res.json({ isLoggedIn: false });
});

app.get("/api/notes", checkAuth, async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  const offset = parseInt(req.query.offset) || 0;
  try {
    const result = await pool.query(
      "SELECT * FROM notes WHERE user_id = $1 ORDER BY id DESC LIMIT $2 OFFSET $3",
      [req.session.user.id, limit, offset],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

app.post("/api/notes", checkAuth, upload.single("image"), async (req, res) => {
  const { content } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const date = new Date().toLocaleString();
  try {
    const result = await pool.query(
      "INSERT INTO notes (user_id, content, image_url, date) VALUES ($1, $2, $3, $4) RETURNING *",
      [req.session.user.id, content, imageUrl, date],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(err);
  }
});

app.patch("/api/notes/:id", checkAuth, async (req, res) => {
  const { content } = req.body;
  try {
    await pool.query(
      "UPDATE notes SET content = $1 WHERE id = $2 AND user_id = $3",
      [content, req.params.id, req.session.user.id],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(err);
  }
});

app.delete("/api/notes/:id", checkAuth, async (req, res) => {
  const noteId = req.params.id;
  const userId = req.session.user.id;
  try {
    const result = await pool.query(
      "SELECT image_url FROM notes WHERE id = $1 AND user_id = $2",
      [noteId, userId],
    );
    if (result.rows[0]?.image_url) {
      const absPath = path.join(__dirname, result.rows[0].image_url);
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
    }
    await pool.query("DELETE FROM notes WHERE id = $1 AND user_id = $2", [
      noteId,
      userId,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(err);
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.listen(PORT, () =>
  console.log(`🚀 Supabase Vault Server running on ${PORT}`),
);
