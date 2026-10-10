"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Download, X, Construction, Gift, BadgeCheck, Copy, Check, ExternalLink, Crown, Info } from "lucide-react";
import { Modal } from "@/components/studio/Modal";
import { Pill, TONE, type ToneKey } from "@/components/studio/ui";
import { fmtDate } from "@/lib/date";
import { ALBUMAI_GIFT_YEARS, ALBUMAI_HIDE_COOKIE, ALBUMAI_HOST_LABEL, ALBUMAI_URL, type AlbumAiStatus } from "@/lib/albumai";

/* ═══════════════════════════════════════════════════════════════════════════
   THẺ GIỚI THIỆU ALBUM AI + HỘP THOẠI "TẢI ALBUM AI".

   Bấm "Tải Album AI" KHÔNG tải ngay mà mở hộp thoại trước, vì hai điều người
   dùng phải đọc TRƯỚC khi cài:
     1. Phần mềm đang trong giai đoạn phát triển.
     2. Bản quyền gắn với EMAIL — phải đăng nhập Album AI bằng đúng email tài
        khoản mstudo thì mới được kích hoạt (xem src/lib/albumai.ts). Đăng nhập
        bằng email khác là không nhận được bản quyền tặng, và người dùng sẽ nghĩ
        là lỗi.
   ═══════════════════════════════════════════════════════════════════════════ */

type Props = {
  status: AlbumAiStatus;
  /** Email phải dùng để đăng nhập Album AI (email chủ studio). null với nhân viên. */
  email: string | null;
  /** Cho phép ẩn thẻ (trang Tổng quan). Màn Thiết kế album / Slide luôn hiện. */
  dismissible?: boolean;
};

const STATE_TONE: Record<AlbumAiStatus["state"], ToneKey> = {
  active: "green",
  ready: "brand",
  trial: "amber",
  upgrade: "amber",
  expired: "gray",
  staff: "gray",
};

/** Một dòng tình trạng bản quyền ngay trên thẻ. */
function statusLine(s: AlbumAiStatus): string {
  switch (s.state) {
    case "active":
      return `Bản quyền đã kích hoạt — dùng đến ${fmtDate(s.expiresAt)}`;
    case "ready":
      return `Bạn được tặng ${ALBUMAI_GIFT_YEARS} năm bản quyền — đăng nhập Album AI bằng email mstudo để kích hoạt`;
    case "trial":
      return "Bản dùng thử Studio chưa kèm bản quyền — lên gói Studio trả phí để nhận quà";
    case "upgrade":
      return `Tặng ${ALBUMAI_GIFT_YEARS} năm bản quyền khi dùng gói Studio`;
    case "expired":
      return `Bản quyền tặng đã hết hạn ngày ${fmtDate(s.expiresAt)}`;
    case "staff":
      return "Bản quyền gắn với email tài khoản chủ studio";
  }
}

