"use client";

/* Phần CÓ TƯƠNG TÁC của màn xem trước nhóm "sangtao" (./sangtao.tsx là file
 * server nên không truyền được hàm, không chạy được effect). Chỉ dùng ở /uipreview. */
import { useEffect, useRef } from "react";
import AlbumEditor, { type ADSize, type ADTpl, type SavedDesign } from "@/app/dashboard/studio/album-designer/AlbumEditor";

type FakeDesign = { id: string; name: string; size: ADSize; tpl: ADTpl; updated_at: string };
type FakeLib = { id: string; thumb: string; full: string; name: string; w?: number; h?: number };
type FakeData = { designs: FakeDesign[]; spreads: NonNullable<SavedDesign["spreads"]>; lib: FakeLib[] };

function json(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
}

/** Chặn đúng hai API của Thiết kế album và trả dữ liệu giả. Cài NGAY khi dựng
 *  (trước effect của con) để màn con gọi fetch lần đầu đã nhận dữ liệu giả. */
function installFakeDesignerApi(data: FakeData) {
  if (typeof window === "undefined") return;
  const w = window as Window & { __fakeDesigner?: FakeData };
  const first = !w.__fakeDesigner;
  w.__fakeDesigner = data;
  if (!first) return;
  const real = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const d = w.__fakeDesigner!;
    if (url.includes("/api/album-designer/designs")) {
      const id = new URL(url, location.href).searchParams.get("id");
      if ((init?.method ?? "GET") !== "GET") return json({ ok: true, id: id ?? "d-new" });
      if (id) {
        const one = d.designs.find((x) => x.id === id) ?? d.designs[0];
        return json({ design: { ...one, spreads: d.spreads, folder: "https://drive.google.com/drive/folders/demo" } });
      }
      return json({ designs: d.designs });
    }
    if (url.includes("/api/album-designer/photos")) return json({ photos: d.lib });
    return real(input, init);
  };
}

export function FakeDesignerApi({ data, children }: { data: FakeData; children: React.ReactNode }) {
  installFakeDesignerApi(data);
  return <>{children}</>;
}

/** Trình dàn trang mở sẵn một album đã lưu (nút "quay lại" không làm gì). */
export function DesignerEditorDemo({ data, empty = false }: { data: FakeData; empty?: boolean }) {
  installFakeDesignerApi(data);
  const d = data.designs[0];
  return (
    <AlbumEditor
      size={d.size}
      tpl={d.tpl}
      initial={empty ? null : { id: d.id, name: d.name, folder: "https://drive.google.com/drive/folders/demo", spreads: data.spreads }}
      onBack={() => {}}
    />
  );
}

/** Nạp sẵn vài ảnh giả (vẽ bằng canvas) vào ô chọn file của Slide cưới. */
export function SeedSlidePhotos({ count = 9, children }: { count?: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const input = ref.current?.querySelector<HTMLInputElement>('input[type="file"][accept="image/*"]');
    if (!input || !count) return;
    let alive = true;
    const make = (i: number) =>
      new Promise<File>((res) => {
        const land = i % 3 !== 2;
        const c = document.createElement("canvas");
        c.width = land ? 960 : 640;
        c.height = land ? 640 : 960;
        const g = c.getContext("2d")!;
        const gr = g.createLinearGradient(0, 0, c.width, c.height);
        gr.addColorStop(0, `hsl(${i * 47},45%,72%)`);
        gr.addColorStop(1, `hsl(${i * 47 + 40},40%,46%)`);
        g.fillStyle = gr;
        g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = "rgba(255,255,255,.3)";
        g.beginPath();
        g.arc(c.width / 2, c.height * 0.42, Math.min(c.width, c.height) * 0.2, 0, Math.PI * 2);
        g.fill();
        c.toBlob((b) => res(new File([b!], `anh-cuoi-${i}.png`, { type: "image/png" })), "image/png");
      });
    void Promise.all(Array.from({ length: count }, (_, i) => make(i + 1))).then((files) => {
      if (!alive) return;
      const dt = new DataTransfer();
      files.forEach((x) => dt.items.add(x));
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    return () => {
      alive = false;
    };
  }, [count]);
  return <div ref={ref}>{children}</div>;
}
