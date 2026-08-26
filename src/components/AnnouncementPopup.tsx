"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtDateTime } from "@/lib/date";
import { Megaphone, X, BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Announcement = {
  id: string;
  message: string;
  important: boolean;
  created_at: string;
};

/**
 * Bảng thông báo hệ thống nổi. Hiện ngay khi đăng nhập/đang dùng nếu có thông
 * báo (kind='announcement') chưa đọc:
 *   - Thông báo quan trọng (important) → popup nổi giữa màn hình, phải bấm "Đã hiểu".
 *   - Thông báo thường → thẻ nổi góc dưới phải, có thể đóng từng cái.
 * Đóng = đánh dấu đã đọc. Cập nhật realtime khi có thông báo mới.
 */
export default function AnnouncementPopup() {
  const [items, setItems] = useState<Announcement[]>([]);

  const load = useCallback(async () => {
    const supabase = createClient();
    // QUAN TRỌNG: lọc theo owner_id của chính mình. Admin (RLS is_admin) mặc định
    // thấy thông báo của MỌI tài khoản → nếu không lọc sẽ hiện hàng loạt bản sao.
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setItems([]);
      return;
    }
    const { data, error } = await supabase
      .from("studio_notifications")
      .select("id, message, important, created_at")
      .eq("owner_id", uid)
      .eq("kind", "announcement")
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      // Cột "important" có thể chưa được thêm — thử lại không kèm cột đó.
      const { data: d2 } = await supabase
        .from("studio_notifications")
        .select("id, message, created_at")
        .eq("owner_id", uid)
        .eq("kind", "announcement")
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(20);
      setItems(((d2 ?? []) as Omit<Announcement, "important">[]).map((n) => ({ ...n, important: false })));
      return;
    }
    setItems((data ?? []) as Announcement[]);
  }, []);

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel("announce-popup")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "studio_notifications" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const dismiss = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    setItems((prev) => prev.filter((n) => !ids.includes(n.id)));
    const supabase = createClient();
    await supabase.from("studio_notifications").update({ read: true }).in("id", ids);
  }, []);

  const important = items.filter((n) => n.important);
  const normal = items.filter((n) => !n.important);

  return (
    <>
      {/* Popup quan trọng — bắt buộc xác nhận */}
      {important.length > 0 && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(2px)" }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl p-6 shadow-2xl animate-[vkFade_.3s_ease_both]"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="mb-3 flex items-center gap-2.5">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: "var(--s-redS, rgba(224,116,111,.14))", color: "var(--danger)" }}
              >
                <BellRing size={20} />
              </span>
              <h2 className="font-serif text-lg font-medium">Thông báo quan trọng</h2>
            </div>
            <div className="-mr-1 space-y-3 overflow-y-auto pr-1">
              {important.map((n) => (
                <div key={n.id}>
                  <p className="whitespace-pre-wrap text-sm" style={{ color: "var(--text)" }}>{n.message}</p>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>
                    {fmtDateTime(n.created_at)}
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={() => dismiss(important.map((n) => n.id))}
              className="btn-primary mt-5 w-full flex-shrink-0 justify-center"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      {/* Thẻ nổi góc dưới phải — thông báo thường */}
      {normal.length > 0 && (
        <div className="fixed bottom-20 right-4 z-[80] flex w-[min(92vw,360px)] flex-col gap-2 md:bottom-4 md:right-20">
          {normal.map((n) => (
            <div
              key={n.id}
              className="rounded-xl p-4 shadow-lg animate-[vkFade_.3s_ease_both]"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-start gap-2.5">
                <Megaphone size={17} style={{ color: "#c78bd1", flex: "none" }} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>Thông báo hệ thống</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[13px]" style={{ color: "var(--text2)" }}>{n.message}</p>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>
                    {fmtDateTime(n.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => dismiss([n.id])}
                  className="shrink-0 rounded-md p-1 transition-colors hover:bg-[var(--surface2)]"
                  aria-label="Đóng"
                  style={{ color: "var(--text3)" }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
