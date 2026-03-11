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
} from "lucide-react";

/**
 * [STEP 3-1: Full State Master]
 * 1. 아키텍처: 모든 CRUD 로직을 Zustand Store로 이동 (컴포넌트 경량화)
 * 2. 기능: 인라인 수정(Inline Editing) 기능 추가
 * 3. 성능: 최적화된 Selector 패턴과 하이라이팅 기능 유지
 * 4. UX: 스켈레톤 UI와 커스텀 모달 시스템 통합
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

// --- [Zustand Store] 중앙 데이터 및 로직 창고 ---
const useStore = create((set, get) => ({
  // 상태(State)
  user: null,
  notes: [],
  isNotesLoading: false,
  toast: null,
  modal: null,

  // 인증 액션(Auth Actions)
  setUser: (user) => set({ user }),

  // 노트 액션(Note CRUD Actions)
  fetchNotes: async () => {
    set({ isNotesLoading: true });
    try {
      const res = await fetch(`${API_URL}/api/notes`, {
        credentials: "include",
      });
      if (res.ok) set({ notes: await res.json() });
    } catch (err) {
      console.error("노트 로딩 실패:", err);
    } finally {
      set({ isNotesLoading: false });
    }
  },

  addNote: async (content, imageFile) => {
    const formData = new FormData();
    formData.append("content", content);
    if (imageFile) formData.append("image", imageFile);

    try {
      const res = await fetch(`${API_URL}/api/notes`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (res.ok) {
        const saved = await res.json();
        set((state) => ({ notes: [saved, ...state.notes] }));
        get().showToast("기록이 보관함에 저장되었습니다.");
        return true;
      }
    } catch (err) {
      get().showToast("저장 중 오류가 발생했습니다.", "error");
    }
    return false;
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
        get().showToast("기록이 수정되었습니다.");
        return true;
      }
    } catch (err) {
      get().showToast("수정 중 오류가 발생했습니다.", "error");
    }
    return false;
  },

  deleteNote: async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/notes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
        get().showToast("기록이 삭제되었습니다.");
        return true;
      }
    } catch (err) {
      get().showToast("삭제 중 오류가 발생했습니다.", "error");
    }
    return false;
  },

  // UI 액션(UI Actions)
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

const SkeletonNote = () => (
  <div className="rounded-[2.5rem] bg-white p-10 shadow-sm animate-pulse">
    <div className="mb-6 h-48 w-full rounded-3xl bg-slate-100" />
    <div className="space-y-3">
      <div className="h-6 w-3/4 rounded-lg bg-slate-100" />
      <div className="h-6 w-1/2 rounded-lg bg-slate-100" />
    </div>
  </div>
);

const Toast = () => {
  const toast = useStore((s) => s.toast);
  const hideToast = useStore((s) => s.hideToast);
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
  const modal = useStore((s) => s.modal);
  const closeModal = useStore((s) => s.closeModal);
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
  const [initialLoading, setInitialLoading] = useState(true);

  const setUser = useStore((s) => s.setUser);
  const fetchNotes = useStore((s) => s.fetchNotes);

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
        console.error("인증 확인 실패");
      } finally {
        setInitialLoading(false);
      }
    };
    checkAuth();
  }, [setUser, fetchNotes]);

  if (initialLoading)
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white text-blue-600">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100">
      <Toast />
      <Modal />
      {view === "login" && <LoginPage setView={setView} />}
      {view === "signup" && <SignupPage setView={setView} />}
      {view === "home" && <HomePage setView={setView} />}
    </div>
  );
};

// --- [Pages] ---

const LoginPage = ({ setView }) => {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");

  const setUser = useStore((s) => s.setUser);
  const fetchNotes = useStore((s) => s.fetchNotes);
  const showToast = useStore((s) => s.showToast);

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
        showToast(`${id}님, 접속을 승인합니다.`);
      } else {
        showToast("아이디 또는 비밀번호를 확인하세요.", "error");
      }
    } catch (err) {
      showToast("서버 연결 실패", "error");
    }
  };

  return (
    <div className="flex h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[2.5rem] bg-white p-10 shadow-2xl ring-1 ring-slate-100 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Lock size={32} />
        </div>
        <h1 className="text-3xl font-black italic tracking-tighter text-slate-800 mb-10">
          VAULT
        </h1>
        <form onSubmit={handleLogin} className="space-y-4 text-left">
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
          className="mt-8 text-sm font-bold text-slate-300 hover:text-blue-500 transition-colors"
        >
          계정 생성
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
      if (res.ok) {
        showToast("회원가입 완료! 이제 로그인하세요.");
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
      <div className="w-full max-w-sm rounded-[2.5rem] bg-white p-10 shadow-2xl ring-1 ring-slate-100 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <Plus size={32} />
        </div>
        <h1 className="text-3xl font-black italic tracking-tighter text-slate-800 mb-10">
          JOIN
        </h1>
        <form onSubmit={handleSignup} className="space-y-4 text-left">
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
          className="mt-8 text-sm font-bold text-slate-300 hover:text-slate-500 transition-colors"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
};

const HomePage = ({ setView }) => {
  // Local State (UI 관련)
  const [newContent, setNewContent] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");

  // Store Selectors (로직 관련)
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const notes = useStore((s) => s.notes);
  const isNotesLoading = useStore((s) => s.isNotesLoading);
  const addNote = useStore((s) => s.addNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const updateNote = useStore((s) => s.updateNote);
  const openModal = useStore((s) => s.openModal);
  const showToast = useStore((s) => s.showToast);

  const handleLogout = async () => {
    await fetch(`${API_URL}/api/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    setView("login");
    showToast("로그아웃 되었습니다.");
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

  const handleUpdate = async (id) => {
    if (!editingText.trim()) return;
    const success = await updateNote(id, editingText);
    if (success) setEditingId(null);
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
            당신만의 {notes.length}개의 비밀 기록들
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-300 hover:text-red-400 transition-colors"
        >
          <LogOut size={14} /> Logout
        </button>
      </header>

      {/* 작성 섹션 */}
      <form onSubmit={handleAddNote} className="mb-12">
        <div className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:shadow-xl transition-all">
          <textarea
            className="w-full resize-none border-none bg-transparent p-8 text-xl outline-none placeholder:text-slate-300"
            rows="3"
            placeholder="기록하고 싶은 비밀이 있나요?"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
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
                사진 삭제
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

      {/* 리스트 섹션 */}
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

              {editingId === note.id ? (
                <div className="space-y-4">
                  <textarea
                    className="w-full rounded-2xl bg-slate-50 p-6 text-xl outline-none ring-2 ring-blue-500"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    autoFocus
                  />
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-sm font-bold text-slate-400"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => handleUpdate(note.id)}
                      className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg"
                    >
                      수정 완료
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-2xl font-medium leading-relaxed text-slate-700">
                    <HighlightText text={note.content} highlight={searchTerm} />
                  </p>
                  <div className="mt-8 flex items-center justify-between border-t border-slate-50 pt-6">
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
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() =>
                          openModal({
                            title: "기록 삭제",
                            message: "이 비밀 기록을 영구히 삭제하시겠습니까?",
                            onConfirm: () => deleteNote(note.id),
                          })
                        }
                        className="text-red-200 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </>
              )}
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
