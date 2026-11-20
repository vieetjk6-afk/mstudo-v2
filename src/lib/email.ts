import "server-only";
import { noStoreFetch } from "@/lib/no-store-fetch";

/**
 * Gửi email giao dịch. Hai đường, chọn theo biến môi trường trên Vercel:
 *
 *  1. SMTP — Gmail / Google Workspace (hoặc Brevo, Zoho… bất kỳ SMTP nào):
 *       SMTP_USER   địa chỉ Gmail gửi đi
 *       SMTP_PASS   MẬT KHẨU ỨNG DỤNG của Gmail (không phải mật khẩu đăng nhập)
 *       SMTP_HOST   mặc định smtp.gmail.com
 *       SMTP_PORT   mặc định 465 (SSL); 587 thì dùng STARTTLS
 *  2. Resend — RESEND_API_KEY (+ EMAIL_FROM), như trước.
 *
 * Có SMTP thì dùng SMTP; không có thì Resend; không có gì thì trả
 * { ok: false, error: "not_configured" } để nơi gọi báo nhẹ nhàng thay vì hỏng.
 *
 * `fromName`: tên hiện ở ô người gửi (vd tên studio). Gmail bắt buộc địa chỉ
 * gửi là chính tài khoản SMTP_USER, nhưng TÊN hiển thị thì đổi được — khách
 * thấy "Studio A <studio@gmail.com>" thay vì một cái tên chung chung.
 */
export async function sendEmail({
  to,
  subject,
  html,
  fromName,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  fromName?: string | null;
  replyTo?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return viaSmtp({ to, subject, html, fromName, replyTo });
  if (process.env.RESEND_API_KEY) return viaResend({ to, subject, html, fromName, replyTo });
  return { ok: false, error: "not_configured" };
}

/** Tên hiển thị an toàn cho tiêu đề From: bỏ ký tự có thể phá cú pháp header. */
const cleanName = (s: string | null | undefined) => (s || "").replace(/["<>\r\n\\]/g, "").trim().slice(0, 80);

/** Giữ lại kết nối SMTP giữa các lượt gửi trong cùng một lần chạy (cron gửi nhiều thư). */
let transport: import("nodemailer").Transporter | null = null;

async function viaSmtp(m: {
  to: string;
  subject: string;
  html: string;
  fromName?: string | null;
  replyTo?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const user = process.env.SMTP_USER!.trim();
  const port = Number(process.env.SMTP_PORT) || 465;
  try {
    if (!transport) {
      const nodemailer = (await import("nodemailer")).default;
      transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
        port,
        secure: port === 465,
        // Mật khẩu ứng dụng Gmail hiện ra kiểu "abcd efgh ijkl mnop" — bỏ dấu cách.
        auth: { user, pass: process.env.SMTP_PASS!.replace(/\s+/g, "") },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
    }
    const name = cleanName(m.fromName) || cleanName(process.env.EMAIL_FROM_NAME) || "mstudo";
    await transport.sendMail({
      from: { name, address: user },
      to: m.to,
      subject: m.subject,
      html: m.html,
      ...(m.replyTo ? { replyTo: m.replyTo } : {}),
    });
    return { ok: true };
  } catch (e) {
    // Kết nối hỏng thì lần sau dựng lại từ đầu, đừng giữ transport chết.
    transport = null;
    const err = e as { code?: string; responseCode?: number; message?: string };
    console.error(`[email] SMTP lỗi ${err.code ?? ""} ${err.responseCode ?? ""}: ${err.message ?? e}`);
    return { ok: false, error: `smtp_${err.responseCode ?? err.code ?? "error"}` };
  }
}

async function viaResend(m: {
  to: string;
  subject: string;
  html: string;
  fromName?: string | null;
  replyTo?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const fallback = process.env.EMAIL_FROM || "mstudo <onboarding@resend.dev>";
  // EMAIL_FROM dạng "Tên <dia@chi>" — thay riêng phần tên khi có fromName.
  const addr = /<([^>]+)>/.exec(fallback)?.[1] ?? fallback;
  const from = cleanName(m.fromName) ? `${cleanName(m.fromName)} <${addr}>` : fallback;

  // noStoreFetch: hai mail giong het nhau thi lan thu hai bi Data Cache cua
  // Next nuot va KHONG BAO GIO duoc gui. Xem @/lib/no-store-fetch.
  const res = await noStoreFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: m.to, subject: m.subject, html: m.html, ...(m.replyTo ? { reply_to: m.replyTo } : {}) }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: t || `http_${res.status}` };
  }
  return { ok: true };
}
