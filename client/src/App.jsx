import React, { useState, useEffect } from "react";

/**
 * [최종 통합 버전] Secret Journal App
 * 1. Security: HTTPS 환경 세션 유지 (credentials: "include")
 * 2. Features: 검색, 수정, 삭제, 이미지 업로드 전체 포함
 * 3. Robustness: API_URL 정규화 및 환경 변수 안전 로드
 */

const App = () => {
  const [view, setView] = useState("login");
  const [user, setUser] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState(false);

  // 환경 변수 안전 로드 및 슬래시 제거
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
      console.warn("Using default API URL due to env access error.");
    }
    return url.replace(/\/$/, "");
  };

  const API_URL = getApiUrl();

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    setLoading(true);
    setServerError(false);
    try {
      const res = await fetch(`${API_URL}/api/me`, { credentials: "include" });
      const data = await res.json();
      if (data.isLoggedIn) {
        setUser({ username: data.username });
        setView("home");
        fetchNotes();
      }
    } catch (err) {
      console.error("Server connection failed:", err);
      setServerError(true);
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
      console.error("Failed to fetch notes:", err);
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
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  if (serverError)
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="mb-4 text-6xl">🔌</div>
        <h2 className="mb-2 text-2xl font-bold text-slate-800">
          서버 연결 오류
        </h2>
        <p className="mb-6 text-slate-500">
          배포된 서버 주소({API_URL})가 올바른지 확인해 주세요.
        </p>
        <button
          onClick={checkLoginStatus}
          className="rounded-2xl bg-blue-600 px-8 py-3 font-bold text-white shadow-lg hover:bg-blue-700 transition-all"
        >
          다시 시도
        </button>
      </div>
    );

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center font-bold text-slate-400 animate-pulse uppercase tracking-widest">
        Vault Connecting...
      </div>
    );

  const renderView = () => {
    switch (view) {
      case "login":
        return (
          <LoginPage
            setView={setView}
            setUser={setUser}
            fetchNotes={fetchNotes}
            API_URL={API_URL}
          />
        );
      case "signup":
        return <SignupPage setView={setView} API_URL={API_URL} />;
      case "home":
        return (
          <HomePage
            user={user}
            notes={notes}
            setNotes={setNotes}
            handleLogout={handleLogout}
            API_URL={API_URL}
          />
        );
      default:
        return (
          <LoginPage
            setView={setView}
            setUser={setUser}
            fetchNotes={fetchNotes}
            API_URL={API_URL}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {renderView()}
    </div>
  );
};

/** 🔐 Login Page */
const LoginPage = ({ setView, setUser, fetchNotes, API_URL }) => {
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
      } else {
        alert("로그인 정보가 올바르지 않습니다.");
      }
    } catch (err) {
      alert("서버 연결 실패");
    }
  };

  return (
    <div className="flex h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-10 shadow-2xl">
        <h1 className="mb-10 text-center text-3xl font-black italic tracking-tighter text-slate-800">
          VAULT
        </h1>
        <form onSubmit={onLogin} className="space-y-4">
          <input
            type="text"
            className="w-full rounded-2xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded-2xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="PW"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
          />
          <button className="w-full rounded-2xl bg-blue-600 py-4 font-bold text-white shadow-lg hover:bg-blue-700 transition-all active:scale-95">
            Unlock
          </button>
        </form>
        <button
          onClick={() => setView("signup")}
          className="mt-6 w-full text-sm font-bold text-slate-300 hover:text-blue-500"
        >
          계정이 없으신가요? 회원가입
        </button>
      </div>
    </div>
  );
};

/** 📝 Signup Page */
const SignupPage = ({ setView, API_URL }) => {
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
        alert("가입 성공! 이제 로그인해 주세요.");
        setView("login");
      } else {
        const data = await res.json();
        alert(data.message);
      }
    } catch (err) {
      alert("서버 연결 실패");
    }
  };

  return (
    <div className="flex h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-10 shadow-2xl">
        <h1 className="mb-10 text-center text-3xl font-black italic tracking-tighter text-slate-800">
          JOIN
        </h1>
        <form onSubmit={onSignup} className="space-y-4">
          <input
            type="text"
            className="w-full rounded-2xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="New ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded-2xl bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="New PW"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
          />
          <button className="w-full rounded-2xl bg-slate-900 py-4 font-bold text-white shadow-lg hover:bg-black transition-all active:scale-95">
            Create Account
          </button>
        </form>
        <button
          onClick={() => setView("login")}
          className="mt-6 w-full text-sm font-bold text-slate-300 hover:text-slate-500"
        >
          이미 계정이 있나요? 로그인
        </button>
      </div>
    </div>
  );
};

