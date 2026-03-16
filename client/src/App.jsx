import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { create } from "zustand";
import {
  Lock,
  Search,
  Plus,
  Image as ImageIcon,
  Trash2,
  Edit3,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  FileText,
  Moon,
  Sun,
  ChevronDown,
  RefreshCcw,
  Sparkles,
  TriangleAlert,
  Github,
} from "lucide-react";

/**
 * [UX 및 보안 개선 버전]
 * 1. 테마(Dark/Light)를 로컬 스토리지에 저장하여 새로고침 시 유지
 * 2. Supabase Auth 스토리지 설정을 세션스토리지로 변경 (브라우저 종료 시 로그아웃 - 주석 처리됨)
 */

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

// [수정 포인트] 브라우저 종료 시 로그아웃되길 원한다면 아래 주석을 해제하고 교체하세요.
// const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: window.sessionStorage } });
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const getApiUrl = () => {
  let url = "http://localhost:10000";
  const envUrl = getEnv("VITE_API_URL");
  if (envUrl) url = envUrl;
  return url.replace(/\/$/, "");
};
const API_URL = getApiUrl();

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
          (blob) =>
            resolve(new File([blob], file.name, { type: "image/jpeg" })),
          "image/jpeg",
          0.85,
        );
      };
    };
  });
};

// --- [Zustand 스토어] ---
const useStore = create((set, get) => ({
  user: null,
  notes: [],
  isNotesLoading: false,
  isUploading: false,
  // [수정 포인트] 시작할 때 로컬 스토리지에서 이전 테마 설정을 불러옵니다.
  isDarkMode: localStorage.getItem("vault_theme") === "dark",
  hasMore: true,
  toast: null,
  modal: null,
  error: null,

  setUser: (user) => set({ user }),

  // [수정 포인트] 테마를 바꿀 때 로컬 스토리지에 저장합니다.
  toggleDarkMode: () =>
    set((state) => {
      const newTheme = !state.isDarkMode;
      localStorage.setItem("vault_theme", newTheme ? "dark" : "light");
      return { isDarkMode: newTheme };
    }),

  fetchNotes: async (isMore = false) => {
    const { notes, hasMore } = get();
    if (isMore && !hasMore) return;
    set({ isNotesLoading: true, error: null });
    try {
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();
      if (authError || !session)
        throw new Error("인증이 만료되었습니다. 다시 로그인해주세요.");

      const offset = isMore ? notes.length : 0;
      const res = await fetch(`${API_URL}/api/notes?offset=${offset}&limit=5`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("데이터 로드에 실패했습니다.");

      const newData = await res.json();
      set((state) => ({
        notes: isMore ? [...state.notes, ...newData] : newData,
        hasMore: newData.length === 5,
        error: null,
      }));
    } catch (err) {
      set({ error: err.message });
    } finally {
      set({ isNotesLoading: false });
    }
  },

  addNote: async (content, imageFile) => {
    if (!content.trim() && !imageFile) return false;
    set({ isUploading: true });
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
      if (!res.ok) throw new Error("저장에 실패했습니다.");
      const saved = await res.json();
      set((state) => ({ notes: [saved, ...state.notes], error: null }));
      get().showToast("비밀이 성공적으로 봉인되었습니다.");
      return true;
    } catch (err) {
      get().showToast(err.message, "error");
      return false;
    } finally {
      set({ isUploading: false });
    }
  },

  updateNote: async (id, newContent) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/notes/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content: newContent }),
      });
      if (res.ok) {
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, content: newContent } : n,
          ),
        }));
        get().showToast("기록이 수정되었습니다.");
        return true;
      }
    } catch (err) {}
    return false;
  },

  deleteNote: async (id) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/notes/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
        get().showToast("기록이 영구 소멸되었습니다.");
      }
    } catch (err) {
      get().showToast("삭제 실패", "error");
    }
  },

  showToast: (msg, type = "success") => {
    set({ toast: { message: msg, type } });
    setTimeout(() => set({ toast: null }), 3000);
  },
  hideToast: () => set({ toast: null }),
  openModal: (cfg) => set({ modal: cfg }),
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
  <div className="rounded-[2.5rem] bg-white dark:bg-slate-800 p-8 shadow-sm animate-pulse mb-6">
    <div className="mb-6 h-40 w-full rounded-3xl bg-slate-100 dark:bg-slate-700" />
    <div className="space-y-3">
      <div className="h-6 w-3/4 rounded-lg bg-slate-100 dark:bg-slate-700" />
      <div className="h-6 w-1/2 rounded-lg bg-slate-100 dark:bg-slate-700" />
    </div>
  </div>
);

