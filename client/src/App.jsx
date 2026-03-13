import React, { useState, useEffect, useMemo } from "react";
// CDN을 통해 Supabase 라이브러리를 직접 불러와 빌드 오류를 해결합니다.
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { create } from "zustand";
import {
  Lock,
  LogOut,
  Plus,
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  TriangleAlert,
  Moon,
  Sun,
  Image as ImageIcon,
  Trash2,
  Sparkles,
  Github,
  Edit3,
  ChevronDown,
} from "lucide-react";

/**
 * [STEP 6: OAuth & Supabase Auth Integration - Environment Compatibility Fix]
 * 1. Compatibility Fix: import.meta 미지원 환경을 위한 안전한 환경 변수 접근 로직 적용
 * 2. Auth Flow: 소셜 로그인(GitHub/Google) 및 JWT 기반 세션 관리
 * 3. Security: 클라이언트 측 API 호출 시 Authorization 헤더 자동 포함
 */

// --- 안전한 환경 변수 로더 ---
const getEnv = (key) => {
  try {
    // import.meta가 지원되지 않는 환경을 위해 try-catch와 타입 체크를 병행합니다.
    if (
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env[key]
    ) {
      return import.meta.env[key];
    }
  } catch (e) {}
  return "";
};

const SUPABASE_URL = getEnv("VITE_SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY") || "";

// 설정이 비어있을 경우 개발자에게 경고를 표시합니다.
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "VAULT: Supabase 설정(URL/KEY)이 누락되었습니다. .env 파일을 확인하거나 하드코딩이 필요한지 검토하세요.",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const getApiUrl = () => {
  let url = "http://localhost:10000";
  const envUrl = getEnv("VITE_API_URL");
  if (envUrl) url = envUrl;
  return url.replace(/\/$/, "");
};
const API_URL = getApiUrl();

// --- [Zustand Store] ---
const useStore = create((set, get) => ({
  user: null,
  notes: [],
  isNotesLoading: false,
  isDarkMode: false,
  hasMore: true,
  toast: null,
  modal: null,
  error: null,

  setUser: (user) => set({ user }),
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),

  // JWT 인증 헤더를 포함한 노트 목록 가져오기
  fetchNotes: async (isMore = false) => {
    const { notes, hasMore } = get();
    if (isMore && !hasMore) return;

    set({ isNotesLoading: true, error: null });
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Authentication required.");

      const offset = isMore ? notes.length : 0;
      const res = await fetch(`${API_URL}/api/notes?offset=${offset}&limit=5`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) throw new Error("Failed to fetch records.");
      const newData = await res.json();

      set((state) => ({
        notes: isMore ? [...state.notes, ...newData] : newData,
        hasMore: newData.length === 5,
      }));
    } catch (err) {
      set({ error: err.message });
      console.error(err);
    } finally {
      set({ isNotesLoading: false });
    }
  },

  showToast: (message, type = "success") => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 3000);
  },
  hideToast: () => set({ toast: null }),
  openModal: (config) => set({ modal: config }),
  closeModal: () => set({ modal: null }),
}));

// --- [UI Components] ---
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
      <button onClick={hideToast} className="ml-2 hover:opacity-70">
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
      <div className="w-full max-w-sm rounded-[2rem] bg-white dark:bg-slate-800 p-8 shadow-2xl animate-in zoom-in-95">
        <h2 className="mb-2 text-xl font-black">{modal.title}</h2>
        <p className="mb-8 text-slate-500 text-sm">{modal.message}</p>
        <div className="flex gap-3">
          <button
            onClick={closeModal}
            className="flex-1 rounded-2xl bg-slate-100 dark:bg-slate-700 py-4 font-bold text-slate-400"
          >
            취소
          </button>
          <button
            onClick={() => {
              modal.onConfirm();
              closeModal();
            }}
            className="flex-1 rounded-2xl bg-red-500 py-4 font-bold text-white shadow-lg"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

