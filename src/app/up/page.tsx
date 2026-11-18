import type { Metadata } from "next";
import { MAX_FILES, MAX_FILE_MB, pinRequired } from "@/lib/quick-share";
import UploadBox from "./UploadBox";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gửi file nhanh",
  description: "Tải file lên, nhận link rút gọn để tải về. File tự xoá sau 30 phút.",
  robots: { index: false, follow: false },
};

/** vieetjk.com/up — tải 1 hoặc nhiều file lên, nhận một link rút gọn. */
export default function UploadPage() {
  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-semibold text-center">Gửi file nhanh</h1>
        <p className="mt-1 mb-6 text-center text-sm text-neutral-400">
          Tối đa {MAX_FILES} file, mỗi file {MAX_FILE_MB}MB · Link tự hết hạn sau 30 phút
        </p>
        <UploadBox needPin={pinRequired()} maxFiles={MAX_FILES} maxMb={MAX_FILE_MB} />
      </div>
    </main>
  );
}