const Toast = () => {
  const { toast, hideToast } = useStore();
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-10 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-2xl px-6 py-4 shadow-2xl animate-in fade-in slide-in-from-bottom-4 ${toast.type === "success" ? "bg-slate-900 dark:bg-blue-600 text-white" : "bg-red-500 text-white"}`}
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
  const { modal, closeModal } = useStore();
  if (!modal) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-[2rem] bg-white dark:bg-slate-800 p-8 shadow-2xl animate-in zoom-in-95">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500">
          <TriangleAlert size={28} />
        </div>
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
            className="flex-1 rounded-2xl bg-red-500 py-4 font-bold text-white"
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
  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-slate-50 dark:bg-slate-900 transition-colors">
      <div className="w-full max-w-sm rounded-[2.5rem] bg-white dark:bg-slate-800 p-10 shadow-2xl relative animate-in zoom-in duration-300">
        <button
          onClick={toggleDarkMode}
          className="absolute right-8 top-8 text-slate-300 hover:text-blue-500 transition-colors"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600">
          <Lock size={32} />
        </div>
        <h1 className="text-3xl font-black italic tracking-tighter text-center mb-10 text-slate-900 dark:text-white">
          VAULT
        </h1>
        <div className="space-y-4">
          <button
            onClick={() =>
              supabase.auth.signInWithOAuth({
                provider: "github",
                options: { redirectTo: window.location.origin },
              })
            }
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-slate-900 text-white py-4 font-bold active:scale-95 transition-all"
          >
            <Github size={20} /> Continue with GitHub
          </button>
          <button
            onClick={() =>
              supabase.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: window.location.origin },
              })
            }
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-white border border-slate-200 text-slate-700 py-4 font-bold active:scale-95 transition-all hover:bg-slate-50"
          >
            <img
              src="https://www.google.com/favicon.ico"
              className="w-5 h-5"
              alt="google"
            />{" "}
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
    updateNote,
    deleteNote,
    openModal,
    isNotesLoading,
    isUploading,
    hasMore,
    error,
  } = useStore();
  const [newContent, setNewContent] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [displaySearch, setDisplaySearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(displaySearch), 300);
    return () => clearTimeout(timer);
  }, [displaySearch]);
  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (isUploading) return;
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
    <div className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-12 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter flex items-center gap-2">
            VAULT <Sparkles className="text-blue-500" size={24} />
          </h1>
          <p className="mt-1 font-medium text-slate-400 text-sm">
            {user?.email}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleDarkMode}
            className="text-slate-400 p-2 hover:text-blue-500 transition-colors"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-[10px] font-black uppercase border border-slate-200 dark:border-slate-700 rounded-full px-4 py-1.5 hover:text-red-500 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <form
        onSubmit={handleAddNote}
        className="mb-12 overflow-hidden rounded-[2rem] bg-white dark:bg-slate-800 shadow-xl ring-1 ring-slate-100 dark:ring-slate-700"
      >
        <textarea
          className="w-full resize-none border-none bg-transparent p-8 text-lg outline-none dark:text-white placeholder:text-slate-300"
          rows="3"
          placeholder="비밀을 적으세요..."
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          maxLength={500}
        />
        <div
          className={`px-8 text-[10px] text-right font-mono pb-2 ${newContent.length >= 450 ? "text-red-500" : "text-slate-300"}`}
        >
          {newContent.length}/500
        </div>

        {preview && (
          <div className="px-8 pb-5 flex items-center gap-4 animate-in fade-in">
            <div className="relative group">
              <img
                src={preview}
                className="h-24 w-24 rounded-2xl object-cover shadow-lg"
              />
              <button
                type="button"
                onClick={() => {
                  setImage(null);
                  setPreview(null);
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
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
            className="bg-slate-900 dark:bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold active:scale-95 flex items-center gap-2 disabled:opacity-50 transition-all"
          >
            {isUploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}{" "}
            Save
          </button>
        </div>
      </form>

      <div className="mb-10 relative group">
        <input
          type="text"
          placeholder="검색..."
          className="w-full rounded-2xl bg-white dark:bg-slate-800 px-6 py-4 pl-14 shadow-sm outline-none dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
          value={displaySearch}
          onChange={(e) => setDisplaySearch(e.target.value)}
        />
        <Search
          className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors"
          size={20}
        />
      </div>

      <div className="space-y-6 pb-20">
        {error ? (
          <div className="py-20 text-center">
            <AlertCircle size={40} className="mx-auto text-red-500 mb-4" />
            <p className="text-slate-500 text-sm">{error}</p>
            <button
              onClick={() => fetchNotes()}
              className="text-blue-500 font-bold flex items-center gap-2 mx-auto mt-4 hover:underline"
            >
              <RefreshCcw size={16} /> Retry
            </button>
          </div>
        ) : (
          <>
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className="group relative rounded-[2.5rem] bg-white dark:bg-slate-800 p-8 shadow-sm hover:shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-2 duration-500"
              >
                {note.image_url && (
                  <div className="mb-8 overflow-hidden rounded-3xl bg-slate-50 dark:bg-slate-900">
                    <img
                      src={
                        note.image_url.startsWith("http")
                          ? note.image_url
                          : `${API_URL}${note.image_url}`
                      }
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
                        className="text-sm font-bold text-slate-400"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          if (await updateNote(note.id, editingText))
                            setEditingId(null);
                        }}
                        className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xl font-medium leading-relaxed text-slate-700 dark:text-slate-200">
                      <HighlightText
                        text={note.content}
                        highlight={debouncedSearch}
                      />
                    </p>
                    <div className="mt-8 flex items-center justify-between border-t border-slate-50 dark:border-slate-700 pt-6">
                      <time className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                        {note.date}
                      </time>
                      <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingId(note.id);
                            setEditingText(note.content);
                          }}
                          className="text-blue-400 hover:text-blue-600"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button
                          onClick={() =>
                            openModal({
                              title: "Delete?",
                              message: "영구 삭제하시겠습니까?",
                              onConfirm: () => deleteNote(note.id),
                            })
                          }
                          className="text-red-200 hover:text-red-500"
                        >
                          <Trash2 size={18} />
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
                className="w-full py-4 rounded-[2rem] bg-white dark:bg-slate-800 text-slate-400 font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <ChevronDown size={20} /> Load More
              </button>
            )}

            {filteredNotes.length === 0 && !isNotesLoading && (
              <div className="py-24 text-center">
                <FileText
                  className="mx-auto mb-4 text-slate-100 dark:text-slate-800"
                  size={64}
                />
                <p className="font-bold text-slate-200 dark:text-slate-700 tracking-widest uppercase text-xs">
                  No Records Found
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// --- [Main Application] ---
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
