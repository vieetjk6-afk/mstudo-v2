"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Instagram-style Love Story feed — faithful port of the studio's
 * wedding-lovestory design. Media comes from the couple's Drive (curated feed
 * + guest uploads). Guests can add their own photo/video (camera or file) which
 * uploads to the couple's Drive via /api/story/contribute; likes & comments are
 * playful local-only state, wishes post to /api/story/wish.
 */

export type FeedPhoto = { id: string; url: string; thumb: string; isVideo?: boolean; guestName?: string };
export type FeedWish = { name: string; text: string };
export type FeedEvent = { label?: string; weekday?: string; day?: string; month?: string; year?: string; time?: string; venue?: string; address?: string };

type Post = { id: string; author: string; role: string; initial: string; src: string; isVideo: boolean; caption: string; likes: number; time: string };
type Story = { id: string; src: string; isVideo: boolean; label: string; time: string; cap: string; url: string };

const CANVAS = 472;

export default function StoryFeed({
  slug, groom, bride, dateShort, accent, cover, story, tagline: _tagline,
  photos, guestPhotos, wishes: initialWishes, event, guestUploadEnabled, thankYou,
}: {
  slug: string; groom: string; bride: string; dateShort: string; accent: string;
  cover?: string; story?: string; tagline?: string;
  photos: FeedPhoto[]; guestPhotos: FeedPhoto[]; wishes: FeedWish[];
  event: FeedEvent; guestUploadEnabled: boolean; thankYou: string;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [coupleOpen, setCoupleOpen] = useState(true);
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const [bump, setBump] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<Record<string, { name: string; text: string }[]>>({});
  const [wishes, setWishes] = useState<FeedWish[]>(initialWishes);
  const [wishName, setWishName] = useState("");
  const [wishText, setWishText] = useState("");
  const [wishBusy, setWishBusy] = useState(false);

  // Guest identity — asked once on first visit, kept in localStorage.
  const [guestName, setGuestName] = useState("");
  const [askName, setAskName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  useEffect(() => {
    try {
      // Ưu tiên tên từ link cá nhân hóa (?guest=…) — đồng bộ với thiệp cưới.
      const sp = new URLSearchParams(window.location.search);
      const fromUrl = (sp.get("guest") || sp.get("g") || "").trim().slice(0, 60);
      if (fromUrl) {
        setGuestName(fromUrl); setWishName(fromUrl); setAskName(false);
        try { localStorage.setItem(`story_guest_${slug}`, fromUrl); } catch { /* ignore */ }
        return;
      }
      const saved = localStorage.getItem(`story_guest_${slug}`) || "";
      if (saved) { setGuestName(saved); setWishName(saved); }
      else setAskName(true);
    } catch { /* ignore */ }
  }, [slug]);
  function saveName(name: string) {
    const n = name.trim().slice(0, 60);
    setGuestName(n); if (n) setWishName((w) => w || n);
    try { if (n) localStorage.setItem(`story_guest_${slug}`, n); } catch { /* ignore */ }
    setAskName(false);
  }
  // Ensure we have a name before contributing; returns the name or opens the gate.
  function ensureName(): string | null {
    if (guestName) return guestName;
    setAskName(true);
    return null;
  }

  // Khởi tạo theo giao diện chung của site (boot script đặt data-theme trước khi
  // paint) để không mặc định luôn sáng khi khách đang dùng giao diện tối; nút
  // ☀/☾ vẫn cho khách tự đổi riêng trang này.
  useEffect(() => {
    try {
      const t = document.documentElement.dataset.theme;
      if (t === "dark" || t === "light") setTheme(t);
    } catch {
      /* ignore */
    }
  }, []);

  // Build stories (curated + guest) and feed posts.
  const allPhotos: FeedPhoto[] = [...guestPhotos, ...photos];
  const stories: Story[] = allPhotos.slice(0, 12).map((p, i) => ({
    id: p.id, src: p.thumb, isVideo: !!p.isVideo,
    label: p.guestName || `Khoảnh khắc ${i + 1}`, time: p.guestName ? "vừa xong" : "ngày cưới",
    cap: p.guestName ? `Khoảnh khắc của ${p.guestName} 💕` : "Một khoảnh khắc đẹp trong ngày chung đôi.",
    url: p.url,
  }));
  const posts: Post[] = allPhotos.map((p, i) => ({
    id: p.id,
    author: p.guestName || `${groom} & ${bride}`,
    role: p.guestName ? "Khách mời" : "Cô dâu & Chú rể",
    initial: (p.guestName || groom || "?").charAt(0).toUpperCase(),
    src: p.thumb, isVideo: !!p.isVideo,
    caption: p.guestName ? "Gửi tặng cô dâu chú rể 💐" : "",
    likes: 40 + ((i * 37) % 260), time: `${1 + (i % 12)} giờ`,
  }));

  // ── theme palette ──
  const dark = theme === "dark";
  const v = dark
    ? { canvas: "#000", bg: "#0b0b0d", paper: "#0f0f12", fg: "#f2efec", muted: "#948d87", line: "#232326", chip: "#17171a" }
    : { canvas: "#f6f5f4", bg: "#fff", paper: "#fff", fg: "#181513", muted: "#8c847d", line: "#ececec", chip: "#f3f1ef" };
  const ring = `linear-gradient(135deg,#f6b98d,${accent} 55%,#a9527f)`;
  const cm = "var(--font-cormorant), serif";

  // ── story viewer ──
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [prog, setProg] = useState(0);
  const rafRef = useRef<number | null>(null);
  const cancelProg = useCallback(() => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } }, []);
  const goStory = useCallback((i: number | null) => {
    cancelProg();
    if (i == null || i < 0 || i >= stories.length) { setOpenIdx(null); setProg(0); return; }
    setOpenIdx(i); setProg(0);
    const start = performance.now(); const dur = 5000;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setProg(p);
      if (p >= 1) { setOpenIdx((cur) => (cur == null ? null : cur)); goStory(i + 1 < stories.length ? i + 1 : null); return; }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stories.length, cancelProg]);
  useEffect(() => () => cancelProg(), [cancelProg]);

  // ── camera / composer ──
  const [cam, setCam] = useState<"closed" | "live">("closed");
  const [captured, setCaptured] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<Blob | null>(null);
  const [camErr, setCamErr] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [flashing, setFlashing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; }, []);
  const startStream = useCallback(async () => {
    stopStream();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("no");
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
      streamRef.current = s;
      const attach = () => { if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}); } else setTimeout(attach, 60); };
      attach();
    } catch { setCamErr(true); }
  }, [facing, stopStream]);
  // Thu hồi blob URL cũ khi thay/đóng để không rò rỉ bộ nhớ (mỗi lần "Chụp lại"
  // là một blob ảnh/video nhiều MB nếu không revoke).
  const replaceCaptured = useCallback((url: string | null) => {
    setCaptured((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
  }, []);
  async function openCamera() { if (!guestUploadEnabled) return; setCam("live"); replaceCaptured(null); setCapturedFile(null); setCamErr(false); await startStream(); }
  function closeCamera() { stopStream(); setCam("closed"); replaceCaptured(null); setCapturedFile(null); setCamErr(false); }
  function capture() {
    const vd = videoRef.current;
    if (!vd || !vd.videoWidth) { setCamErr(true); return; }
    const w = vd.videoWidth, h = vd.videoHeight, side = Math.min(w, h);
    const cvs = document.createElement("canvas"); cvs.width = side; cvs.height = side;
    const ctx = cvs.getContext("2d")!; const sx = (w - side) / 2, sy = (h - side) / 2;
    if (facing === "user") { ctx.translate(side, 0); ctx.scale(-1, 1); }
    ctx.drawImage(vd, sx, sy, side, side, 0, 0, side, side);
    cvs.toBlob((b) => { if (b) { setCapturedFile(b); replaceCaptured(URL.createObjectURL(b)); } }, "image/jpeg", 0.9);
    setFlashing(true); setTimeout(() => setFlashing(false), 500); stopStream();
  }
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setCapturedFile(f); replaceCaptured(URL.createObjectURL(f)); setCamErr(false); setCam("live"); stopStream();
    e.target.value = "";
  }
  async function share() {
    if (!capturedFile || sending) return;
    const gn = ensureName();
    if (!gn) return; // name gate opened; tap Share again after entering name
    setSending(true);
    try {
      const fd = new FormData();
      const ext = capturedFile.type.startsWith("video/") ? "mp4" : "jpg";
      fd.append("file", capturedFile, `story.${ext}`);
      fd.append("guest_name", gn);
      const res = await fetch(`/api/story/contribute/${slug}`, { method: "POST", body: fd });
      closeCamera();
      if (res.ok) { setSentMsg("Đã gửi! Ảnh của bạn sẽ hiện trên trang 💕"); setTimeout(() => { setSentMsg(null); location.reload(); }, 1400); }
      else setSentMsg("Gửi chưa được, thử lại nhé.");
    } catch {
      // Mạng chập chờn (wifi tiệc cưới…): không được khoá nút Share vĩnh viễn.
      setSentMsg("Gửi chưa được, kiểm tra mạng rồi thử lại nhé.");
    } finally {
      setSending(false);
    }
  }

  async function submitWish() {
    const n = wishName.trim(), t = wishText.trim();
    if (!n || !t || wishBusy) return;
    setWishBusy(true);
    try {
      const res = await fetch("/api/story/wish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, guest_name: n, wish: t }) });
      if (res.ok) { setWishes((w) => [{ name: n, text: t }, ...w]); setWishName(""); setWishText(""); }
    } catch {
      /* offline: giữ nội dung đã nhập, chỉ mở khoá nút để thử lại */
    } finally {
      setWishBusy(false);
    }
  }

  const camSvg = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L8 6H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-4l-1.5-2Z" /><circle cx="12" cy="13" r="3.6" /></svg>;

  return (
    <div style={{ background: v.canvas, minHeight: "100vh", transition: "background .3s" }}>
      <div style={{ maxWidth: CANVAS, margin: "0 auto", background: v.bg, color: v.fg, minHeight: "100vh", borderLeft: `1px solid ${v.line}`, borderRight: `1px solid ${v.line}`, position: "relative", fontFamily: "var(--font-manrope), sans-serif" }}>

        {/* TOP BAR */}
        <header style={{ position: "sticky", top: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", background: `color-mix(in srgb, ${v.bg} 88%, transparent)`, backdropFilter: "blur(14px)", borderBottom: `1px solid ${v.line}` }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: cm, fontSize: 26, fontWeight: 600 }}>{groom} &amp; {bride}</span>
            {dateShort && <span style={{ fontSize: 11, color: v.muted, fontWeight: 600 }}>{dateShort}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {guestUploadEnabled && (
              <button onClick={openCamera} title="Chụp ảnh" aria-label="Chụp ảnh" style={{ width: 34, height: 34, border: "none", background: "none", cursor: "pointer", color: v.fg, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>{camSvg}</button>
            )}
            <button onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Chuyển giao diện sáng" : "Chuyển giao diện tối"} style={{ width: 34, height: 34, border: "none", background: "none", cursor: "pointer", color: v.fg, fontSize: 16 }}>{dark ? "☾" : "☀"}</button>
          </div>
        </header>

        {/* THÊM STORY — ngay trên thanh story */}
        {guestUploadEnabled && (
          <div style={{ padding: "14px 16px 2px" }}>
            <button onClick={openCamera} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", borderRadius: 16, background: v.chip, border: `1px dashed ${accent}`, padding: "12px 16px", textAlign: "left" }}>
              <div style={{ width: 40, height: 40, flex: "0 0 auto", borderRadius: 999, background: accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 24, fontWeight: 300, lineHeight: 1 }}>+</div>
              <div><div style={{ fontSize: 14, color: v.fg, fontWeight: 700 }}>Thêm story của bạn</div><div style={{ fontSize: 11.5, color: v.muted, fontWeight: 600 }}>Chụp/quay ngay hoặc chọn ảnh · video</div></div>
              <span style={{ flex: 1 }} />
              <span style={{ color: accent }}>{camSvg}</span>
            </button>
          </div>
        )}

        {/* STORIES strip */}
        {stories.length > 0 && (
          <div style={{ display: "flex", gap: 11, overflowX: "auto", padding: "14px 16px", scrollbarWidth: "none" }}>
            {stories.map((s, i) => (
              <button key={s.id + i} onClick={() => goStory(i)} style={{ flex: "0 0 auto", width: 104, height: 166, border: "none", padding: 2.5, cursor: "pointer", borderRadius: 18, background: ring, position: "relative" }}>
                <div style={{ width: "100%", height: "100%", borderRadius: 15, backgroundColor: "#000", backgroundImage: `url('${s.src}')`, backgroundSize: "cover", backgroundPosition: "center", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg,rgba(0,0,0,.6) 0%,rgba(0,0,0,0) 45%)" }} />
                  {s.isVideo && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 999, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg></div>
                    </div>
                  )}
                  <div style={{ position: "absolute", left: 9, right: 9, bottom: 8, color: "#fff", fontSize: 12, fontWeight: 700, textAlign: "left", textShadow: "0 1px 3px rgba(0,0,0,.5)" }}>{s.label}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* CHIA SẺ ẢNH — ngay dưới thanh story */}
        {guestUploadEnabled && (
          <div style={{ padding: "6px 16px 16px", borderBottom: `1px solid ${v.line}` }}>
            <div style={{ borderRadius: 16, border: `1px solid ${v.line}`, background: v.paper, padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: v.fg }}>Bạn có ảnh đẹp? Chia sẻ cùng cô dâu chú rể 💐</div>
              <div style={{ fontSize: 12, color: v.muted, margin: "4px 0 12px" }}>Ảnh/video sẽ lưu vào Google Drive của cô dâu chú rể</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={openCamera} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 44, border: "none", borderRadius: 12, background: accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{camSvg} Chụp / Quay</button>
                <label style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: 12, border: `1px solid ${accent}`, color: accent, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>
                  Chọn từ máy
                  <input type="file" accept="image/*,video/*" onChange={onPickFile} style={{ display: "none" }} />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* FEED */}
        <main style={{ paddingBottom: 16 }}>
          {posts.map((p) => {
            const liked = !!likes[p.id];
            const comments = extra[p.id] || [];
            const draft = drafts[p.id] || "";
            return (
              <article key={p.id} style={{ borderBottom: `1px solid ${v.line}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 14px" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 999, padding: 2, background: ring, flex: "0 0 auto" }}>
                    <div style={{ width: "100%", height: "100%", borderRadius: 999, background: accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: cm, fontSize: 18, fontWeight: 600 }}>{p.initial}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.2 }}>{p.author}</div>
                    <div style={{ fontSize: 11.5, color: v.muted }}>{p.role}</div>
                  </div>
                  <span style={{ color: v.muted, fontSize: 20, letterSpacing: 1 }}>⋯</span>
                </div>

                <div style={{ width: "100%", aspectRatio: "1/1", backgroundColor: v.chip, backgroundImage: `url('${p.src}')`, backgroundSize: "cover", backgroundPosition: "center", position: "relative" }}>
                  {p.isVideo && (
                    <a href={`https://drive.google.com/file/d/${p.id}/view`} target="_blank" rel="noreferrer" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 54, height: 54, borderRadius: 999, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg></div>
                    </a>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "11px 14px 4px" }}>
                  <button onClick={() => { setLikes((s) => ({ ...s, [p.id]: !s[p.id] })); setBump((s) => ({ ...s, [p.id]: !liked })); setTimeout(() => setBump((s) => ({ ...s, [p.id]: false })), 420); }} style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: liked ? accent : v.fg, display: "flex" }}>
                    <svg width="25" height="25" viewBox="0 0 24 24" fill={liked ? accent : "none"} stroke="currentColor" strokeWidth="1.7" style={{ animation: bump[p.id] ? "stpop .4s ease" : undefined }}><path d="M12 20.5s-7.5-4.7-9.7-9.2C.9 8.4 2.2 5 5.4 5c2 0 3.2 1.1 4.1 2.4C10.4 6.1 11.6 5 13.6 5c3.2 0 4.5 3.4 3.1 6.3C19.5 15.8 12 20.5 12 20.5Z" /></svg>
                  </button>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={v.fg} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-11.9 7.8L3 21l1.7-6A8.5 8.5 0 1 1 21 11.5Z" /></svg>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: v.muted }}>{p.time}</span>
                </div>

                <div style={{ padding: "2px 14px 4px", fontSize: 13.5, fontWeight: 700 }}>{(p.likes + (liked ? 1 : 0)).toLocaleString("vi-VN")} lượt thích</div>
                {p.caption && <p style={{ padding: "0 14px 6px", fontSize: 14, lineHeight: 1.5, margin: 0 }}><strong style={{ fontWeight: 700 }}>{p.author}</strong> {p.caption}</p>}

                {comments.length > 0 && (
                  <div style={{ padding: "2px 14px 8px", display: "flex", flexDirection: "column", gap: 5 }}>
                    {comments.map((c, j) => (<div key={j} style={{ fontSize: 13.5, lineHeight: 1.45 }}><strong style={{ fontWeight: 700 }}>{c.name}</strong> <span>{c.text}</span></div>))}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px 14px", borderTop: `1px solid ${v.line}`, marginTop: 4 }}>
                  <input value={draft} onChange={(e) => setDrafts((s) => ({ ...s, [p.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) { setExtra((s) => ({ ...s, [p.id]: [...(s[p.id] || []), { name: "bạn", text: draft.trim() }] })); setDrafts((s) => ({ ...s, [p.id]: "" })); } }} placeholder="Thêm bình luận..." style={{ flex: 1, border: "none", background: "none", color: v.fg, fontSize: 13.5, outline: "none", padding: "6px 0" }} />
                  <button onClick={() => { if (draft.trim()) { setExtra((s) => ({ ...s, [p.id]: [...(s[p.id] || []), { name: "bạn", text: draft.trim() }] })); setDrafts((s) => ({ ...s, [p.id]: "" })); } }} style={{ border: "none", background: "none", color: accent, fontWeight: 700, fontSize: 13.5, cursor: "pointer", padding: 0, opacity: draft.trim() ? 1 : 0.4 }}>Đăng</button>
                </div>
              </article>
            );
          })}

          {posts.length === 0 && (
            <p style={{ padding: "40px 20px", textAlign: "center", fontSize: 14, color: v.muted }}>Chưa có ảnh nào. {guestUploadEnabled ? "Hãy là người đầu tiên thêm khoảnh khắc!" : ""}</p>
          )}

          {/* WISH WALL */}
          <section style={{ padding: "26px 16px 34px" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 22, color: accent }}>❀</span>
              <h2 style={{ fontFamily: cm, fontSize: 32, fontWeight: 600, margin: "4px 0" }}>Sổ lời chúc</h2>
              <p style={{ fontSize: 13, color: v.muted, margin: 0 }}>Gửi lời chúc đến cô dâu chú rể</p>
            </div>
            <div style={{ background: v.chip, borderRadius: 18, padding: 16, marginBottom: 22 }}>
              <input value={wishName} onChange={(e) => setWishName(e.target.value)} placeholder="Tên của bạn" style={{ width: "100%", height: 42, border: `1px solid ${v.line}`, background: v.bg, color: v.fg, borderRadius: 11, padding: "0 14px", fontSize: 13.5, outline: "none", marginBottom: 9 }} />
              <textarea value={wishText} onChange={(e) => setWishText(e.target.value)} placeholder={`Lời chúc dành cho ${groom} & ${bride}...`} rows={3} style={{ width: "100%", border: `1px solid ${v.line}`, background: v.bg, color: v.fg, borderRadius: 11, padding: "11px 14px", fontSize: 13.5, lineHeight: 1.5, outline: "none", resize: "vertical" }} />
              <button onClick={submitWish} disabled={wishBusy} style={{ width: "100%", height: 46, marginTop: 10, border: "none", background: accent, color: "#fff", borderRadius: 11, fontWeight: 700, fontSize: 13, letterSpacing: ".12em", textTransform: "uppercase", cursor: "pointer", opacity: wishName.trim() && wishText.trim() && !wishBusy ? 1 : 0.5 }}>Gửi lời chúc</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {wishes.map((w, i) => (
                <div key={i} style={{ background: v.bg, border: `1px solid ${v.line}`, borderRadius: 16, padding: "15px 17px" }}>
                  <p style={{ fontSize: 14, lineHeight: 1.55, margin: "0 0 9px" }}>{w.text}</p>
                  <div style={{ fontSize: 12, fontWeight: 700, color: accent }}>— {w.name}</div>
                </div>
              ))}
            </div>
          </section>
        </main>

        <footer style={{ textAlign: "center", padding: "26px 24px 120px", borderTop: `1px solid ${v.line}` }}>
          <h3 style={{ fontFamily: cm, fontSize: 26, fontWeight: 600, margin: "0 0 4px" }}>{groom} &amp; {bride}</h3>
          <p style={{ fontSize: 11, color: v.muted, margin: 0, letterSpacing: ".14em", textTransform: "uppercase" }}>{thankYou}</p>
        </footer>

        {/* COUPLE INFO POPUP */}
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 90, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ width: "100%", maxWidth: CANVAS, padding: "0 12px 14px", pointerEvents: "auto" }}>
            {coupleOpen ? (
              <div style={{ background: v.paper, border: `1px solid ${v.line}`, borderRadius: 24, boxShadow: "0 16px 50px rgba(0,0,0,.24)", position: "relative", animation: "strise .35s ease both", overflow: "hidden", maxHeight: "76vh", overflowY: "auto" }}>
                <div style={{ height: 150, backgroundColor: v.chip, backgroundImage: cover ? `url('${cover}')` : undefined, backgroundSize: "cover", backgroundPosition: "center 30%", position: "relative" }}>
                  <div style={{ position: "absolute", inset: 0, background: `linear-gradient(0deg,${v.paper} 1%,rgba(0,0,0,.15) 40%,rgba(0,0,0,.1))` }} />
                  <button onClick={() => setCoupleOpen(false)} title="Ẩn để xem story" style={{ position: "absolute", top: 12, right: 12, width: 30, height: 30, borderRadius: 999, border: "none", background: "rgba(0,0,0,.42)", color: "#fff", fontSize: 14, cursor: "pointer", backdropFilter: "blur(4px)" }}>✕</button>
                </div>
                <div style={{ padding: "2px 22px 22px", textAlign: "center", marginTop: -6, position: "relative" }}>
                  {event.label && <div style={{ fontSize: 11, letterSpacing: ".34em", textTransform: "uppercase", color: accent, fontWeight: 700 }}>{event.label}</div>}
                  <div style={{ fontFamily: cm, fontSize: 44, fontWeight: 600, lineHeight: 1, margin: "8px 0 4px" }}>{groom} <span style={{ color: accent, fontStyle: "italic" }}>&amp;</span> {bride}</div>
                  {(event.day || event.time || event.venue) && (
                    <div style={{ display: "flex", alignItems: "stretch", justifyContent: "center", gap: 18, margin: "16px 0 4px" }}>
                      {event.day && (
                        <div style={{ textAlign: "center" }}>
                          {event.weekday && <div style={{ fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: v.muted, fontWeight: 700 }}>{event.weekday}</div>}
                          <div style={{ fontFamily: cm, fontSize: 32, fontWeight: 600, lineHeight: 1, margin: "3px 0" }}>{event.day}</div>
                          {event.month && <div style={{ fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: v.muted, fontWeight: 700 }}>{event.month}</div>}
                        </div>
                      )}
                      <div style={{ width: 1, background: v.line }} />
                      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "left", gap: 5 }}>
                        {(event.time || event.year) && <div style={{ fontSize: 13, color: v.fg, fontWeight: 600 }}>{[event.time, event.year].filter(Boolean).join(" · ")}</div>}
                        {(event.venue || event.address) && <div style={{ fontSize: 12.5, color: v.muted, lineHeight: 1.35 }}>{event.venue}{event.address && <><br />{event.address}</>}</div>}
                      </div>
                    </div>
                  )}
                  {story && (
                    <div style={{ borderTop: `1px solid ${v.line}`, marginTop: 16, paddingTop: 16 }}>
                      <p style={{ fontSize: 14, lineHeight: 1.7, color: v.fg, margin: 0, whiteSpace: "pre-line" }}>{story}</p>
                      <div style={{ fontFamily: cm, fontSize: 22, fontStyle: "italic", color: accent, marginTop: 12 }}>Yêu thương, {groom} &amp; {bride}</div>
                    </div>
                  )}
                  <button onClick={() => setCoupleOpen(false)} style={{ marginTop: 18, width: "100%", height: 46, border: "none", background: accent, color: "#fff", borderRadius: 12, fontWeight: 700, fontSize: 12.5, letterSpacing: ".12em", textTransform: "uppercase", cursor: "pointer" }}>Xem story &amp; chia sẻ</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <button onClick={() => setCoupleOpen(true)} style={{ border: `1px solid ${v.line}`, background: v.paper, boxShadow: "0 6px 22px rgba(0,0,0,.16)", borderRadius: 999, padding: "9px 17px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: v.fg, fontWeight: 700, fontSize: 13 }}><span style={{ color: accent, fontSize: 15 }}>♥</span> {groom} &amp; {bride}</button>
              </div>
            )}
          </div>
        </div>

        {/* STORY VIEWER */}
        {openIdx != null && stories[openIdx] && (
          <div onClick={() => goStory(null)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "stfade .25s ease both" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "min(430px,94vw)", height: "min(760px,90vh)", borderRadius: 14, overflow: "hidden", background: "#000" }}>
              <div style={{ position: "absolute", top: 10, left: 12, right: 12, display: "flex", gap: 4, zIndex: 3 }}>
                {stories.map((_, i) => (
                  <div key={i} style={{ flex: 1, height: 2.5, borderRadius: 2, background: "rgba(255,255,255,.35)", overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "#fff", borderRadius: 2, width: i < openIdx! ? "100%" : i === openIdx ? `${Math.round(prog * 100)}%` : "0%" }} />
                  </div>
                ))}
              </div>
              <div style={{ position: "absolute", inset: 0, backgroundColor: "#000", backgroundImage: `url('${stories[openIdx].url}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
              <div style={{ position: "absolute", top: 26, left: 14, right: 14, display: "flex", alignItems: "center", gap: 9, color: "#fff", zIndex: 3 }}>
                <div style={{ width: 32, height: 32, borderRadius: 999, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: cm, fontSize: 16, fontWeight: 600 }}>{groom.charAt(0)}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{stories[openIdx].label}</div>
                <span style={{ fontSize: 12, opacity: 0.75 }}>{stories[openIdx].time}</span>
                <span style={{ flex: 1 }} />
                <button onClick={() => goStory(null)} style={{ border: "none", background: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "44px 18px 22px", background: "linear-gradient(0deg,rgba(0,0,0,.7),transparent)", color: "#fff", fontSize: 14.5, lineHeight: 1.55, zIndex: 3 }}>{stories[openIdx].cap}</div>
              <button onClick={() => goStory(openIdx! - 1)} style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "32%", border: "none", background: "none", cursor: "pointer", zIndex: 2 }} />
              <button onClick={() => goStory(openIdx! + 1)} style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "40%", border: "none", background: "none", cursor: "pointer", zIndex: 2 }} />
            </div>
          </div>
        )}

        {/* CAMERA / COMPOSER */}
        {cam !== "closed" && (
          <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "#000", display: "flex", flexDirection: "column", animation: "stfade .2s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", color: "#fff" }}>
              <button onClick={closeCamera} style={{ border: "none", background: "none", color: "#fff", fontSize: 22, cursor: "pointer" }}>✕</button>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{captured ? "Bài viết mới" : camErr ? "Máy ảnh" : "Chụp khoảnh khắc"}</span>
              <div style={{ width: 22 }} />
            </div>
            <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#111" }}>
              {cam === "live" && !captured && !camErr && (
                <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: facing === "user" ? "scaleX(-1)" : "none" }} />
              )}
              {captured && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={captured} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
              {camErr && (
                <div style={{ textAlign: "center", color: "#fff", padding: 30 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
                  <p style={{ fontSize: 14, opacity: 0.8, lineHeight: 1.6, margin: "0 0 18px", maxWidth: 280 }}>Không truy cập được camera.<br />Bạn có thể chọn ảnh/video từ thư viện để chia sẻ.</p>
                  <label style={{ display: "inline-block", background: "#fff", color: "#111", fontWeight: 700, fontSize: 13, padding: "12px 22px", borderRadius: 999, cursor: "pointer" }}>Chọn từ máy<input type="file" accept="image/*,video/*" onChange={onPickFile} style={{ display: "none" }} /></label>
                </div>
              )}
              <div style={{ position: "absolute", inset: 0, background: "#fff", pointerEvents: "none", animation: flashing ? "stflash .5s ease forwards" : undefined, opacity: flashing ? undefined : 0 }} />
            </div>
            {captured && (
              <div style={{ background: "#000", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#fff", fontSize: 13 }}>
                <span style={{ opacity: 0.7 }}>Đăng với tên</span>
                <button onClick={() => { setNameInput(guestName); setAskName(true); }} style={{ border: "none", background: "none", color: accent, fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>{guestName || "Nhập tên của bạn"}</button>
              </div>
            )}
            <div style={{ padding: "10px 24px 30px", display: "flex", alignItems: "center", justifyContent: "center", gap: 38 }}>
              {cam === "live" && !captured && !camErr && (<>
                <label style={{ color: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontSize: 11 }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m21 15-5-4-6 5" /></svg>
                  Thư viện<input type="file" accept="image/*,video/*" onChange={onPickFile} style={{ display: "none" }} />
                </label>
                <button onClick={capture} style={{ width: 74, height: 74, borderRadius: 999, border: "5px solid #fff", background: "rgba(255,255,255,.25)", cursor: "pointer" }} />
                <button onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} style={{ border: "none", background: "none", color: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontSize: 11 }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></svg>
                  Đổi
                </button>
              </>)}
              {captured && (<>
                <button onClick={() => { setCaptured(null); setCapturedFile(null); setCamErr(false); startStream(); }} style={{ border: "1px solid #555", background: "none", color: "#fff", fontWeight: 700, fontSize: 14, padding: "13px 26px", borderRadius: 999, cursor: "pointer" }}>Chụp lại</button>
                <button onClick={share} disabled={sending} style={{ border: "none", background: accent, color: "#fff", fontWeight: 700, fontSize: 14, padding: "13px 34px", borderRadius: 999, cursor: "pointer", opacity: sending ? 0.6 : 1 }}>{sending ? "Đang gửi…" : "Chia sẻ"}</button>
              </>)}
            </div>
          </div>
        )}

        {sentMsg && (
          <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 130, background: accent, color: "#fff", padding: "10px 20px", borderRadius: 999, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 30px rgba(0,0,0,.3)" }}>{sentMsg}</div>
        )}

        {/* GUEST NAME GATE — hỏi tên khi mới truy cập */}
        {askName && (
          <div style={{ position: "fixed", inset: 0, zIndex: 140, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "stfade .2s ease both" }}>
            <div style={{ width: "100%", maxWidth: 360, background: v.paper, color: v.fg, borderRadius: 22, padding: 24, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}>
              <div style={{ fontSize: 30 }}>💌</div>
              <div style={{ fontFamily: cm, fontSize: 26, fontWeight: 600, marginTop: 6 }}>Chào mừng bạn!</div>
              <p style={{ fontSize: 13.5, color: v.muted, margin: "6px 0 16px", lineHeight: 1.5 }}>{groom} &amp; {bride} rất vui được đón bạn. Cho biết tên của bạn nhé để lưu lại kỷ niệm.</p>
              <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && nameInput.trim()) saveName(nameInput); }} placeholder="Tên của bạn" autoFocus style={{ width: "100%", height: 46, border: `1px solid ${v.line}`, background: v.bg, color: v.fg, borderRadius: 12, padding: "0 16px", fontSize: 14, outline: "none", textAlign: "center" }} />
              <button onClick={() => saveName(nameInput)} disabled={!nameInput.trim()} style={{ width: "100%", height: 46, marginTop: 12, border: "none", borderRadius: 12, background: accent, color: "#fff", fontWeight: 700, fontSize: 13.5, letterSpacing: ".08em", textTransform: "uppercase", cursor: "pointer", opacity: nameInput.trim() ? 1 : 0.5 }}>Vào xem Love Story</button>
              <button onClick={() => setAskName(false)} style={{ marginTop: 10, border: "none", background: "none", color: v.muted, fontSize: 12.5, cursor: "pointer" }}>Bỏ qua</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes stpop{0%{transform:scale(1)}40%{transform:scale(1.4)}100%{transform:scale(1)}}
        @keyframes stfade{from{opacity:0}to{opacity:1}}
        @keyframes strise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes stflash{from{opacity:.85}to{opacity:0}}
      `}</style>
    </div>
  );
}
