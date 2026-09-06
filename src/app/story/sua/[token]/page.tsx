import type { Metadata } from "next";
import StoryEditor from "./StoryEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Chỉnh sửa Love Story", robots: { index: false, follow: false } };

export default async function EditStoryPage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  return <StoryEditor token={params.token} />;
}
