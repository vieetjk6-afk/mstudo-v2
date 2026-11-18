/* Dùng chung cho scripts/chay-sql.mjs và scripts/do-luu-luong-vercel.mjs. */

/**
 * Tách chuỗi kết nối thành biến PG* cho psql — mật khẩu KHÔNG nằm trên dòng lệnh
 * và không bao giờ được in ra. Chịu được mật khẩu dán thô có ký tự đặc biệt
 * (@ : / #): lấy dấu @ CUỐI CÙNG trước tên máy chủ làm ranh giới.
 */
export function tachUrl(raw) {
  const m = raw.match(/^postgres(?:ql)?:\/\/([^:@/]+)(?::(.*))?@([^@/?#:]+)(?::(\d+))?\/([^?#]*)(?:\?([^#]*))?$/s);
  if (!m) return null;
  const giai = (s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  const q = new URLSearchParams(m[6] || "");
  return {
    user: giai(m[1]),
    password: m[2] != null ? giai(m[2]) : "",
    // `?host=` (thư mục unix socket) và `?port=` đè lên phần trước — như libpq.
    host: q.get("host") || m[3],
    port: q.get("port") || m[4] || "5432",
    database: giai(m[5] || "postgres") || "postgres",
    sslmode: q.get("sslmode") || "",
  };
}

/** Biến môi trường PG* cho psql từ chuỗi kết nối đã tách (mật khẩu không lên dòng lệnh). */
export function pgEnv(ket, appName) {
  return {
    ...process.env,
    PGHOST: ket.host,
    PGPORT: ket.port,
    PGUSER: ket.user,
    PGDATABASE: ket.database,
    PGPASSWORD: ket.password,
    PGCONNECT_TIMEOUT: "20",
    PGAPPNAME: appName,
    PGCLIENTENCODING: "UTF8",
    ...(ket.sslmode ? { PGSSLMODE: ket.sslmode } : {}),
  };
}
