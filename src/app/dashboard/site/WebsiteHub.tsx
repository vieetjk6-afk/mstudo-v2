"use client";

import Link from "next/link";
import { fmtDate } from "@/lib/date";
import { useState } from "react";
import {
  Globe,
  Bot,
  ExternalLink,
  Pencil,
  Eye,
  EyeOff,
  LayoutTemplate,
  MessageSquare,
  Copy,
  Check,
  Plus,
} from "lucide-react";

/**
 * Màn "Website & chatbox" (bản thiết kế, mục 43).
 * Trái: tình trạng trang + 3 con số lượt xem + danh sách khối nội dung.
 * Phải: trợ lý chatbox — lời chào và các dòng kịch bản đang dạy bot.
 * Sửa nội dung trang nằm ở trình tạo kéo-thả (/dashboard/site/builder).
 */
export default function WebsiteHub({
  host,
  liveUrl,
  published,
  updatedAt,
  stats,
  blocks,
  greeting,
  instructions,
}: {
  host: string;
  liveUrl: string;
  published: boolean;
  updatedAt: string;
  stats: { today: number; week: number; month: number };
  blocks: { id: string; label: string; visible: boolean }[];
  greeting: string;
  instructions: string;
}) {
  const [copied, setCopied] = useState(false);

  const panel = "rounded-[14px] px-[18px] py-4";
  const panelStyle = { background: "var(--sf)", border: "1px solid var(--bd)" } as const;
  const eyebrow = "text-[11px] font-extrabold uppercase";
  const eyebrowStyle = { letterSpacing: ".5px", color: "var(--tx3)" } as const;

  // Ngày cập nhật gần nhất, nói theo kiểu người đọc ("3 ngày trước").
  const ago = (() => {
    const d = new Date(updatedAt).getTime();
    if (!d) return "";
    const days = Math.floor((Date.now() - d) / 86400_000);
    if (days <= 0) return "hôm nay";
    if (days === 1) return "hôm qua";
    if (days < 30) return `${days} ngày trước`;
    return fmtDate(updatedAt);
  })();

  // Kịch bản chatbox: mỗi dòng gạch đầu dòng trong ô hướng dẫn là một luật.
  const rules = instructions
    .split("\n")
    .map((s) => s.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean);

  return (
    <div className="page-in grid items-start gap-3.5 min-[1180px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      {/* ══ Trái ═══════════════════════════════════════════════════════════ */}
      <div className="flex min-w-0 flex-col gap-3.5">

        {/* ── Tình trạng trang ─────────────────────────────────────────── */}
        <div className={panel} style={panelStyle}>
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px]"
              style={published ? { background: "var(--gnS)", color: "var(--gn)" } : { background: "var(--sf2)", color: "var(--tx3)" }}
            >
              <Globe size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold">{host || "Chưa đặt tên miền phụ"}</p>
              <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>
                {published ? "Đang hoạt động" : "Chưa xuất bản"}{ago ? ` · cập nhật ${ago}` : ""}
              </p>
            </div>
            {liveUrl && (
              <>
                <button
                  onClick={() => { navigator.clipboard?.writeText(liveUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="flex flex-none items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold"
                  style={{ border: "1px solid var(--bd)" }}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Đã chép" : "Chép link"}
                </button>
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-none items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold"
                  style={{ border: "1px solid var(--bd)" }}
                >
                  <ExternalLink size={15} /> Xem trang
                </a>
              </>
            )}
            <Link
              href="/dashboard/site/builder"
              className="flex flex-none items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold"
              style={{ background: "var(--ac)", color: "#fff" }}
            >
              <Pencil size={15} /> Sửa trang
            </Link>
          </div>

          <div className="mt-[15px] grid grid-cols-3 gap-2.5 pt-3.5" style={{ borderTop: "1px solid var(--bd2)" }}>
            {([
              [stats.today, "Lượt xem hôm nay"],
              [stats.week, "7 ngày qua"],
              [stats.month, "30 ngày qua"],
            ] as [number, string][]).map(([v, l]) => (
              <div key={l}>
                <p className="tnum text-[19px] font-bold" style={{ letterSpacing: "-.6px" }}>{v.toLocaleString("vi-VN")}</p>
                <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Khối nội dung trên trang ─────────────────────────────────── */}
        <div className={panel} style={panelStyle}>
          <div className="mb-3 flex items-center gap-2.5">
            <p className="text-[13.5px] font-bold">Khối nội dung trên trang</p>
            <span className="text-[11.5px]" style={{ color: "var(--tx3)" }}>
              {blocks.filter((b) => b.visible).length}/{blocks.length} đang hiện
            </span>
            <Link href="/dashboard/site/builder" className="ml-auto flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: "var(--ac)" }}>
              <Pencil size={13} /> Sắp xếp
            </Link>
          </div>

          {blocks.length === 0 ? (
            <div className="rounded-[11px] px-4 py-8 text-center" style={{ border: "1px dashed var(--bd)" }}>
              <LayoutTemplate size={26} style={{ color: "var(--tx3)", margin: "0 auto" }} />
              <p className="mt-2 text-[13px] font-semibold">Trang chưa có khối nào</p>
              <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                Mở trình tạo để chọn mẫu sẵn hoặc xếp từng khối: ảnh bìa, bộ sưu tập, bảng giá, liên hệ…
              </p>
              <Link
                href="/dashboard/site/builder"
                className="mt-3.5 inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-bold"
                style={{ background: "var(--ac)", color: "#fff" }}
              >
                <Plus size={16} /> Dựng trang
              </Link>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {blocks.map((b) => (
                <div key={b.id} className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5" style={{ border: "1px solid var(--bd)" }}>
                  {b.visible
                    ? <Eye size={16} style={{ flex: "none", color: "var(--tx2)" }} />
                    : <EyeOff size={16} style={{ flex: "none", color: "var(--tx3)" }} />}
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold" style={{ color: b.visible ? "var(--tx)" : "var(--tx3)" }}>
                    {b.label}
                  </span>
                  <span
                    className="flex-none whitespace-nowrap rounded-[20px] px-2 py-[3px] text-[10.5px] font-bold"
                    style={b.visible ? { background: "var(--gnS)", color: "var(--gn)" } : { background: "var(--sf2)", color: "var(--tx3)" }}
                  >
                    {b.visible ? "Đang hiện" : "Đang ẩn"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ Phải — trợ lý chatbox ══════════════════════════════════════════ */}
      <div className={`${panel} min-[1180px]:sticky min-[1180px]:top-[76px]`} style={panelStyle}>
        <div className="mb-1 flex items-center gap-2.5">
          <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
            <Bot size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold">Trợ lý chatbox</p>
            <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>Trả lời khách 24/7 theo kịch bản của bạn</p>
          </div>
        </div>

        <p className={`mb-2 mt-3.5 ${eyebrow}`} style={eyebrowStyle}>Lời chào mở đầu</p>
        <p className="rounded-[10px] px-3 py-2.5 text-[12.5px] leading-relaxed" style={{ background: "var(--sf2)", color: "var(--tx2)", textWrap: "pretty" }}>
          {greeting.trim() || "Xin chào! Studio có thể giúp gì cho anh/chị hôm nay?"}
        </p>

        <p className={`mb-1 mt-4 ${eyebrow}`} style={eyebrowStyle}>Kịch bản trả lời</p>
        {rules.length === 0 ? (
          <p className="py-2 text-[12.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
            Chưa dạy bot điều gì. Bot vẫn biết dịch vụ &amp; bảng giá của studio, nhưng chưa có chính sách cọc,
            thời gian giao ảnh hay giọng văn riêng.
          </p>
        ) : (
          rules.slice(0, 6).map((r, i) => (
            <div key={i} className="flex gap-2.5 py-[9px]" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <MessageSquare size={14} style={{ flex: "none", marginTop: 2, color: "var(--tx3)" }} />
              <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{r}</p>
            </div>
          ))
        )}
        {rules.length > 6 && (
          <p className="mt-2 text-[11.5px]" style={{ color: "var(--tx3)" }}>… và {rules.length - 6} dòng nữa</p>
        )}

        <Link
          href="/dashboard/studio/chatbox"
          className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[12.5px] font-bold"
          style={{ border: "1.5px dashed var(--bd)", color: "var(--tx2)" }}
        >
          <Pencil size={15} /> {rules.length === 0 ? "Dạy bot trả lời" : "Sửa kịch bản"}
        </Link>
      </div>
    </div>
  );
}
