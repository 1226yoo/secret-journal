import React, { useState, useEffect, useMemo } from "react";
// CDN을 통해 Supabase 라이브러리를 직접 불러와 호환성 문제를 해결합니다.
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { create } from "zustand";
import {
  Lock,
  Plus,
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  Moon,
  Sun,
  Image as ImageIcon,
  Trash2,
  Sparkles,
  Github,
  Edit3,
  ChevronDown,
  RefreshCcw,
} from "lucide-react";

/**
 * [STEP 6-Final: OAuth + Note Registration Integrated - Bug Fixed]
 * 1. Auth: Supabase OAuth 연동 및 최신 세션 토큰 강제 적용
 * 2. Feature: 이미지 압축 및 상세 에러 로깅 추가
 * 3. Security: 모든 API 요청에 Bearer JWT 토큰 포함 및 401 에러 대응
 */

// --- 환경 변수 안전 로더 ---
const getEnv = (key) => {
  try {
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
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const getApiUrl = () => {
  let url = "http://localhost:10000";
  const envUrl = getEnv("VITE_API_URL");
  if (envUrl) url = envUrl;
  return url.replace(/\/$/, "");
};
const API_URL = getApiUrl();

// --- [Utility] 이미지 압축 (Canvas 이용) ---
const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 1200;
        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.85,
        );
      };
    };
  });
};

