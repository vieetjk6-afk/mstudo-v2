import type { Metadata } from "next";
import WeddingEditor from "./WeddingEditor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chỉnh sửa thiệp cưới",
  robots: { index: false, follow: false },
};

export default async function EditWeddingPage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  return <WeddingEditor token={params.token} />;
}