// --- [Pages] ---
const LoginPage = () => {
  const { isDarkMode, toggleDarkMode } = useStore();

  const handleOAuthLogin = async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) alert(error.message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-slate-50 dark:bg-slate-900 transition-colors">
      <div className="w-full max-w-sm rounded-[2.5rem] bg-white dark:bg-slate-800 p-10 shadow-2xl relative animate-in zoom-in duration-300">
        <button
          onClick={toggleDarkMode}
          className="absolute right-8 top-8 text-slate-200 hover:text-blue-500"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600">
          <Lock size={32} />
        </div>
        <h1 className="text-3xl font-black italic tracking-tighter text-center mb-10">
          VAULT
        </h1>

        <div className="space-y-4">
          <button
            onClick={() => handleOAuthLogin("github")}
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-slate-900 text-white py-4 font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg"
          >
            <Github size={20} /> Continue with GitHub
          </button>

          <button
            onClick={() => handleOAuthLogin("google")}
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-white border border-slate-200 text-slate-700 py-4 font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-md"
          >
            <img
              src="https://www.google.com/favicon.ico"
              className="w-5 h-5"
              alt="google"
            />{" "}
            Continue with Google
          </button>
        </div>

        <p className="mt-8 text-center text-[10px] text-slate-400 font-black uppercase tracking-widest">
          Secure Authentication System
        </p>
      </div>
    </div>
  );
};

const HomePage = () => {
  const {
    user,
    isDarkMode,
    toggleDarkMode,
    showToast,
    notes,
    fetchNotes,
    isNotesLoading,
    hasMore,
  } = useStore();
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    showToast("Successfully logged out.");
  };

  const filteredNotes = useMemo(
    () =>
      notes.filter((n) =>
        n.content.toLowerCase().includes(search.toLowerCase()),
      ),
    [notes, search],
  );

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter flex items-center gap-2">
            VAULT <Sparkles className="text-blue-500" size={24} />
          </h1>
          <p className="text-slate-400 text-sm font-medium">{user?.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleDarkMode}
            className="p-2 text-slate-400 hover:text-blue-500"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={handleLogout}
            className="text-[10px] font-black uppercase border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-full hover:bg-red-50 hover:text-red-500 transition-all"
          >
            Logout
          </button>
        </div>
      </header>

      {/* 검색 바 */}
      <div className="mb-10 relative group">
        <input
          type="text"
          placeholder="Search records..."
          className="w-full rounded-2xl border-none bg-white dark:bg-slate-800 px-6 py-4 pl-14 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Search
          className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500"
          size={20}
        />
      </div>

      {/* 기록 리스트 */}
      <div className="space-y-6">
        {filteredNotes.length === 0 && !isNotesLoading ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[3rem]">
            <p className="text-slate-300 font-bold uppercase tracking-widest text-xs">
              No records found
            </p>
          </div>
        ) : (
          filteredNotes.map((note) => (
            <div
              key={note.id}
              className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm animate-in fade-in slide-in-from-bottom-2"
            >
              <p className="text-xl font-medium leading-relaxed">
                {note.content}
              </p>
              <div className="mt-6 flex justify-between items-center opacity-50">
                <span className="text-[10px] font-black">
                  {new Date(note.date).toLocaleString()}
                </span>
                <div className="flex gap-2">
                  <button className="p-1 hover:text-blue-500">
                    <Edit3 size={16} />
                  </button>
                  <button className="p-1 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}

        {isNotesLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        )}

        {hasMore && !isNotesLoading && filteredNotes.length > 0 && (
          <button
            onClick={() => fetchNotes(true)}
            className="w-full py-4 rounded-[2rem] bg-white dark:bg-slate-800 text-slate-400 font-bold flex items-center justify-center gap-2 hover:bg-slate-100 transition-all"
          >
            <ChevronDown size={20} /> Load More
          </button>
        )}
      </div>
    </div>
  );
};

// --- [Main Entry] ---
const App = () => {
  const { user, setUser, isDarkMode } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. 초기 세션 체크
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2. 인증 상태 리스너
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUser]);

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-slate-900">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );

  return (
    <div className={isDarkMode ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white transition-colors duration-300">
        <Toast />
        <Modal />
        {!user ? <LoginPage /> : <HomePage />}
      </div>
    </div>
  );
};

export default App;
