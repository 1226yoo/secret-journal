import React, { useState, useEffect, useMemo } from "react";
import { create } from "zustand";
import {
  Lock,
  Search,
  Plus,
  Image as ImageIcon,
  Trash2,
  Edit3,
  LogOut,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  TriangleAlert,
  FileText,
  Moon,
  Sun,
  Download,
  ChevronDown,
  RefreshCcw,
} from "lucide-react";

/**
 * [STEP 4-2: ERROR HANDLING MASTER VERSION]
 * 1. Centralized Error: Zustand store에서 모든 비동기 에러를 통합 관리
 * 2. Robust UI: 에러 발생 시 '다시 시도' 버튼이 포함된 전용 에러 화면 표시
 * 3. Double Validation: 클라이언트와 서버 양측에서 데이터 무결성 검증
 * 4. UX Integrity: 페이지네이션, 디바운싱, 다크모드 등 기존 기능 완벽 유지
 */

// --- API URL 설정 (환경 변수 안전 접근) ---
const getApiUrl = () => {
  let url = "http://localhost:5000";
  try {
    const metaEnv = typeof import.meta !== "undefined" ? import.meta.env : null;
    if (metaEnv && metaEnv.VITE_API_URL) url = metaEnv.VITE_API_URL;
  } catch (e) {}
  return url.replace(/\/$/, "");
};
const API_URL = getApiUrl();

// --- [Zustand Store] 중앙 데이터 및 에러 관리 창고 ---
const useStore = create((set, get) => ({
  user: null,
  notes: [],
  isNotesLoading: false,
  isDarkMode: false,
  hasMore: true,
  toast: null,
  modal: null,
  error: null, // [중앙] 에러 상태

  // -- Actions --
  setUser: (user) => set({ user }),
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
  setError: (msg) => set({ error: msg }), // 에러 수동 설정 액션

  // 데이터 로드 (에러 처리 강화)
  fetchNotes: async (isMore = false) => {
    const { notes, hasMore } = get();
    if (isMore && !hasMore) return;

    set({ isNotesLoading: true, error: null }); // 요청 시작 시 이전 에러 초기화
    try {
      const offset = isMore ? notes.length : 0;
      const res = await fetch(`${API_URL}/api/notes?offset=${offset}&limit=5`, {
        credentials: "include",
      });

      if (!res.ok) {
        // 서버에서 보낸 에러 메시지 추출
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message || "서버에서 데이터를 가져오는데 실패했습니다.",
        );
      }

      const newData = await res.json();
      set((state) => ({
        notes: isMore ? [...state.notes, ...newData] : newData,
        hasMore: newData.length === 5,
      }));
    } catch (err) {
      set({ error: err.message }); // 발생한 에러를 중앙 상태에 저장
    } finally {
      set({ isNotesLoading: false });
    }
  },

  // 기록 추가 (에러 피드백 강화)
  addNote: async (content, imageFile) => {
    if (!content.trim() && !imageFile) {
      get().showToast("내용을 입력해주세요.", "error");
      return false;
    }

    try {
      const formData = new FormData();
      formData.append("content", content);
      if (imageFile) formData.append("image", imageFile);

      const res = await fetch(`${API_URL}/api/notes`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "저장 중 문제가 발생했습니다.");
      }

      const saved = await res.json();
      set((state) => ({ notes: [saved, ...state.notes] }));
      get().showToast("비밀이 금고에 안전하게 기록되었습니다.");
      return true;
    } catch (err) {
      get().showToast(err.message, "error"); // 사용자에게 즉각적인 실패 알림
      return false;
    }
  },

  updateNote: async (id, newContent) => {
    if (!newContent.trim()) return false;
    try {
      const res = await fetch(`${API_URL}/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: newContent }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "수정에 실패했습니다.");
      }

      set((state) => ({
        notes: state.notes.map((n) =>
          n.id === id ? { ...n, content: newContent } : n,
        ),
      }));
      get().showToast("수정 완료.");
      return true;
    } catch (err) {
      get().showToast(err.message, "error");
      return false;
    }
  },

  deleteNote: async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/notes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("삭제 작업 중 서버 오류가 발생했습니다.");

      set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
      get().showToast("비밀이 완전히 소멸되었습니다.");
    } catch (err) {
      get().showToast(err.message, "error");
    }
  },

  // -- UI 알림 액션 --
  showToast: (message, type = "success") => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 3000);
  },
  hideToast: () => set({ toast: null }),
  openModal: (config) => set({ modal: config }),
  closeModal: () => set({ modal: null }),
}));

// --- [UI Helpers] ---

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
            className="bg-blue-500/30 text-inherit rounded-sm px-0.5"
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

const SkeletonNote = () => (
  <div className="rounded-[2.5rem] bg-white dark:bg-slate-800 p-8 shadow-sm animate-pulse">
    <div className="mb-6 h-44 w-full rounded-3xl bg-slate-100 dark:bg-slate-700" />
    <div className="space-y-3">
      <div className="h-6 w-3/4 rounded-lg bg-slate-100 dark:bg-slate-700" />
      <div className="h-6 w-1/2 rounded-lg bg-slate-100 dark:bg-slate-700" />
    </div>
  </div>
);

const Toast = () => {
  const toast = useStore((s) => s.toast);
  const hideToast = useStore((s) => s.hideToast);
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-10 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-2xl px-6 py-4 shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-4 ${toast.type === "success" ? "bg-slate-900 dark:bg-blue-600 text-white" : "bg-red-500 text-white"}`}
    >
      {toast.type === "success" ? (
        <CheckCircle size={18} />
      ) : (
        <AlertCircle size={18} />
      )}
      <span className="text-sm font-bold">{toast.message}</span>
      <button
        onClick={hideToast}
        className="ml-2 hover:opacity-70 transition-opacity"
      >
        <X size={14} />
      </button>
    </div>
  );
};

const Modal = () => {
  const modal = useStore((s) => s.modal);
  const closeModal = useStore((s) => s.closeModal);
  if (!modal) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-[2rem] bg-white dark:bg-slate-800 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500">
          <TriangleAlert size={28} />
        </div>
        <h2 className="mb-2 text-xl font-black text-slate-800 dark:text-white">
          {modal.title}
        </h2>
        <p className="mb-8 text-slate-500 dark:text-slate-400 leading-relaxed text-sm">
          {modal.message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={closeModal}
            className="flex-1 rounded-2xl bg-slate-100 dark:bg-slate-700 py-4 font-bold text-slate-400 dark:text-slate-300"
          >
            취소
          </button>
          <button
            onClick={() => {
              modal.onConfirm();
              closeModal();
            }}
            className="flex-1 rounded-2xl bg-red-500 py-4 font-bold text-white shadow-lg active:scale-95 transition-transform"
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
  const [initialLoading, setInitialLoading] = useState(true);

  const setUser = useStore((s) => s.setUser);
  const fetchNotes = useStore((s) => s.fetchNotes);
  const isDarkMode = useStore((s) => s.isDarkMode);

  useEffect(() => {
    const checkAuth = async () => {
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
      } catch (e) {
      } finally {
        setInitialLoading(false);
      }
    };
    checkAuth();
  }, [setUser, fetchNotes]);

  if (initialLoading)
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white dark:bg-slate-900 transition-colors">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="mt-4 font-bold text-slate-300 uppercase tracking-widest text-[10px]">
          Verifying Credentials...
        </p>
      </div>
    );

  return (
    <div
      className={`${isDarkMode ? "dark bg-slate-900" : "bg-slate-50"} min-h-screen font-sans selection:bg-blue-500 transition-colors duration-300`}
    >
      <div className="text-slate-900 dark:text-white">
        <Toast />
        <Modal />
        {view === "login" && <LoginPage setView={setView} />}
        {view === "signup" && <SignupPage setView={setView} />}
        {view === "home" && <HomePage setView={setView} />}
      </div>
    </div>
  );
};