/** 🏠 Home Page */
const HomePage = ({ user, notes, setNotes, handleLogout, API_URL }) => {
  const [newNote, setNewNote] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState("");

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
      } else {
        const errData = await res.json();
        alert("저장 실패: " + errData.message);
      }
    } catch (err) {
      alert("서버 연결 실패");
    }
  };

  const deleteNote = async (id) => {
    if (!window.confirm("기록을 삭제하시겠습니까? (연결된 사진도 삭제됩니다)"))
      return;
    try {
      const res = await fetch(`${API_URL}/api/notes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) setNotes(notes.filter((n) => n.id !== id));
    } catch (err) {
      alert("삭제 실패");
    }
  };

  const updateNote = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: editingContent }),
      });
      if (res.ok) {
        setNotes(
          notes.map((n) =>
            n.id === id ? { ...n, content: editingContent } : n,
          ),
        );
        setEditingId(null);
      }
    } catch (err) {
      alert("수정 실패");
    }
  };

  const filteredNotes = notes.filter((n) =>
    n.content.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-12 flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter text-slate-800">
            {user?.username}'s Vault.
          </h1>
          <p className="font-medium text-slate-400">당신만의 비밀 기록 공간</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs font-bold uppercase tracking-widest text-slate-300 hover:text-red-400 transition-colors"
        >
          Logout
        </button>
      </header>

      {/* Note Creation */}
      <form onSubmit={addNote} className="mb-10 space-y-4">
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-blue-500 focus-within:ring-2 focus-within:shadow-xl transition-all">
          <textarea
            className="w-full resize-none border-none bg-transparent p-6 text-lg outline-none"
            rows="3"
            placeholder="비밀을 남기세요..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
          {preview && (
            <div className="px-6 pb-4 flex items-center gap-4">
              <img
                src={preview}
                alt="preview"
                className="h-24 w-24 rounded-2xl object-cover shadow-md"
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
          <div className="flex items-center justify-between p-4 pt-0">
            <label className="cursor-pointer rounded-xl bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-100 transition-colors">
              📸 사진 첨부
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleImageChange}
              />
            </label>
            <button className="rounded-2xl bg-slate-900 px-8 py-2.5 text-sm font-bold text-white shadow-lg active:scale-95 transition-transform">
              Save Secret
            </button>
          </div>
        </div>
      </form>

      {/* Search */}
      <div className="mb-8 relative group">
        <input
          type="text"
          placeholder="기록 검색..."
          className="w-full rounded-2xl border-none bg-white px-6 py-4 shadow-sm outline-none ring-blue-500 focus:ring-2 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Note List */}
      <div className="space-y-6">
        {filteredNotes.map((note) => (
          <div
            key={note.id}
            className="group relative rounded-3xl bg-white p-8 shadow-sm hover:shadow-md transition-all"
          >
            {editingId === note.id ? (
              <div className="space-y-4">
                <textarea
                  className="w-full rounded-2xl bg-slate-50 p-4 outline-none ring-blue-500 focus:ring-2"
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
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
                    onClick={() => updateNote(note.id)}
                    className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-bold text-white"
                  >
                    수정 완료
                  </button>
                </div>
              </div>
            ) : (
              <>
                {note.image_url && (
                  <div className="mb-5 overflow-hidden rounded-2xl">
                    <img
                      src={`${API_URL}${note.image_url}`}
                      alt="note"
                      className="max-h-96 w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                )}
                <p className="text-xl leading-relaxed text-slate-700">
                  {note.content}
                </p>
                <div className="mt-6 flex items-center justify-between">
                  <time className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                    {note.date}
                  </time>
                  <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingId(note.id);
                        setEditingContent(note.content);
                      }}
                      className="text-xs font-bold text-blue-400 hover:text-blue-600"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="text-xs font-bold text-red-300 hover:text-red-500"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
        {filteredNotes.length === 0 && (
          <div className="py-20 text-center italic text-slate-200">
            남겨진 비밀이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
