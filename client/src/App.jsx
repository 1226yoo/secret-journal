import React, { useState, useEffect, useMemo } from "react";
import {
  Lock,
  Unlock,
  Search,
  Plus,
  Image as ImageIcon,
  Trash2,
  LogOut,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";

/**
 * [STEP 2-1: Pro Version] Secret Journal App
 * 1. UI/UX: 브라우저 alert() 대신 커스텀 토스트(Toast) 알림 사용
 * 2. Logic: useToast 커스텀 훅을 통한 알림 로직 분리
 * 3. Design: Lucide Icons와 Tailwind CSS를 활용한 현대적인 디자인
 * 4. Auth: 세션 유지 및 배포 환경(HTTPS) 완벽 대응
 */

// --- 환경 변수 설정 ---
const getApiUrl = () => {
  let url = "http://localhost:5000";
  try {
    if (
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_API_URL
    ) {
      url = import.meta.env.VITE_API_URL;
    }
  } catch (e) {
    console.warn("환경 변수 접근 오류, 기본값을 사용합니다.");
  }
  return url.replace(/\/$/, "");
};

const API_URL = getApiUrl();

// --- 커스텀 훅: 토스트 알림 로직 ---
const useToast = () => {
  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, showToast, hideToast: () => setToast(null) };
};

const App = () => {
  const [view, setView] = useState("login");
  const [user, setUser] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/me`, { credentials: "include" });
      const data = await res.json();
      if (data.isLoggedIn) {
        setUser({ username: data.username });
        setView("home");
        fetchNotes();
      }
    } catch (err) {
      console.error("서버 연결 실패");
    } finally {
      setLoading(false);
    }
  };

  const fetchNotes = async () => {
    try {
      const res = await fetch(`${API_URL}/api/notes`, {
        credentials: "include",
      });
      if (res.ok) setNotes(await res.json());
    } catch (err) {
      console.error("노트 불러오기 실패");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/logout`, {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
      setNotes([]);
      setView("login");
      showToast("로그아웃되었습니다.");
    } catch (err) {
      showToast("로그아웃 실패", "error");
    }
  };

  if (loading)
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="mt-4 font-bold text-slate-400 uppercase tracking-widest text-sm">
          Vault Connecting...
        </p>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100">
      {/* 토스트 메시지 UI */}
      {toast && (
        <div
          className={`fixed bottom-10 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl px-6 py-4 shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-4
          ${toast.type === "success" ? "bg-slate-900 text-white" : "bg-red-500 text-white"}`}
        >
          {toast.type === "success" ? (
            <CheckCircle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span className="text-sm font-bold">{toast.message}</span>
          <button onClick={hideToast} className="ml-2 hover:opacity-70">
            <X size={14} />
          </button>
        </div>
      )}

      {view === "login" && (
        <LoginPage
          setView={setView}
          setUser={setUser}
          fetchNotes={fetchNotes}
          showToast={showToast}
        />
      )}
      {view === "signup" && (
        <SignupPage setView={setView} showToast={showToast} />
      )}
      {view === "home" && (
        <HomePage
          user={user}
          notes={notes}
          setNotes={setNotes}
          handleLogout={handleLogout}
          showToast={showToast}
        />
      )}
    </div>
  );
};

// --- 서브 컴포넌트: 로그인 페이지 ---
const LoginPage = ({ setView, setUser, fetchNotes, showToast }) => {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");

  const onLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: id, password: pw }),
      });
      if (res.ok) {
        setUser({ username: id });
        setView("home");
        fetchNotes();
        showToast(`${id}님, 환영합니다!`);
      } else {
        showToast("아이디 또는 비밀번호를 확인하세요.", "error");
      }
    } catch (err) {
      showToast("서버와 통신할 수 없습니다.", "error");
    }
  };

  return (
    <div className="flex h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[2.5rem] bg-white p-10 shadow-2xl ring-1 ring-slate-100">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Lock size={32} />
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter text-slate-800">
            VAULT
          </h1>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Encrypted Journal
          </p>
        </div>
        <form onSubmit={onLogin} className="space-y-4">
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
              size={18}
            />
            <input
              type="text"
              className="w-full rounded-2xl bg-slate-50 p-4 pl-12 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="ID"
              value={id}
              onChange={(e) => setId(e.target.value)}
              required
            />
          </div>
          <div className="relative">
            <Lock
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
              size={18}
            />
            <input
              type="password"
              className="w-full rounded-2xl bg-slate-50 p-4 pl-12 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="Password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
            />
          </div>
          <button className="w-full rounded-2xl bg-blue-600 py-4 font-bold text-white shadow-lg shadow-blue-100 transition-all hover:bg-blue-700 active:scale-[0.98]">
            Unlock Vault
          </button>
        </form>
        <button
          onClick={() => setView("signup")}
          className="mt-8 w-full text-center text-sm font-bold text-slate-300 hover:text-blue-500 transition-colors"
        >
          새로운 계정 만들기
        </button>
      </div>
    </div>
  );
};