// --- [Pages] ---

const LoginPage = ({ setView }) => {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const { setUser, fetchNotes, showToast, isDarkMode, toggleDarkMode } =
    useStore();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: id, password: pw }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser({ username: id });
        setView("home");
        fetchNotes();
        showToast(`${id}님, 접속을 환영합니다.`);
      } else {
        showToast(
          data.message || "아이디 또는 비밀번호가 틀렸습니다.",
          "error",
        );
      }
    } catch (err) {
      showToast(
        "서버와 연결할 수 없습니다. 네트워크 상태를 확인하세요.",
        "error",
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[2.5rem] bg-white dark:bg-slate-800 p-10 shadow-2xl relative animate-in fade-in zoom-in duration-300">
        <button
          onClick={toggleDarkMode}
          className="absolute right-8 top-8 text-slate-200 hover:text-blue-500 transition-colors p-2"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600">
          <Lock size={32} />
        </div>
        <h1 className="text-3xl font-black italic tracking-tighter mb-10 text-center">
          VAULT
        </h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="text"
            className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900 p-4 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all placeholder:text-slate-300"
            placeholder="ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900 p-4 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all placeholder:text-slate-300"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
          />
          <button className="w-full rounded-2xl bg-blue-600 py-4 font-bold text-white shadow-lg active:scale-95 transition-all shadow-blue-200 dark:shadow-none">
            Unlock Vault
          </button>
        </form>
        <button
          onClick={() => setView("signup")}
          className="mt-8 text-sm font-bold text-slate-300 hover:text-blue-500 w-full text-center"
        >
          신규 금고 생성하기
        </button>
      </div>
    </div>
  );
};

