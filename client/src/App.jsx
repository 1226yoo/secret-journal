import React, { useState, useEffect, useMemo } from "react";
import { create } from "zustand";
import {
  Lock,
  Search,
  Plus,
  Image as ImageIcon,
  Trash2,
  LogOut,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  TriangleAlert,
  FileText,
} from "lucide-react";

/**
 * [OPTIMIZED ULTIMATE VERSION]
 * 1. Performance: Zustand Selector 패턴 적용 (불필요한 리렌더링 방지)
 * 2. Stability: import.meta 안전 접근 로직 유지
 * 3. UX: 스켈레톤 UI 및 검색어 하이라이팅 기능 포함
 */

// --- API URL 설정 (환경 변수 안전 접근) ---
const getApiUrl = () => {
  let url = "http://localhost:5000";
  try {
    const metaEnv = typeof import.meta !== "undefined" ? import.meta.env : null;
    if (metaEnv && metaEnv.VITE_API_URL) {
      url = metaEnv.VITE_API_URL;
    }
  } catch (e) {
    console.warn("환경 변수 로드 중 경고가 발생했습니다.");
  }
  return url.replace(/\/$/, "");
};

const API_URL = getApiUrl();

// --- [Zustand Store] 중앙 데이터 창고 ---
const useStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  toast: null,
  showToast: (message, type = "success") => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 3000);
  },
  hideToast: () => set({ toast: null }),
  modal: null,
  openModal: (config) => set({ modal: config }),
  closeModal: () => set({ modal: null }),
}));

// --- [Helper Component] 검색어 하이라이트 ---
const HighlightText = ({ text, highlight }) => {
  if (!highlight.trim()) return <span>{text}</span>;
  const regex = new RegExp(`(${highlight})`, "gi");
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-yellow-200 text-slate-900 rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
};

// --- [Reusable UI Components] ---

const SkeletonNote = () => (
  <div className="rounded-[2.5rem] bg-white p-10 shadow-sm animate-pulse">
    <div className="mb-6 h-48 w-full rounded-3xl bg-slate-100" />
    <div className="space-y-3">
      <div className="h-6 w-3/4 rounded-lg bg-slate-100" />
      <div className="h-6 w-1/2 rounded-lg bg-slate-100" />
    </div>
    <div className="mt-8 flex justify-between border-t border-slate-50 pt-6">
      <div className="h-3 w-20 rounded-lg bg-slate-50" />
      <div className="h-3 w-10 rounded-lg bg-slate-50" />
    </div>
  </div>
);

const Toast = () => {
  // Selector 패턴 적용: toast와 hideToast만 구독
  const toast = useStore((state) => state.toast);
  const hideToast = useStore((state) => state.hideToast);

  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-10 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-2xl px-6 py-4 shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-4
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
  );
};

const Modal = () => {
  // Selector 패턴 적용: modal과 closeModal만 구독
  const modal = useStore((state) => state.modal);
  const closeModal = useStore((state) => state.closeModal);

  if (!modal) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-[2rem] bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <TriangleAlert size={28} />
        </div>
        <h2 className="mb-2 text-xl font-black text-slate-800">
          {modal.title}
        </h2>
        <p className="mb-8 text-slate-500 leading-relaxed text-sm">
          {modal.message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={closeModal}
            className="flex-1 rounded-2xl bg-slate-100 py-4 font-bold text-slate-400 hover:bg-slate-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => {
              modal.onConfirm();
              closeModal();
            }}
            className="flex-1 rounded-2xl bg-red-500 py-4 font-bold text-white shadow-lg shadow-red-100 hover:bg-red-600 transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

// --- [Main Application] ---

const App = () => {
  const [view, setView] = useState("login");
  const [notes, setNotes] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isNotesLoading, setIsNotesLoading] = useState(false);

  // Selector 패턴 적용
  const setUser = useStore((state) => state.setUser);

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/me`, {
          credentials: "include",
        });
        const data = await res.json();
        if (data.isLoggedIn) {
          setUser({ username: data.username });
          setView("home");
          fetchNotes();
        }
      } catch (err) {
        console.error("인증 확인 실패");
      } finally {
        setIsInitialLoading(false);
      }
    };
    checkLoginStatus();
  }, [setUser]);

  const fetchNotes = async () => {
    setIsNotesLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/notes`, {
        credentials: "include",
      });
      if (res.ok) setNotes(await res.json());
    } catch (err) {
    } finally {
      setIsNotesLoading(false);
    }
  };

  if (isInitialLoading)
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="mt-4 font-bold text-slate-400 uppercase tracking-widest text-xs">
          Authenticating...
        </p>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-blue-100 font-sans">
      <Toast />
      <Modal />
      {view === "login" && (
        <LoginPage setView={setView} fetchNotes={fetchNotes} />
      )}
      {view === "signup" && <SignupPage setView={setView} />}
      {view === "home" && (
        <HomePage
          notes={notes}
          setNotes={setNotes}
          setView={setView}
          isNotesLoading={isNotesLoading}
        />
      )}
    </div>
  );
};

// --- [Pages] ---