// --- [Zustand Store] ---
const useStore = create((set, get) => ({
  user: null,
  notes: [],
  isNotesLoading: false,
  isUploading: false,
  isDarkMode: false,
  hasMore: true,
  toast: null,
  modal: null,
  error: null,

  setUser: (user) => set({ user }),
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),

  // 1. 메모 불러오기 (JWT 인증 포함)
  fetchNotes: async (isMore = false) => {
    const { notes, hasMore } = get();
    if (isMore && !hasMore) return;

    set({ isNotesLoading: true, error: null });
    try {
      // 항상 최신 세션에서 토큰을 가져옵니다.
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();
      if (authError || !session)
        throw new Error("인증 세션이 만료되었습니다. 다시 로그인해주세요.");

      const offset = isMore ? notes.length : 0;
      const res = await fetch(`${API_URL}/api/notes?offset=${offset}&limit=5`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `서버 응답 오류: ${res.status}`);
      }

      const newData = await res.json();
      set((state) => ({
        notes: isMore ? [...state.notes, ...newData] : newData,
        hasMore: newData.length === 5,
        error: null, // 성공 시 에러 초기화
      }));
    } catch (err) {
      console.error("Fetch Error:", err);
      set({ error: err.message });
    } finally {
      set({ isNotesLoading: false });
    }
  },

  // 2. 메모 등록 (이미지 압축 및 JWT 포함)
  addNote: async (content, imageFile) => {
    if (!content.trim() && !imageFile) return false;
    set({ isUploading: true });
    try {
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();
      if (authError || !session) throw new Error("인증이 필요합니다.");

      const formData = new FormData();
      formData.append("content", content);
      if (imageFile) {
        const compressed = await compressImage(imageFile);
        formData.append("image", compressed);
      }

      const res = await fetch(`${API_URL}/api/notes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `저장 실패: ${res.status}`);
      }

      const saved = await res.json();
      set((state) => ({ notes: [saved, ...state.notes], error: null }));
      get().showToast("비밀이 성공적으로 봉인되었습니다.");
      return true;
    } catch (err) {
      console.error("Add Note Error:", err);
      get().showToast(err.message, "error");
      return false;
    } finally {
      set({ isUploading: false });
    }
  },

  // 3. 메모 삭제 (본인 확인용 JWT 포함)
  deleteNote: async (id) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/notes/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("삭제 권한이 없거나 오류가 발생했습니다.");

      set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
      get().showToast("기록이 소멸되었습니다.");
    } catch (err) {
      get().showToast(err.message, "error");
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

// --- [UI Helpers] ---
const Toast = () => {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-10 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 ${toast.type === "success" ? "bg-slate-900 text-white dark:bg-blue-600" : "bg-red-500 text-white"}`}
    >
      <span className="text-sm font-bold">{toast.message}</span>
    </div>
  );
};

const Modal = () => {
  const modal = useStore((s) => s.modal);
  const closeModal = useStore((s) => s.closeModal);
  if (!modal) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-2xl">
        <h2 className="text-xl font-black mb-4">{modal.title}</h2>
        <div className="flex gap-3">
          <button
            onClick={closeModal}
            className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 rounded-2xl font-bold"
          >
            취소
          </button>
          <button
            onClick={() => {
              modal.onConfirm();
              closeModal();
            }}
            className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold"
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
  const handleOAuthLogin = (provider) => {
    supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
  };
  return (
    <div className="flex h-screen items-center justify-center px-4 bg-slate-50 dark:bg-slate-900 transition-colors">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] shadow-2xl relative">
        <button
          onClick={toggleDarkMode}
          className="absolute right-8 top-8 text-slate-200 hover:text-blue-500"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/20">
          <Lock size={32} />
        </div>
        <h1 className="text-3xl font-black italic tracking-tighter text-center mb-10">
          VAULT
        </h1>
        <div className="space-y-4">
          <button
            onClick={() => handleOAuthLogin("github")}
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-slate-900 text-white py-4 font-bold shadow-lg active:scale-95 transition-all"
          >
            <Github size={20} /> Continue with GitHub
          </button>
          <button
            onClick={() => handleOAuthLogin("google")}
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-white border border-slate-200 text-slate-700 py-4 font-bold shadow-md active:scale-95 transition-all"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" />{" "}
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
};

const HomePage = () => {
  const {
    user,
    isDarkMode,
    toggleDarkMode,
    notes,
    fetchNotes,
    addNote,
    deleteNote,
    openModal,
    isNotesLoading,
    isUploading,
    hasMore,
    error,
  } = useStore();
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isUploading) return;
    const ok = await addNote(content, image);
    if (ok) {
      setContent("");
      setImage(null);
      setPreview(null);
    }
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
            onClick={() => supabase.auth.signOut()}
            className="text-[10px] font-black uppercase border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-full hover:bg-red-50 hover:text-red-500 transition-all"
          >
            Logout
          </button>
        </div>
      </header>

      {/* 글 등록 폼 섹션 */}
      <form
        onSubmit={handleSubmit}
        className="mb-12 bg-white dark:bg-slate-800 rounded-[2rem] shadow-xl overflow-hidden ring-1 ring-slate-100 dark:ring-slate-700"
      >
        <textarea
          className="w-full resize-none border-none bg-transparent p-8 text-lg outline-none dark:text-white placeholder:text-slate-300"
          rows="3"
          placeholder="금고에 보관할 비밀을 적으세요..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        {preview && (
          <div className="px-8 pb-4 animate-in fade-in">
            <div className="relative w-24 h-24">
              <img
                src={preview}
                className="w-full h-full object-cover rounded-2xl shadow-md"
              />
              <button
                type="button"
                onClick={() => {
                  setImage(null);
                  setPreview(null);
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 p-6 border-t border-slate-100 dark:border-slate-700">
          <label className="cursor-pointer text-slate-400 hover:text-blue-500 transition-colors">
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
          <button
            disabled={isUploading}
            className="bg-slate-900 dark:bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isUploading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Plus size={18} />
            )}
            {isUploading ? "Sealing..." : "Save Secret"}
          </button>
        </div>
      </form>

      {/* 검색 및 리스트 */}
      <div className="mb-8 relative group">
        <input
          type="text"
          placeholder="Search records..."
          className="w-full rounded-2xl bg-white dark:bg-slate-800 px-6 py-4 pl-14 shadow-sm outline-none dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Search
          className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500"
          size={20}
        />
      </div>

      <div className="space-y-6">
        {/* 에러가 있는 경우에만 에러 컴포넌트 표시 */}
        {error ? (
          <div className="text-center py-12">
            <AlertCircle className="mx-auto text-red-500 mb-2" size={32} />
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => fetchNotes()}
              className="text-blue-500 font-bold flex items-center gap-2 mx-auto"
            >
              <RefreshCcw size={16} /> 다시 시도
            </button>
          </div>
        ) : (
          <>
            {/* 데이터가 없는 경우 (새 계정) */}
            {filteredNotes.length === 0 && !isNotesLoading ? (
              <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[3rem]">
                <p className="text-slate-300 font-bold uppercase tracking-widest text-xs">
                  아직 저장된 비밀이 없습니다
                </p>
              </div>
            ) : (
              filteredNotes.map((note) => (
                <div
                  key={note.id}
                  className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500"
                >
                  {note.image_url && (
                    <div className="mb-6 rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-900">
                      <img
                        src={`${API_URL}${note.image_url}`}
                        className="w-full max-h-96 object-cover"
                      />
                    </div>
                  )}
                  <p className="text-xl font-medium leading-relaxed mb-6">
                    {note.content}
                  </p>
                  <div className="flex justify-between items-center opacity-40">
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {note.date}
                    </span>
                    <button
                      onClick={() =>
                        openModal({
                          title: "Delete Record?",
                          onConfirm: () => deleteNote(note.id),
                        })
                      }
                      className="hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {isNotesLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        )}
        {hasMore && !isNotesLoading && filteredNotes.length >= 5 && (
          <button
            onClick={() => fetchNotes(true)}
            className="w-full py-4 rounded-[2rem] bg-white dark:bg-slate-800 text-slate-400 font-bold hover:bg-slate-50 transition-all shadow-sm"
          >
            <ChevronDown size={20} className="mx-auto" />
          </button>
        )}
      </div>
    </div>
  );
};

const App = () => {
  const { user, setUser, isDarkMode } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null),
    );
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
        <Toast /> <Modal />
        {!user ? <LoginPage /> : <HomePage />}
      </div>
    </div>
  );
};

export default App;
