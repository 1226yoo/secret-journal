import express from "express";
import pg from "pg";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 10000;

// 1. Supabase 관리자 클라이언트 (서버 보안 검증용)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// 2. DB 연결 (PostgreSQL)
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(express.json());
app.use(cors({ origin: process.env.ORIGIN_URL }));

// 이미지 저장 설정
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

/**
 * [Middleware] JWT 검증
 */
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

  req.user = user; // Supabase의 유저 정보(UUID)를 담음
  next();
};

// --- API ---

// 1. 메모 조회 (유저별)
app.get("/api/notes", checkAuth, async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  const offset = parseInt(req.query.offset) || 0;
  try {
    const result = await pool.query(
      "SELECT * FROM notes WHERE user_id = $1 ORDER BY id DESC LIMIT $2 OFFSET $3",
      [req.user.id, limit, offset],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

// 2. 메모 등록 (유저별)
app.post("/api/notes", checkAuth, upload.single("image"), async (req, res) => {
  const { content } = req.body;
  const date = new Date().toLocaleString();
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const result = await pool.query(
      "INSERT INTO notes (user_id, content, image_url, date) VALUES ($1, $2, $3, $4) RETURNING *",
      [req.user.id, content, imageUrl, date],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(err);
  }
});

// 3. 메모 삭제 (본인 것만)
app.delete("/api/notes/:id", checkAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING image_url",
      [req.params.id, req.user.id],
    );

    if (result.rowCount === 0)
      return res.status(404).json({ message: "Not found" });

    const imageUrl = result.rows[0].image_url;
    if (imageUrl) {
      const absPath = path.join(__dirname, imageUrl);
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(err);
  }
});

app.listen(PORT, () =>
  console.log(`🚀 OAuth Full-Stack Server running on ${PORT}`),
);
