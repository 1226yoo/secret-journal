import express from "express";
import pg from "pg";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// 1. Supabase 관리자 클라이언트 설정 (서버용)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // 서버에서는 Service Role Key를 사용해 보안 검증을 수행함
);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(express.json());
app.use(cors({ origin: process.env.ORIGIN_URL }));

/**
 * [가장 중요한 변화]
 * 이제 세션 쿠키 대신, 클라이언트가 보낸 'Authorization' 헤더의 JWT를 검증합니다.
 */
const checkAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];
  // Supabase에게 이 토큰이 유효한지 물어봄
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return res.status(401).json({ message: "Invalid token" });

  // 유효하다면 유저 정보를 요청 객체에 담음
  req.user = user;
  next();
};

app.get("/api/notes", checkAuth, async (req, res) => {
  try {
    // 이제 세션 ID가 아닌 supabase user id(uuid)를 사용함
    const result = await pool.query(
      "SELECT * FROM notes WHERE user_id = $1 ORDER BY id DESC",
      [req.user.id],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

app.listen(PORT, () =>
  console.log(`🚀 OAuth Verified Server running on ${PORT}`),
);
