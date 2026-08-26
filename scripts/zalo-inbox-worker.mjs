/**
 * TIẾN TRÌNH LẮNG NGHE ZALO CÁ NHÂN → đẩy tin về hộp thư hợp nhất.
 *
 * VÌ SAO CẦN MỘT TIẾN TRÌNH RIÊNG
 *   Zalo cá nhân không có webhook. Muốn NHẬN tin phải giữ một websocket sống,
 *   mà app chạy trên Vercel serverless — hết hàm là tắt. Việc GỬI thì không cần
 *   (khôi phục phiên từ cookie rồi gọi API là xong), nên chỉ phần nhận phải
 *   chạy ngoài: trên máy tính của studio, hoặc một VPS nhỏ.
 *
 * ⚠️ RỦI RO: tự động hoá tài khoản Zalo cá nhân VI PHẠM điều khoản của Zalo và
 *    có thể bị KHOÁ tài khoản. Chỉ dùng khi studio đã hiểu và chấp nhận.
 *
 * CÁCH CHẠY
 *   npm i zca-js @supabase/supabase-js
 *   export NEXT_PUBLIC_SUPABASE_URL=...        # cùng project với app
 *   export SUPABASE_SERVICE_ROLE_KEY=...
 *   export ZALO_SESSION_SECRET=...             # đúng khoá app dùng để mã hoá phiên
 *   export MSTUDO_URL=https://ten-mien-cua-ban
 *   export INBOX_INGEST_SECRET=...             # trùng với biến cùng tên trên app
 *   node scripts/zalo-inbox-worker.mjs
 *
 * Worker tự tìm MỌI studio đang có kênh `zalo_personal` ở trạng thái connected
 * và mở một phiên lắng nghe cho từng studio. Studio nào phiên hỏng thì ghi log
 * và bỏ qua — một tài khoản hết hạn không được làm chết cả tiến trình.
 */
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = (process.env.MSTUDO_URL || "").replace(/\/+$/, "");
const INGEST_SECRET = process.env.INBOX_INGEST_SECRET;

for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  MSTUDO_URL: APP_URL,
  INBOX_INGEST_SECRET: INGEST_SECRET,
})) {
  if (!value) {
    console.error(`Thiếu biến môi trường ${name}. Xem phần hướng dẫn ở đầu file.`);
    process.exit(1);
  }
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/* ── Giải mã phiên Zalo ─────────────────────────────────────────────────────
   Cùng thuật toán với src/lib/zalo/crypto.ts (AES-256-GCM, khoá = sha256 của
   ZALO_SESSION_SECRET). Cố ý CHÉP LẠI thay vì gọi một endpoint xin phiên: một
   endpoint phát cookie đăng nhập Zalo ra ngoài là thứ không nên tồn tại. */
function sessionKey() {
  const secret =
    process.env.ZALO_SESSION_SECRET || process.env.OAUTH_STATE_SECRET || SERVICE_KEY;
  return crypto.createHash("sha256").update(secret).digest();
}

function decryptSession(blob) {
  if (!blob) return null;
  const parts = String(blob).split(".");
  if (parts.length !== 3) return null;
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      sessionKey(),
      Buffer.from(parts[0], "base64")
    );
    decipher.setAuthTag(Buffer.from(parts[1], "base64"));
    const out = Buffer.concat([decipher.update(Buffer.from(parts[2], "base64")), decipher.final()]);
    return JSON.parse(out.toString("utf8"));
  } catch {
    return null;
  }
}

/* ── Đẩy một tin về app ──────────────────────────────────────────────────── */
async function pushToInbox(payload) {
  try {
    const res = await fetch(`${APP_URL}/api/inbox/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${INGEST_SECRET}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`  ✗ đẩy tin hỏng (${res.status}):`, (await res.text()).slice(0, 200));
      return false;
    }
    return true;
  } catch (e) {
    console.error("  ✗ không gọi được app:", e?.message);
    return false;
  }
}

/* ── Một studio = một phiên lắng nghe ───────────────────────────────────── */
async function listenFor(channel) {
  const { data: zalo } = await db
    .from("studio_zalo")
    .select("personal_session, personal_self, status")
    .eq("owner_id", channel.owner_id)
    .maybeSingle();

  const session = decryptSession(zalo?.personal_session);
  if (!session) {
    console.error(`✗ ${channel.name || channel.owner_id}: chưa có phiên Zalo cá nhân hợp lệ`);
    return;
  }

  const mod = await import("zca-js");
  const Zalo = mod.Zalo || mod.default?.Zalo || mod.default;
  const zaloClient = new Zalo({ checkUpdate: false, logging: false });
  const api = await zaloClient.login({
    cookie: session.cookie,
    imei: session.imei,
    userAgent: session.userAgent,
  });

  const selfId = String(zalo?.personal_self?.id ?? channel.external_id);

  api.listener.on("message", async (msg) => {
    try {
      // Tin do CHÍNH tài khoản này gửi (kể cả tin app vừa gửi đi) — bỏ, nếu
      // không AI sẽ trả lời chính mình thành vòng lặp.
      if (msg?.isSelf) return;
      // Chỉ hội thoại 1-1. ThreadType.Group = 1.
      if (msg?.type === 1) return;

      const uid = String(msg?.data?.uidFrom ?? msg?.threadId ?? "");
      if (!uid || uid === selfId) return;

      const content = msg?.data?.content;
      const text = typeof content === "string" ? content : content?.title || "";
      const attachments = [];
      if (content && typeof content === "object" && content.href) {
        attachments.push({ type: msg?.data?.msgType === "chat.photo" ? "image" : "file", url: content.href });
      }
      if (!text && attachments.length === 0) return;

      const ok = await pushToInbox({
        platform: "zalo_personal",
        channelId: channel.external_id,
        messageId: msg?.data?.msgId ? String(msg.data.msgId) : undefined,
        from: { id: uid, name: msg?.data?.dName || null },
        text,
        attachments,
      });
      if (ok) console.log(`  → ${channel.name || channel.owner_id}: tin từ ${msg?.data?.dName || uid}`);
    } catch (e) {
      console.error("  ✗ lỗi xử lý tin:", e?.message);
    }
  });

  api.listener.on("error", (e) => {
    console.error(`✗ ${channel.name || channel.owner_id}: lỗi kết nối —`, e?.message || e);
  });

  api.listener.start();
  console.log(`✓ đang nghe: ${channel.name || channel.owner_id} (uid ${selfId})`);
}

/* ── Chạy ────────────────────────────────────────────────────────────────── */
const { data: channels, error } = await db
  .from("inbox_channels")
  .select("id, owner_id, external_id, name")
  .eq("platform", "zalo_personal")
  .eq("status", "connected");

if (error) {
  console.error("Không đọc được danh sách kênh:", error.message);
  process.exit(1);
}
if (!channels?.length) {
  console.log("Chưa studio nào nối kênh Zalo cá nhân. Thoát.");
  process.exit(0);
}

console.log(`Tìm thấy ${channels.length} kênh Zalo cá nhân.`);
for (const channel of channels) {
  try {
    await listenFor(channel);
  } catch (e) {
    // Một tài khoản hết hạn KHÔNG được làm chết cả tiến trình — các studio khác
    // vẫn phải tiếp tục nhận tin.
    console.error(`✗ ${channel.name || channel.owner_id}: ${e?.message}`);
  }
}
console.log("Đang chạy. Ctrl+C để dừng.");
