"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HardDrive, Check, Loader2, AlertTriangle, Plus, Trash2, FolderTree, Monitor, Download } from "lucide-react";

/**
 * Kết nối Google Drive của studio + cấu hình mẫu thư mục cho MStudo Desktop.
 * Khi hợp đồng đã ký, cây thư mục được tạo theo cấu trúc:
 *   {Thư mục gốc} / {Loại dịch vụ} / Thang{tháng ngày thực hiện} / {Tên hợp đồng}
 * "JPG Goc" → album chọn ảnh; "File ChinhSua" → gallery giao khách.
 */

type Role = "selection" | "delivery" | null;
type Node = { name: string; role?: Role; excluded?: boolean };
type Template = { photo: Node[]; video: Node[] };
type Status = { configured: boolean; connected: boolean; rootFolderName: string; rootCreated: boolean; template: Template };

const ROLE_LABEL: Record<string, string> = { selection: "Album chọn ảnh", delivery: "Gallery giao khách", none: "Chỉ sao lưu" };

export default function StudioDriveCard() {
  const [foldersBusy, setFoldersBusy] = useState(false);
  const [foldersMsg, setFoldersMsg] = useState<string | null>(null);

  /** Tạo cây thư mục cho mọi hợp đồng đã chốt còn thiếu. */
  async function makeAllFolders() {
    setFoldersBusy(true);
    setFoldersMsg(null);
    try {
      const r = await fetch("/api/studio/contract-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean; error?: string; created?: number; failed?: number; done?: boolean; firstError?: string | null; pending?: number;
      };
      if (!r.ok || !j.ok) {
        setFoldersMsg(j.error ?? "Không tạo được thư mục.");
        return;
      }
      setFoldersMsg(
        j.pending === 0
          ? "Mọi hợp đồng đã chốt đều có thư mục rồi."
          : `Đã tạo ${j.created ?? 0} thư mục` +
              (j.failed ? ` · ${j.failed} hợp đồng lỗi (${j.firstError ?? ""})` : "") +
              (j.done === false ? " · còn dở, bấm lại để chạy tiếp" : "."),
      );
    } catch (e) {
      setFoldersMsg(`Không tạo được: ${(e as Error)?.message || e}`);
    } finally {
      setFoldersBusy(false);
    }
  }

  const [state, setState] = useState<Status | null>(null);
  const [tpl, setTpl] = useState<Template | null>(null);
  const [rootName, setRootName] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [flash, setFlash] = useState("");
  // Số máy đang chạy MStudo Desktop (null = chưa biết / API không trả) — để bước
  // 3 của hướng dẫn tự đánh dấu xong khi studio đã cài và kết nối app.
  const [devices, setDevices] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/studio/drive/status")
      .then((r) => r.json())
      .then((d: Status) => {
        setState(d);
        setTpl(d.template);
        setRootName(d.rootFolderName || "MStudo");
      })
      .catch(() => setState({ configured: false, connected: false, rootFolderName: "MStudo", rootCreated: false, template: { photo: [], video: [] } }));
    fetch("/api/desktop/devices")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { devices?: { revoked_at: string | null }[] } | null) => {
        if (j?.devices) setDevices(j.devices.filter((d) => !d.revoked_at).length);
      })
      .catch(() => {});
    // Thông báo sau khi quay lại từ Google.
    const q = new URLSearchParams(window.location.search).get("drive");
    if (q === "connected") setFlash("Đã kết nối Google Drive!");
    else if (q === "forbidden") setFlash("Chỉ CHỦ studio (gói Studio) mới kết nối được Drive đồng bộ hợp đồng.");
    else if (q === "notconfigured") setFlash("Máy chủ chưa bật kết nối Google Drive. Hãy liên hệ quản trị.");
    else if (q === "error") setFlash("Kết nối Drive không thành công — thử lại.");
  }, []);

  async function disconnect() {
    if (!confirm("Ngắt kết nối Drive? Ảnh/video đã tải lên vẫn còn trên Drive; hợp đồng mới sẽ ngừng tự đồng bộ.")) return;
    setBusy(true);
    await fetch("/api/studio/drive/status", { method: "DELETE" }).catch(() => {});
    setBusy(false);
    setState((s) => (s ? { ...s, connected: false } : s));
  }

  async function saveTemplate() {
    if (!tpl) return;
    setBusy(true);
    setSaved(false);
    try {
      const r = await fetch("/api/studio/drive/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: tpl, rootFolderName: rootName }),
      });
      const d: Status = await r.json();
      setState(d);
      setTpl(d.template);
      setRootName(d.rootFolderName || "MStudo");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      /* */
    }
    setBusy(false);
  }

  function editNode(group: "photo" | "video", i: number, patch: Partial<Node>) {
    setTpl((t) => {
      if (!t) return t;
      const arr = [...t[group]];
      arr[i] = { ...arr[i], ...patch };
      return { ...t, [group]: arr };
    });
  }
  function addNode(group: "photo" | "video") {
    setTpl((t) => (t ? { ...t, [group]: [...t[group], { name: "", role: null, excluded: false }] } : t));
  }
  function removeNode(group: "photo" | "video", i: number) {
    setTpl((t) => (t ? { ...t, [group]: t[group].filter((_, k) => k !== i) } : t));
  }

  const renderGroup = (group: "photo" | "video", label: string) =>
    tpl && (
      <div className="mt-4">
        <div className="mb-1.5 text-sm font-medium">{label}</div>
        <div className="space-y-2">
          {tpl[group].map((n, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                value={n.name}
                onChange={(e) => editNode(group, i, { name: e.target.value })}
                placeholder="Tên thư mục"
                className="min-w-0 flex-1 rounded-lg px-3 py-1.5 text-sm"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              />
              <select
                value={n.role || "none"}
                onChange={(e) => editNode(group, i, { role: e.target.value === "none" ? null : (e.target.value as Role) })}
                className="rounded-lg px-2 py-1.5 text-sm"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                {Object.entries(ROLE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text2)" }}>
                <input type="checkbox" checked={!n.excluded} onChange={(e) => editNode(group, i, { excluded: !e.target.checked })} />
                Đồng bộ Drive
              </label>
              <button onClick={() => removeNode(group, i)} className="btn-ghost p-1.5" title="Xóa" style={{ color: "#c05050" }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => addNode(group)} className="btn-ghost mt-2 inline-flex items-center gap-1.5 text-xs">
          <Plus size={13} /> Thêm thư mục
        </button>
      </div>
    );

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2">
        <HardDrive size={18} style={{ color: "var(--brand)" }} />
        <h2 className="font-serif text-xl font-medium">Đồng bộ ảnh/video lên Google Drive</h2>
      </div>
      <p className="mt-1 text-sm" style={{ color: "var(--text2)" }}>
        Kết nối Drive của studio một lần. Khi hợp đồng đã ký, MStudo Desktop tạo cây thư mục theo cấu trúc{" "}
        <b>Thư mục gốc / Loại dịch vụ / Thang(ngày thực hiện) / Tên hợp đồng</b> — giống hệt trên Drive và trên máy.
        Thư mục <b>loại dịch vụ</b> và <b>tháng</b> chỉ tạo một lần rồi các hợp đồng sau lưu đúng vào đó.
        Trong thư mục hợp đồng có <code>Photo/JPG Goc · Raw · File ChinhSua</code> (và <code>Video</code> nếu có quay);{" "}
        <b>JPG Goc</b> tự thành album chọn ảnh, <b>File ChinhSua</b> tự thành gallery giao khách.
      </p>

      {/* Hướng dẫn 3 bước: Drive chỉ TỰ đồng bộ khi MStudo Desktop chạy trên máy
          studio. Trước đây trang này chỉ có nút kết nối Drive, studio kết nối
          xong rồi chờ mãi không thấy ảnh lên vì chưa hề cài app. */}
      <div className="mt-4 rounded-xl p-4" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-medium">Cách để ảnh/video tự đồng bộ lên Drive</p>
        <ol className="mt-3 space-y-3">
          {[
            {
              done: devices !== null && devices > 0,
              title: "Tải và cài MStudo Desktop trên máy tính (Windows 10/11)",
              body: (
                <>
                  App chạy nền trên máy chứa ảnh; không có app thì Drive không tự đồng bộ.{" "}
                  <Link href="/dashboard/studio/desktop" className="btn-primary mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs">
                    <Download size={13} /> Tải MStudo Desktop
                  </Link>
                </>
              ),
            },
            {
              done: !!state?.connected,
              title: "Kết nối Google Drive của studio",
              body: <>Bấm <b>Kết nối Google Drive</b> ngay bên dưới và chọn tài khoản Google chứa ảnh của studio. Chỉ làm một lần.</>,
            },
            {
              done: devices !== null && devices > 0,
              title: "Mở app, kết nối máy và chọn thư mục gốc",
              body: (
                <>
                  Ở trang <Link href="/dashboard/studio/desktop" className="underline">MStudo Desktop</Link> bấm{" "}
                  <b>Kết nối thiết bị mới</b>, chép <b>mã kết nối</b> và <b>địa chỉ máy chủ</b> dán vào app. Sau đó: biểu tượng
                  khay → <i>Bảng điều khiển &amp; đồng bộ</i> → <i>Chọn thư mục gốc</i> (nơi chứa ảnh/video trên máy).
                  Từ đó mỗi hợp đồng đã ký tự có thư mục; ảnh bỏ vào thư mục trên máy sẽ <b>tự tải lên Drive</b>,
                  JPG Goc thành album chọn ảnh, File ChinhSua thành gallery giao khách.
                </>
              ),
            },
          ].map((st, i) => (
            <li key={i} className="flex gap-3">
              <span
                className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-semibold"
                style={st.done ? { background: "#4caf72", color: "#fff" } : { background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                {st.done ? <Check size={13} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{st.title}</p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--text2)" }}>{st.body}</p>
              </div>
            </li>
          ))}
        </ol>
        {devices !== null && devices > 0 && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text2)" }}>
            <Monitor size={13} style={{ color: "var(--brand)" }} /> Đang có {devices} máy chạy MStudo Desktop.
          </p>
        )}
      </div>

      {/* Không chạy desktop thì trước đây KHÔNG hợp đồng nào có thư mục, và cũng
          không có chỗ nào báo. Nút này tạo thẳng từ web. */}
      <div className="mt-3 rounded-lg p-3" style={{ background: "var(--surface2)" }}>
        <p className="text-[13px] font-medium">Tạo thư mục cho hợp đồng ngay trên web</p>
        <p className="mb-2 text-[11px]" style={{ color: "var(--text3)" }}>
          Dành cho lúc không mở MStudo Desktop. Chạy cho mọi hợp đồng đã chốt mà chưa có thư mục;
          hợp đồng đã có thì bỏ qua, bấm lại không tạo trùng.
        </p>
        <button onClick={makeAllFolders} disabled={foldersBusy} className="btn-ghost px-3 py-1.5 text-xs">
          {foldersBusy ? "Đang tạo…" : "Tạo thư mục cho các hợp đồng còn thiếu"}
        </button>
        {foldersMsg && <p className="mt-2 text-[11px]" style={{ color: "var(--text2)" }}>{foldersMsg}</p>}
        {/* Nút trên chỉ tạo thư mục TRÊN DRIVE. Máy chủ không với tới ổ đĩa của
            studio được, nên phần trên máy vẫn phải do desktop làm — nói rõ kẻo
            bấm xong lại tưởng máy cũng có thư mục. */}
        <p className="mt-2 text-[11px]" style={{ color: "var(--text3)" }}>
          Nút này chỉ tạo thư mục <b>trên Drive</b>. Thư mục <b>trên máy</b> do MStudo Desktop tạo, và nó cần
          bạn đã chọn <b>Thư mục gốc ảnh/video</b> một lần: biểu tượng khay → <i>Bảng điều khiển &amp; đồng bộ</i>
          {" "}→ <i>Chọn thư mục gốc</i>. Chưa chọn thì desktop bỏ qua im lặng và máy sẽ không có thư mục nào.
        </p>
      </div>

      {flash && (
        <p className="mt-3 rounded-lg p-3 text-sm" style={{ background: "var(--surface2)", color: "var(--text)" }}>
          {flash}
        </p>
      )}

      <div className="mt-4">
        {state === null ? (
          <span className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--text2)" }}>
            <Loader2 size={15} className="animate-spin" /> Đang kiểm tra…
          </span>
        ) : !state.configured ? (
          <div className="inline-flex items-start gap-2 rounded-md p-3 text-sm" style={{ border: "1px solid var(--border)", color: "var(--text2)" }}>
            <AlertTriangle size={15} className="mt-0.5" style={{ color: "#e0a34f" }} />
            <span>
              Máy chủ chưa cấu hình OAuth. Cần đặt <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>,{" "}
              <code>GOOGLE_STUDIO_DRIVE_REDIRECT_URI</code> (…/api/studio/drive/callback) và chạy migration{" "}
              <code>studio_drive_sync.sql</code>.
            </span>
          </div>
        ) : state.connected ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: "#4caf72" }}>
              <Check size={16} /> Đã kết nối Google Drive
            </span>
            <button onClick={disconnect} disabled={busy} className="btn-ghost text-xs">
              Ngắt kết nối
            </button>
          </div>
        ) : (
          <a href="/api/studio/drive/connect" className="btn-primary inline-flex items-center gap-2">
            <HardDrive size={15} /> Kết nối Google Drive
          </a>
        )}
      </div>

      {state?.connected && tpl && (
        <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--border)" }}>
          <div className="mb-5">
            <label className="text-sm font-medium">Thư mục gốc trên Drive</label>
            <input
              value={rootName}
              onChange={(e) => setRootName(e.target.value)}
              placeholder="MStudo"
              className="mt-1.5 w-full max-w-xs rounded-lg px-3 py-1.5 text-sm"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            />
            <p className="mt-1 text-xs" style={{ color: "var(--text2)" }}>
              App tạo thư mục gốc này trong Drive của bạn; bên trong tự chia theo <b>loại dịch vụ</b> rồi <b>tháng</b> của ngày thực hiện.
              Sau khi tạo, bạn có thể <b>tự kéo thư mục gốc này vào bất kỳ đâu trong Drive</b> — app vẫn đồng bộ đúng.
              {state.rootCreated ? " Đổi tên ở đây sẽ đổi luôn trên Drive." : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FolderTree size={16} style={{ color: "var(--brand)" }} />
            <h3 className="text-base font-medium">Mẫu thư mục trong mỗi hợp đồng</h3>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--text2)" }}>
            Áp dụng cho hợp đồng tạo cây SAU khi lưu. Bỏ chọn “Đồng bộ Drive” để giữ thư mục chỉ ở máy (VD Raw, Video gốc).
          </p>
          {renderGroup("photo", "📷 Photo/")}
          {renderGroup("video", "🎬 Video/ (khi hợp đồng có quay)")}
          <button onClick={saveTemplate} disabled={busy} className="btn-primary mt-4 inline-flex items-center gap-2 text-sm">
            {busy ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
            {saved ? "Đã lưu" : "Lưu mẫu thư mục"}
          </button>
        </div>
      )}
    </div>
  );
}