export default function AlbumAiPromo({ status, email, dismissible = false }: Props) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const tone = TONE[STATE_TONE[status.state]];
  const needUpgrade = status.state === "upgrade" || status.state === "trial";

  function hide() {
    try {
      document.cookie = `${ALBUMAI_HIDE_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    } catch {
      /* chặn cookie thì chỉ ẩn trong lần mở này */
    }
    setHidden(true);
  }

  return (
    <>
      <div
        data-testid="albumai-promo"
        className="flex flex-wrap items-start gap-x-4 gap-y-3 rounded-[14px] px-4 py-3.5 min-[700px]:items-center"
        style={{
          background: "linear-gradient(120deg, var(--acS), var(--sf) 70%)",
          border: "1px solid var(--bd)",
        }}
      >
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px]" style={{ background: "var(--ac)", color: "#fff" }}>
          <Sparkles size={20} />
        </span>
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[14px] font-bold">Album AI — thiết kế album &amp; slide ảnh bằng AI</p>
            <Pill tone="amber">Đang phát triển</Pill>
          </div>
          <p className="mt-0.5 text-[12.5px] leading-[1.5]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
            Phần mềm {ALBUMAI_HOST_LABEL}: AI tự chọn ảnh đẹp, dàn trang album in và dựng slide ảnh cưới trong vài phút.{" "}
            <b style={{ color: "var(--tx)" }}>Tặng {ALBUMAI_GIFT_YEARS} năm bản quyền cho gói Studio.</b>
          </p>
          <p className="mt-1 flex items-start gap-1.5 text-[11.5px] font-semibold" style={{ color: tone.fg }}>
            {status.state === "active" ? <BadgeCheck size={14} className="mt-px flex-none" /> : <Gift size={14} className="mt-px flex-none" />}
            {statusLine(status)}
          </p>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2">
          {needUpgrade && (
            <Link
              href="/dashboard/upgrade"
              className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold"
              style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
            >
              <Crown size={16} /> Nâng cấp Studio
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-[15px] py-2.5 text-[13px] font-semibold"
            style={{ background: "var(--ac)", color: "#fff" }}
          >
            <Download size={16} /> Tải Album AI
          </button>
          {dismissible && (
            <button
              type="button"
              onClick={hide}
              aria-label="Ẩn giới thiệu Album AI"
              title="Ẩn giới thiệu Album AI"
              className="flex-none rounded-[9px] p-2"
              style={{ color: "var(--tx3)", lineHeight: 0 }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {open && <AlbumAiDownloadDialog status={status} email={email} onClose={() => setOpen(false)} />}
    </>
  );
}

function AlbumAiDownloadDialog({ status, email, onClose }: Props & { onClose: () => void }) {
  return (
    <Modal onClose={onClose} labelledBy="albumai-dl-title" maxWidth={520}>
      <div className="flex items-center gap-2 px-[18px] py-3.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
        <Sparkles size={18} style={{ color: "var(--ac)" }} />
        <h2 id="albumai-dl-title" className="flex-1 text-[15px] font-bold">Tải Album AI</h2>
        <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-[8px] p-1.5" style={{ color: "var(--tx3)", lineHeight: 0 }}>
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto px-[18px] py-4">
        <Notice tone="amber" icon={Construction} title="Phần mềm đang trong giai đoạn phát triển">
          Album AI vẫn đang được hoàn thiện — một số tính năng có thể chưa ổn định hoặc còn thay đổi giữa các bản cập nhật.
          Gặp lỗi hay có góp ý, bạn nhắn nhóm hỗ trợ mstudo giúp nhé.
        </Notice>
        <LicenseNotice status={status} email={email} />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 px-[18px] py-3" style={{ borderTop: "1px solid var(--bd2)" }}>
        <button
          type="button"
          onClick={onClose}
          className="rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold"
          style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
        >
          Đóng
        </button>
        <a
          href={ALBUMAI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-[15px] py-2.5 text-[13px] font-semibold"
          style={{ background: "var(--ac)", color: "#fff" }}
        >
          <ExternalLink size={16} /> Đã hiểu, tới trang tải
        </a>
      </div>
    </Modal>
  );
}

/** Khối "bản quyền" của hộp thoại — nói đúng một việc người dùng phải làm. */
function LicenseNotice({ status, email }: Pick<Props, "status" | "email">) {
  const upgradeLink = (
    <Link href="/dashboard/upgrade" className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--ac)" }}>
      <Crown size={14} /> Xem gói Studio
    </Link>
  );

  switch (status.state) {
    case "ready":
      return (
        <Notice tone="brand" icon={Gift} title={`Bạn được tặng ${ALBUMAI_GIFT_YEARS} năm bản quyền Album AI`}>
          Cài xong, hãy <b>đăng nhập Album AI bằng tài khoản có email trùng với email mstudo</b> của bạn — bản quyền sẽ tự
          kích hoạt ngay lần đăng nhập đầu tiên, tính {ALBUMAI_GIFT_YEARS} năm từ lúc đó.
          {email && <EmailChip email={email} />}
        </Notice>
      );
    case "active":
      return (
        <Notice tone="green" icon={BadgeCheck} title="Bản quyền Album AI đã kích hoạt">
          Đăng nhập Album AI bằng tài khoản có email trùng với email mstudo để dùng bản quyền — hạn dùng đến{" "}
          <b>{fmtDate(status.expiresAt)}</b>.
          {email && <EmailChip email={email} />}
        </Notice>
      );
    case "trial":
      return (
        <Notice tone="amber" icon={Info} title="Bản dùng thử chưa kèm bản quyền Album AI">
          Bản quyền {ALBUMAI_GIFT_YEARS} năm được tặng khi tài khoản lên <b>gói Studio trả phí</b>. Sau khi nâng cấp, đăng
          nhập Album AI bằng tài khoản có email trùng với email mstudo để được kích hoạt.
          {email && <EmailChip email={email} />}
          <div>{upgradeLink}</div>
        </Notice>
      );
    case "upgrade":
      return (
        <Notice tone="amber" icon={Crown} title="Nâng cấp gói Studio để nhận bản quyền">
          Bản quyền Album AI được tặng {ALBUMAI_GIFT_YEARS} năm cho tài khoản <b>gói Studio</b>. Gói hiện tại của bạn chưa
          kèm bản quyền — nâng cấp lên Studio, rồi đăng nhập Album AI bằng tài khoản có email trùng với email mstudo để
          được kích hoạt.
          {email && <EmailChip email={email} />}
          <div>{upgradeLink}</div>
        </Notice>
      );
    case "expired":
      return (
        <Notice tone="gray" icon={Info} title="Bản quyền tặng đã hết hạn">
          {ALBUMAI_GIFT_YEARS} năm bản quyền Album AI tặng kèm gói Studio đã hết hạn ngày {fmtDate(status.expiresAt)}.
          Liên hệ mstudo để gia hạn.
        </Notice>
      );
    case "staff":
      return (
        <Notice tone="gray" icon={Info} title="Bản quyền gắn với email chủ studio">
          Bản quyền Album AI tặng kèm gói Studio được kích hoạt khi đăng nhập Album AI bằng tài khoản có email trùng với
          <b> email tài khoản mstudo của chủ studio</b>. Nhờ chủ studio đăng nhập để kích hoạt.
        </Notice>
      );
  }
}

function Notice({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: ToneKey;
  icon: typeof Info;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5 rounded-[12px] px-3.5 py-3" style={{ background: TONE[tone].soft, border: "1px solid var(--bd)" }}>
      <Icon size={18} style={{ flex: "none", marginTop: 1, color: TONE[tone].fg }} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold" style={{ color: TONE[tone].fg }}>{title}</p>
        <div className="mt-0.5 text-[12.5px] leading-[1.55]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{children}</div>
      </div>
    </div>
  );
}

/** Email phải dùng để đăng nhập — kèm nút chép, vì gõ lại một email dài là chỗ dễ sai nhất. */
function EmailChip({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* trình duyệt chặn clipboard: email vẫn hiện để chép tay */
    }
  }
  return (
    <span className="mt-2 flex max-w-full items-center gap-2 rounded-[9px] px-2.5 py-1.5" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" style={{ color: "var(--tx)" }}>{email}</span>
      <button type="button" onClick={copy} className="flex flex-none items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--ac)" }}>
        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Đã chép" : "Chép"}
      </button>
    </span>
  );
}