// --- 서브 컴포넌트: 회원가입 페이지 ---
const SignupPage = ({ setView, showToast }) => {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");

  const onSignup = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: id, password: pw }),
      });
      if (res.ok) {
        showToast("회원가입 성공! 로그인을 진행하세요.");
        setView("login");
      } else {
        const data = await res.json();
        showToast(data.message || "가입 실패", "error");
      }
    } catch (err) {
      showToast("서버 연결 실패", "error");
    }
  };

  return (
    <div className="flex h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[2.5rem] bg-white p-10 shadow-2xl ring-1 ring-slate-100">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Plus size={32} />
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter text-slate-800">
            JOIN
          </h1>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Create Private ID
          </p>
        </div>
        <form onSubmit={onSignup} className="space-y-4">
          <input
            type="text"
            className="w-full rounded-2xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="New ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded-2xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="New Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
          />
          <button className="w-full rounded-2xl bg-slate-900 py-4 font-bold text-white shadow-lg transition-all hover:bg-black active:scale-[0.98]">
            Create Account
          </button>
        </form>
        <button
          onClick={() => setView("login")}
          className="mt-8 w-full text-center text-sm font-bold text-slate-300 hover:text-slate-500 transition-colors"
        >
          이미 계정이 있나요?
        </button>
      </div>
    </div>
  );
};

// --- 서브 컴포넌트: 홈 페이지 ---
const HomePage = ({ user, notes, setNotes, handleLogout, showToast }) => {
  const [newNote, setNewNote] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const addNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() && !image) return;

    const formData = new FormData();
    formData.append("content", newNote);
    if (image) formData.append("image", image);

    try {
      const res = await fetch(`${API_URL}/api/notes`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (res.ok) {
        const saved = await res.json();
        setNotes([saved, ...notes]);
        setNewNote("");
        setImage(null);
        setPreview(null);
        showToast("비밀이 안전하게 저장되었습니다.");
      } else {
        showToast("저장에 실패했습니다.", "error");
      }
    } catch (err) {
      showToast("서버 연결 실패", "error");
    }
  };

  const deleteNote = async (id) => {
    if (!window.confirm("이 기록을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`${API_URL}/api/notes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setNotes(notes.filter((n) => n.id !== id));
        showToast("기록이 삭제되었습니다.");
      }
    } catch (err) {
      showToast("삭제 실패", "error");
    }
  };

  // 검색 필터링 최적화
  const filteredNotes = useMemo(
    () =>
      notes.filter((n) =>
        n.content.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [notes, searchTerm],
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-16 flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter text-slate-900">
            {user?.username}'s Vault.
          </h1>
          <p className="mt-1 font-medium text-slate-400">
            오직 당신만 읽을 수 있는 {notes.length}개의 기록들
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-300 hover:text-red-400 transition-colors"
        >
          <LogOut size={14} /> Logout
        </button>
      </header>

      {/* 기록 입력 섹션 */}
      <form onSubmit={addNote} className="mb-12">
        <div className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:shadow-xl transition-all">
          <textarea
            className="w-full resize-none border-none bg-transparent p-8 text-xl outline-none placeholder:text-slate-300"
            rows="3"
            placeholder="오늘의 비밀을 기록하세요..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />

          {preview && (
            <div className="flex items-center gap-4 px-8 pb-6">
              <img
                src={preview}
                alt="preview"
                className="h-24 w-24 rounded-2xl object-cover shadow-lg ring-4 ring-slate-50"
              />
              <button
                type="button"
                onClick={() => {
                  setImage(null);
                  setPreview(null);
                }}
                className="text-xs font-bold text-red-400 hover:underline"
              >
                사진 제거
              </button>
            </div>
          )}

          <div className="flex items-center justify-between bg-slate-50/50 p-4 px-8 border-t border-slate-100">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-slate-400 hover:bg-slate-100 transition-colors">
              <ImageIcon size={18} />
              <span>사진 추가</span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleImageChange}
              />
            </label>
            <button className="flex items-center gap-2 rounded-2xl bg-slate-900 px-8 py-3 font-bold text-white shadow-lg transition-all hover:bg-black active:scale-95">
              <Plus size={18} /> Save Secret
            </button>
          </div>
        </div>
      </form>

      {/* 검색 바 */}
      <div className="mb-10 relative">
        <input
          type="text"
          placeholder="기록 검색..."
          className="w-full rounded-2xl border-none bg-white px-6 py-4 pl-14 shadow-sm outline-none ring-blue-500 focus:ring-2 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Search
          className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300"
          size={20}
        />
      </div>

      {/* 기록 리스트 */}
      <div className="space-y-8">
        {filteredNotes.map((note) => (
          <div
            key={note.id}
            className="group relative rounded-[2.5rem] bg-white p-10 shadow-sm transition-all hover:shadow-xl hover:ring-1 hover:ring-slate-100"
          >
            {note.image_url && (
              <div className="mb-8 overflow-hidden rounded-3xl">
                <img
                  src={`${API_URL}${note.image_url}`}
                  alt="note"
                  className="max-h-[30rem] w-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
            )}
            <p className="text-2xl font-medium leading-relaxed text-slate-700">
              {note.content}
            </p>
            <div className="mt-8 flex items-center justify-between border-t border-slate-50 pt-6">
              <time className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                {note.date}
              </time>
              <div className="flex items-center gap-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => deleteNote(note.id)}
                  className="flex items-center gap-1 text-xs font-bold text-red-200 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredNotes.length === 0 && (
          <div className="py-32 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-300">
              <Search size={32} />
            </div>
            <p className="font-bold text-slate-300 uppercase tracking-widest">
              No Secrets Found
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
