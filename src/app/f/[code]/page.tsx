import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readManifest } from "@/lib/quick-share";
import Countdown from "./Countdown";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tải file",
  robots: { index: false, follow: false },
};

function fmtSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/**
 * /f/<mã> — link rút gọn. Một file: tải luôn. Nhiều file: hiện danh sách để
 * bấm tải từng file. Quá 30 phút: báo hết hạn.
 */
export default async function SharePage(props: { params: Promise<{ code: string }> }) {
  const { code } = await props.params;
  const m = await readManifest(code);
  const alive = !!m && Date.now() <= m.expiresAt;

  if (alive && m!.files.length === 1) redirect(`/f/${code}/0`);

  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
        {!alive ? (
          <div className="text-center">
            <div className="text-5xl mb-3">⌛</div>
            <h1 className="text-xl font-semibold">Link đã hết hạn hoặc không tồn tại</h1>
            <p className="mt-2 text-sm text-neutral-400">File chỉ được giữ trong 30 phút sau khi tải lên.</p>
            <a href="/up" className="mt-6 inline-block rounded-lg bg-red-700 px-4 py-2 text-sm font-medium hover:bg-red-600">
              Gửi file mới
            </a>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold">{m!.files.length} file</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Hết hạn sau <Countdown expiresAt={m!.expiresAt} />
            </p>
            <ul className="mt-5 divide-y divide-neutral-800">
              {m!.files.map((f, i) => (
                <li key={i} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{f.name}</div>
                    <div className="text-xs text-neutral-500">{fmtSize(f.size)}</div>
                  </div>
                  <a
                    href={`/f/${code}/${i}`}
                    className="shrink-0 rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium hover:bg-red-600"
                  >
                    Tải về
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