const LoginPage = ({ setView, fetchNotes }) => {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");

  // Selector 패턴 적용
  const setUser = useStore((state) => state.setUser);
  const showToast = useStore((state) => state.showToast);

  const handleLogin = async (e) => {
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
        showToast(`${id}님, 환영합니다.`);
      } else showToast("아이디 또는 비밀번호를 확인하세요.", "error");
    } catch (err) {
      showToast("서버 연결 실패", "error");
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
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="text"
            className="w-full rounded-2xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded-2xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
          />
          <button className="w-full rounded-2xl bg-blue-600 py-4 font-bold text-white shadow-lg active:scale-95 transition-all">
            Unlock
          </button>
        </form>
        <button
          onClick={() => setView("signup")}
          className="mt-8 w-full text-center text-sm font-bold text-slate-300 hover:text-blue-500 transition-colors"
        >
          새로운 계정 생성
        </button>
      </div>
    </div>
  );
};

const SignupPage = ({ setView }) => {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");

  // Selector 패턴 적용
  const showToast = useStore((state) => state.showToast);

  const handleSignup = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: id, password: pw }),
    });
    if (res.ok) {
      showToast("가입 완료! 로그인을 진행하세요.");
      setView("login");
    } else showToast("이미 존재하는 아이디입니다.", "error");
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
        </div>
        <form onSubmit={handleSignup} className="space-y-4">
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
          <button className="w-full rounded-2xl bg-slate-900 py-4 font-bold text-white active:scale-95 transition-all">
            Create Account
          </button>
        </form>
        <button
          onClick={() => setView("login")}
          className="mt-8 w-full text-center text-sm font-bold text-slate-300 hover:text-slate-500 transition-colors"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
};

const HomePage = ({ notes, setNotes, setView, isNotesLoading }) => {
  const [newNote, setNewNote] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Selector 패턴 적용
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);
  const showToast = useStore((state) => state.showToast);
  const openModal = useStore((state) => state.openModal);

  const handleLogout = async () => {
    await fetch(`${API_URL}/api/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    setNotes([]);
    setView("login");
    showToast("로그아웃 되었습니다.");
  };

  const addNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() && !image) return;
    const formData = new FormData();
    formData.append("content", newNote);
    if (image) formData.append("image", image);
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
      showToast("기록이 보관함에 저장되었습니다.");
    }
  };

  const deleteNote = (id) => {
    openModal({
      title: "기록 삭제",
      message: "이 비밀 기록을 영구히 삭제하시겠습니까?",
      onConfirm: async () => {
        const res = await fetch(`${API_URL}/api/notes/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (res.ok) {
          setNotes(notes.filter((n) => n.id !== id));
          showToast("기록이 삭제되었습니다.");
        }
      },
    });
  };

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
            당신만의 소중한 기록 {notes.length}개를 보관 중입니다.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-300 hover:text-red-400 transition-colors"
        >
          <LogOut size={14} /> Logout
        </button>
      </header>

      {/* Write Section */}
      <form onSubmit={addNote} className="mb-12">
        <div className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:shadow-xl transition-all">
          <textarea
            className="w-full resize-none border-none bg-transparent p-8 text-xl outline-none placeholder:text-slate-300"
            rows="3"
            placeholder="기밀 사항을 입력하세요..."
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
                className="text-xs font-bold text-red-400"
              >
                삭제
              </button>
            </div>
          )}
          <div className="flex items-center justify-between bg-slate-50/50 p-4 px-8 border-t border-slate-100">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-slate-400 hover:bg-slate-100 transition-colors">
              <ImageIcon size={18} />
              <span>이미지</span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setImage(file);
                    setPreview(URL.createObjectURL(file));
                  }
                }}
              />
            </label>
            <button className="flex items-center gap-2 rounded-2xl bg-slate-900 px-8 py-3 font-bold text-white shadow-lg active:scale-95 transition-all">
              <Plus size={18} /> Save Secret
            </button>
          </div>
        </div>
      </form>

      {/* Search Bar */}
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

      {/* List */}
      <div className="space-y-8">
        {isNotesLoading ? (
          <>
            <SkeletonNote />
            <SkeletonNote />
          </>
        ) : (
          filteredNotes.map((note) => (
            <div
              key={note.id}
              className="group relative rounded-[2.5rem] bg-white p-10 shadow-sm transition-all hover:shadow-xl hover:ring-1 hover:ring-slate-100 animate-in fade-in duration-500"
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
                <HighlightText text={note.content} highlight={searchTerm} />
              </p>
              <div className="mt-8 flex items-center justify-between border-t border-slate-50 pt-6">
                <time className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                  {note.date}
                </time>
                <button
                  onClick={() => deleteNote(note.id)}
                  className="flex items-center gap-1 text-xs font-bold text-red-200 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))
        )}
        {filteredNotes.length === 0 && !isNotesLoading && (
          <div className="py-32 text-center">
            <FileText className="mx-auto mb-4 text-slate-100" size={64} />
            <p className="font-bold text-slate-200 uppercase tracking-widest">
              일치하는 기록이 없습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