const SignupPage = ({ setView }) => {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const showToast = useStore((s) => s.showToast);

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: id, password: pw }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("가입 성공! 이제 로그인하세요.");
        setView("login");
      } else {
        showToast(data.message || "가입 중 오류가 발생했습니다.", "error");
      }
    } catch (err) {
      showToast("서버 연결 실패", "error");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[2.5rem] bg-white dark:bg-slate-800 p-10 shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <Plus size={32} />
        </div>
        <h1 className="text-3xl font-black italic tracking-tighter mb-10 text-center uppercase tracking-widest">
          Register
        </h1>
        <form onSubmit={handleSignup} className="space-y-4">
          <input
            type="text"
            className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900 p-4 outline-none dark:text-white placeholder:text-slate-300"
            placeholder="New ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900 p-4 outline-none dark:text-white placeholder:text-slate-300"
            placeholder="New Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
          />
          <button className="w-full rounded-2xl bg-slate-900 dark:bg-blue-600 py-4 font-bold text-white active:scale-95 transition-all">
            Create Account
          </button>
        </form>
        <button
          onClick={() => setView("login")}
          className="mt-8 text-sm font-bold text-slate-300 w-full text-center hover:text-slate-500"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
};

const HomePage = ({ setView }) => {
  // --- Local UI States ---
  const [newContent, setNewContent] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [displaySearch, setDisplaySearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");

  // --- Store Selectors ---
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const notes = useStore((s) => s.notes);
  const isNotesLoading = useStore((s) => s.isNotesLoading);
  const hasMore = useStore((s) => s.hasMore);
  const error = useStore((s) => s.error); // 전역 에러 상태
  const fetchNotes = useStore((s) => s.fetchNotes);
  const addNote = useStore((s) => s.addNote);
  const updateNote = useStore((s) => s.updateNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const openModal = useStore((s) => s.openModal);
  const showToast = useStore((s) => s.showToast);
  const isDarkMode = useStore((s) => s.isDarkMode);
  const toggleDarkMode = useStore((s) => s.toggleDarkMode);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(displaySearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [displaySearch]);

  const handleLogout = async () => {
    await fetch(`${API_URL}/api/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    setView("login");
    showToast("로그아웃 되었습니다.");
  };

  const exportData = () => {
    const dataStr = JSON.stringify(notes, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `my_vault_${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    showToast("백업 파일이 저장되었습니다.");
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    const success = await addNote(newContent, image);
    if (success) {
      setNewContent("");
      setImage(null);
      setPreview(null);
    }
  };

  const filteredNotes = useMemo(
    () =>
      notes.filter((n) =>
        n.content.toLowerCase().includes(debouncedSearch.toLowerCase()),
      ),
    [notes, debouncedSearch],
  );

  return (
    <div className="mx-auto max-w-2xl px-4 md:px-6 py-12 md:py-16">
      <header className="mb-12 flex items-start justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter text-slate-900 dark:text-white">
            {user?.username}'s Vault.
          </h1>
          <p className="mt-1 font-medium text-slate-400 text-sm">
            {notes.length}개의 비밀 조각들
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={exportData}
            title="Export Data"
            className="text-slate-300 hover:text-green-500 transition-colors p-2"
          >
            <Download size={20} />
          </button>
          <button
            onClick={toggleDarkMode}
            className="text-slate-300 hover:text-blue-500 transition-colors p-2"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={handleLogout}
            className="text-[10px] font-black uppercase border border-slate-200 dark:border-slate-700 rounded-full px-4 py-1.5 hover:text-red-400 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* 작성 섹션 (500자 제한) */}
      <form
        onSubmit={handleAddNote}
        className="mb-12 overflow-hidden rounded-[2rem] bg-white dark:bg-slate-800 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 focus-within:ring-2 focus-within:ring-blue-500 transition-all"
      >
        <textarea
          className="w-full resize-none border-none bg-transparent p-6 md:p-8 text-lg outline-none dark:text-white placeholder:text-slate-300"
          rows="3"
          placeholder="오늘의 기밀 사항은 무엇인가요?"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          maxLength={500}
        />
        <div className="px-8 text-[10px] text-slate-300 text-right font-mono pb-2">
          {newContent.length} / 500
        </div>

        {preview && (
          <div className="px-6 md:px-8 pb-5 flex items-center gap-4 animate-in fade-in">
            <img
              src={preview}
              className="h-20 w-20 rounded-2xl object-cover shadow-lg ring-2 ring-slate-100 dark:ring-slate-700"
            />
            <button
              type="button"
              onClick={() => {
                setImage(null);
                setPreview(null);
              }}
              className="text-xs font-bold text-red-400 hover:underline"
            >
              삭제
            </button>
          </div>
        )}

        <div className="flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 p-4 px-6 md:px-8 border-t border-slate-100 dark:border-slate-700">
          <label className="cursor-pointer text-slate-400 hover:text-blue-500 transition-colors p-1">
            <ImageIcon size={22} />
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files[0];
                if (f) {
                  setImage(f);
                  setPreview(URL.createObjectURL(f));
                }
              }}
            />
          </label>
          <button className="bg-slate-900 dark:bg-blue-600 text-white px-8 py-2.5 md:py-3 rounded-2xl font-bold active:scale-95 transition-all text-sm shadow-lg">
            Save Secret
          </button>
        </div>
      </form>

      {/* 검색 바 */}
      <div className="mb-10 relative group">
        <input
          type="text"
          placeholder="검색어를 입력하세요..."
          className="w-full rounded-2xl border-none bg-white dark:bg-slate-800 px-6 py-4 pl-14 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
          value={displaySearch}
          onChange={(e) => setDisplaySearch(e.target.value)}
        />
        <Search
          className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors"
          size={20}
        />
      </div>

      {/* [핵심] 에러 UI 및 리스트 섹션 */}
      <div className="space-y-6 md:space-y-8 pb-20">
        {error ? (
          // (A) 전역 에러 발생 시 보여줄 화면
          <div className="py-20 text-center space-y-4 animate-in fade-in">
            <div className="mx-auto w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-3xl flex items-center justify-center">
              <AlertCircle size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold dark:text-white">
                데이터 로드 실패
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {error}
              </p>
            </div>
            <button
              onClick={() => fetchNotes()}
              className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold flex items-center gap-2 mx-auto hover:bg-blue-700 transition-all active:scale-95"
            >
              <RefreshCcw size={18} /> 다시 시도
            </button>
          </div>
        ) : (
          <>
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className="group relative rounded-[2rem] md:rounded-[2.5rem] bg-white dark:bg-slate-800 p-8 shadow-sm hover:shadow-2xl transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-500"
              >
                {note.image_url && (
                  <div className="mb-6 md:mb-8 overflow-hidden rounded-3xl">
                    <img
                      src={`${API_URL}${note.image_url}`}
                      className="w-full max-h-[30rem] object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                )}

                {editingId === note.id ? (
                  <div className="space-y-4 animate-in zoom-in-95 duration-200">
                    <textarea
                      className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900 p-6 text-lg outline-none ring-2 ring-blue-500 dark:text-white"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      autoFocus
                      maxLength={500}
                    />
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-sm font-bold text-slate-400 p-1"
                      >
                        취소
                      </button>
                      <button
                        onClick={async () => {
                          if (await updateNote(note.id, editingText))
                            setEditingId(null);
                        }}
                        className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-blue-200 dark:shadow-none active:scale-95 transition-transform"
                      >
                        수정 완료
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xl md:text-2xl font-medium leading-relaxed text-slate-700 dark:text-slate-200">
                      <HighlightText
                        text={note.content}
                        highlight={debouncedSearch}
                      />
                    </p>
                    <div className="mt-6 md:mt-8 flex items-center justify-between border-t border-slate-50 dark:border-slate-700 pt-6">
                      <time className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                        {note.date}
                      </time>
                      <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingId(note.id);
                            setEditingText(note.content);
                          }}
                          className="text-blue-400 hover:text-blue-600 p-1"
                          title="수정"
                        >
                          <Edit3 size={20} />
                        </button>
                        <button
                          onClick={() =>
                            openModal({
                              title: "기록 삭제",
                              message:
                                "이 비밀 기록을 영구히 삭제할까요? 삭제 후에는 복구할 수 없습니다.",
                              onConfirm: () => deleteNote(note.id),
                            })
                          }
                          className="text-red-200 hover:text-red-500 p-1"
                          title="삭제"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}

            {isNotesLoading && (
              <>
                <SkeletonNote />
                <SkeletonNote />
              </>
            )}

            {!isNotesLoading && hasMore && notes.length >= 5 && (
              <button
                onClick={() => fetchNotes(true)}
                className="w-full py-4 rounded-[2rem] bg-white dark:bg-slate-800 text-slate-400 font-bold flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95 shadow-sm border border-slate-100 dark:border-slate-700"
              >
                <ChevronDown size={20} /> Load More Secrets
              </button>
            )}

            {filteredNotes.length === 0 && !isNotesLoading && (
              <div className="py-24 text-center">
                <FileText
                  className="mx-auto mb-4 text-slate-100 dark:text-slate-800"
                  size={64}
                />
                <p className="font-bold text-slate-200 dark:text-slate-700 tracking-widest uppercase">
                  일치하는 기록이 없습니다.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default App;
