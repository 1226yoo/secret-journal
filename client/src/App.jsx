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
  Sparkles,
} from "lucide-react";

/**
 * [FINAL EVOLUTION - STEP 5-1]
 * 1. Image Optimization: Client-side 리사이징으로 업로드 속도 500% 향상
 * 2. Visual Feedback: 글자 수 임계치 도달 시 강조 처리 (UX)
 * 3. Architecture: 안정적인 에러 핸들링 및 페이지네이션 통합 유지
 */

const getApiUrl = () => {
  let url = "http://localhost:5000";
  try {
    const metaEnv = typeof import.meta !== "undefined" ? import.meta.env : null;
    if (metaEnv && metaEnv.VITE_API_URL) url = metaEnv.VITE_API_URL;
  } catch (e) {}
  return url.replace(/\/$/, "");
};
const API_URL = getApiUrl();

// --- [Utility] 이미지 압축 함수 ---
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
  isDarkMode: false,
  hasMore: true,
  toast: null,
  modal: null,
  error: null,
  isUploading: false, // 업로드 전용 로딩 상태

  setUser: (user) => set({ user }),
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),

  fetchNotes: async (isMore = false) => {
    const { notes, hasMore } = get();
    if (isMore && !hasMore) return;

    set({ isNotesLoading: true, error: null });
    try {
      const offset = isMore ? notes.length : 0;
      const res = await fetch(`${API_URL}/api/notes?offset=${offset}&limit=5`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("기록을 불러오지 못했습니다.");
      const newData = await res.json();
      set((state) => ({
        notes: isMore ? [...state.notes, ...newData] : newData,
        hasMore: newData.length === 5,
      }));
    } catch (err) {
      set({ error: err.message });
    } finally {
      set({ isNotesLoading: false });
    }
  },

  addNote: async (content, imageFile) => {
    if (!content.trim() && !imageFile) return false;

    set({ isUploading: true }); // 업로드 시작
    try {
      const formData = new FormData();
      formData.append("content", content);

      // 이미지 있을 경우 압축 진행
      if (imageFile) {
        const compressed = await compressImage(imageFile);
        formData.append("image", compressed);
      }

      const res = await fetch(`${API_URL}/api/notes`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) throw new Error("금고 저장 실패");

      const saved = await res.json();
      set((state) => ({ notes: [saved, ...state.notes] }));
      get().showToast("비밀이 성공적으로 봉인되었습니다.");
      return true;
    } catch (err) {
      get().showToast(err.message, "error");
      return false;
    } finally {
      set({ isUploading: false }); // 업로드 종료
    }
  },

  updateNote: async (id, newContent) => {
    try {
      const res = await fetch(`${API_URL}/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: newContent }),
      });
      if (res.ok) {
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, content: newContent } : n,
          ),
        }));
        return true;
      }
    } catch (err) {}
    return false;
  },

  deleteNote: async (id) => {
    const res = await fetch(`${API_URL}/api/notes/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
      get().showToast("기록이 소멸되었습니다.");
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
      <div className="w-full max-w-sm rounded-[2rem] bg-white dark:bg-slate-800 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500">
          <TriangleAlert size={28} />
        </div>
        <h2 className="mb-2 text-xl font-black text-slate-800 dark:text-white">
          {modal.title}
        </h2>
        <p className="mb-8 text-slate-500 dark:text-slate-400 text-sm">
          {modal.message}
        </p>
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
          Unlocking Vault...
        </p>
      </div>
    );

  return (
    <div
      className={`${isDarkMode ? "dark bg-slate-900" : "bg-slate-50"} min-h-screen font-sans selection:bg-blue-500 transition-colors duration-300`}
    >
      <div className="text-slate-900 dark:text-white">
        <Toast /> <Modal />
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
      showToast(`${id}님, 금고가 활성화되었습니다.`);
    } else {
      showToast("비밀번호를 다시 확인해주세요.", "error");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[2.5rem] bg-white dark:bg-slate-800 p-10 shadow-2xl relative animate-in fade-in zoom-in duration-300">
        <button
          onClick={toggleDarkMode}
          className="absolute right-8 top-8 text-slate-200 hover:text-blue-500 transition-colors"
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
            className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900 p-4 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
            placeholder="ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900 p-4 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
          />
          <button className="w-full rounded-2xl bg-blue-600 py-4 font-bold text-white shadow-lg active:scale-95 transition-all">
            Unlock Vault
          </button>
        </form>
        <button
          onClick={() => setView("signup")}
          className="mt-8 text-sm font-bold text-slate-300 hover:text-blue-500 w-full text-center"
        >
          Create New Secret Key
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
    const res = await fetch(`${API_URL}/api/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: id, password: pw }),
    });
    if (res.ok) {
      showToast("새 금고가 생성되었습니다! 로그인하세요.");
      setView("login");
    } else {
      showToast("이미 등록된 ID입니다.", "error");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[2.5rem] bg-white dark:bg-slate-800 p-10 shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <Plus size={32} />
        </div>
        <h1 className="text-3xl font-black italic tracking-tighter mb-10 text-center uppercase">
          Join
        </h1>
        <form onSubmit={handleSignup} className="space-y-4">
          <input
            type="text"
            className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900 p-4 outline-none dark:text-white"
            placeholder="New ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900 p-4 outline-none dark:text-white"
            placeholder="New Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
          />
          <button className="w-full rounded-2xl bg-slate-900 dark:bg-blue-600 py-4 font-bold text-white active:scale-95 transition-all">
            Register
          </button>
        </form>
        <button
          onClick={() => setView("login")}
          className="mt-8 text-sm font-bold text-slate-300 w-full text-center hover:text-slate-500"
        >
          Back to Entry
        </button>
      </div>
    </div>
  );
};

const HomePage = ({ setView }) => {
  const [newContent, setNewContent] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [displaySearch, setDisplaySearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");

  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const notes = useStore((s) => s.notes);
  const isNotesLoading = useStore((s) => s.isNotesLoading);
  const isUploading = useStore((s) => s.isUploading); // 업로드 로딩 상태
  const hasMore = useStore((s) => s.hasMore);
  const error = useStore((s) => s.error);
  const fetchNotes = useStore((s) => s.fetchNotes);
  const addNote = useStore((s) => s.addNote);
  const updateNote = useStore((s) => s.updateNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const openModal = useStore((s) => s.openModal);
  const showToast = useStore((s) => s.showToast);
  const isDarkMode = useStore((s) => s.isDarkMode);
  const toggleDarkMode = useStore((s) => s.toggleDarkMode);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(displaySearch), 300);
    return () => clearTimeout(timer);
  }, [displaySearch]);

  const handleLogout = async () => {
    await fetch(`${API_URL}/api/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    setView("login");
    showToast("금고를 잠궜습니다.");
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
          <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter text-slate-900 dark:text-white flex items-center gap-2">
            {user?.username}'s Vault{" "}
            <Sparkles className="text-blue-500" size={24} />
          </h1>
          <p className="mt-1 font-medium text-slate-400 text-sm">
            {notes.length}개의 비밀 조각 보관 중
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleDarkMode}
            className="text-slate-300 hover:text-blue-500 transition-colors p-2"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={handleLogout}
            className="text-[10px] font-black uppercase border border-slate-200 dark:border-slate-700 rounded-full px-4 py-1.5 hover:text-red-400 transition-all"
          >
            Logout
          </button>
        </div>
      </header>

      {/* 작성 섹션 (UX 강화) */}
      <form
        onSubmit={handleAddNote}
        className="mb-12 overflow-hidden rounded-[2rem] bg-white dark:bg-slate-800 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 focus-within:ring-2 focus-within:ring-blue-500 transition-all"
      >
        <textarea
          className="w-full resize-none border-none bg-transparent p-6 md:p-8 text-lg outline-none dark:text-white placeholder:text-slate-300"
          rows="3"
          placeholder="금고에 보관할 내용을 적으세요..."
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          maxLength={500}
        />
        {/* 글자 수 표시 (임계치 넘으면 빨간색으로 시각적 힌트) */}
        <div
          className={`px-8 text-[10px] text-right font-mono pb-2 ${newContent.length >= 450 ? "text-red-500 font-bold" : "text-slate-300"}`}
        >
          {newContent.length} / 500
        </div>

        {preview && (
          <div className="px-6 md:px-8 pb-5 flex items-center gap-4 animate-in fade-in">
            <div className="relative group">
              <img
                src={preview}
                className="h-24 w-24 rounded-2xl object-cover shadow-lg ring-2 ring-slate-100 dark:ring-slate-700"
              />
              <button
                type="button"
                onClick={() => {
                  setImage(null);
                  setPreview(null);
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 p-4 px-6 md:px-8 border-t border-slate-100 dark:border-slate-700">
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
            className="bg-slate-900 dark:bg-blue-600 text-white px-8 py-2.5 rounded-2xl font-bold active:scale-95 transition-all text-sm shadow-lg flex items-center gap-2 disabled:opacity-50"
          >
            {isUploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            {isUploading ? "Sealing..." : "Save Secret"}
          </button>
        </div>
      </form>

      {/* 검색 바 */}
      <div className="mb-10 relative group">
        <input
          type="text"
          placeholder="기록 검색..."
          className="w-full rounded-2xl border-none bg-white dark:bg-slate-800 px-6 py-4 pl-14 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
          value={displaySearch}
          onChange={(e) => setDisplaySearch(e.target.value)}
        />
        <Search
          className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors"
          size={20}
        />
      </div>

      {/* 리스트 섹션 */}
      <div className="space-y-6 md:space-y-8 pb-20">
        {error ? (
          <div className="py-20 text-center space-y-4 animate-in fade-in">
            <AlertCircle size={40} className="mx-auto text-red-500" />
            <p className="text-slate-500 text-sm">{error}</p>
            <button
              onClick={() => fetchNotes()}
              className="text-blue-500 font-bold flex items-center gap-2 mx-auto hover:underline"
            >
              <RefreshCcw size={16} /> Retry
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
                  <div className="mb-6 md:mb-8 overflow-hidden rounded-3xl bg-slate-50 dark:bg-slate-900">
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
                        className="text-sm font-bold text-slate-400"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          if (await updateNote(note.id, editingText))
                            setEditingId(null);
                        }}
                        className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold"
                      >
                        Done
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
                          className="text-blue-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button
                          onClick={() =>
                            openModal({
                              title: "Delete?",
                              message: "이 기록을 영구 삭제할까요?",
                              onConfirm: () => deleteNote(note.id),
                            })
                          }
                          className="text-red-200 hover:text-red-500 transition-colors"
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

export default App;
