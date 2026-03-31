import NextVideoScriptPage from "@/components/next-video-script-page";

export default async function ScriptVideoReviewPage({ searchParams }) {
  const params = await searchParams;
  return <NextVideoScriptPage initialHistoryId={params?.historyId || ""} />;
}
