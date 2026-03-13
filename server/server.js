import express from "express";
import pg from "pg";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import session from "express-session";
import multer from "multer";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const { Pool } = pg;
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 10000;
const SESSION_SECRET = process.env.SESSION_SECRET || "your-secret";
const ORIGIN_URL = process.env.ORIGIN_URL || "http://localhost:5173";

// --- [Supabase 설정] ---
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// --- [DB 연결] ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

app.set("trust proxy", 1);

app.use(express.json());
app.use(cors({ origin: ORIGIN_URL, credentials: true }));

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

// DB 초기화
const initDB = async () => {
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE, password TEXT);`,
    );
    await pool.query(
      `CREATE TABLE IF NOT EXISTS notes (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), content TEXT, image_url TEXT, date TEXT);`,
    );
  } catch (err) {
    console.error("DB Init Error:", err);
  }
};
initDB();

const checkAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "No token provided" });
  const token = authHeader.split(" ")[1];
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ message: "Invalid token" });
  req.user = user;
  next();
};

// --- [핵심 변경점] 메모리 스토리지 설정 ---
// 하드디스크 대신 메모리(RAM)에 파일을 임시 보관합니다.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- API 로직들 ---
app.get("/api/notes", checkAuth, async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  const offset = parseInt(req.query.offset) || 0;
  try {
    const result = await pool.query(
      "SELECT * FROM notes WHERE user_id = $1 ORDER BY id DESC LIMIT $2 OFFSET $3",
      [req.user.id, limit, offset], // JWT 유저 ID 사용
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

app.post("/api/notes", checkAuth, upload.single("image"), async (req, res) => {
  const { content } = req.body;
  let imageUrl = null;
  const date = new Date().toLocaleString();

  try {
    // 1. 이미지가 첨부되었다면 Supabase Storage에 먼저 업로드합니다.
    if (req.file) {
      // 중복 방지를 위한 고유 파일명 생성
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(req.file.originalname)}`;
      const filePath = `images/${uniqueName}`; // vault 버킷 안의 images 폴더

      // 메모리에 들고 있던 파일(req.file.buffer)을 통째로 업로드
      const { data, error } = await supabaseAdmin.storage
        .from("vault") // 🚨 반드시 Supabase 대시보드에서 'vault'라는 이름의 버킷을 만들어야 합니다!
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (error) throw new Error("Storage upload failed");

      // 업로드 성공 후, 누구나 접근할 수 있는 Public URL을 받아옵니다.
      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from("vault").getPublicUrl(filePath);

      imageUrl = publicUrl; // "https://xyz.../vault/images/..." 형태의 절대 주소
    }

    // 2. 최종 URL과 내용을 DB에 저장합니다.
    const result = await pool.query(
      "INSERT INTO notes (user_id, content, image_url, date) VALUES ($1, $2, $3, $4) RETURNING *",
      [req.user.id, content, imageUrl, date],
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "서버 오류" });
  }
});

app.delete("/api/notes/:id", checkAuth, async (req, res) => {
  const noteId = req.params.id;
  const userId = req.user.id;
  try {
    // 1. 지울 메모의 이미지 URL을 먼저 찾습니다.
    const result = await pool.query(
      "SELECT image_url FROM notes WHERE id = $1 AND user_id = $2",
      [noteId, userId],
    );
    const imageUrl = result.rows[0]?.image_url;

    // 2. 이미지가 존재한다면 Supabase Storage에서도 삭제합니다.
    if (imageUrl) {
      // URL에서 "images/파일명" 부분만 추출
      const filePath = imageUrl.split("/vault/")[1];
      if (filePath) {
        await supabaseAdmin.storage.from("vault").remove([filePath]);
      }
    }

    // 3. DB 기록 삭제
    await pool.query("DELETE FROM notes WHERE id = $1 AND user_id = $2", [
      noteId,
      userId,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(err);
  }
});

app.patch("/api/notes/:id", checkAuth, async (req, res) => {
  const { content } = req.body;
  try {
    await pool.query(
      "UPDATE notes SET content = $1 WHERE id = $2 AND user_id = $3",
      [content, req.params.id, req.user.id],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(err);
  }
});

app.listen(PORT, () =>
  console.log(`🚀 Supabase Storage Server running on ${PORT}`),
);
