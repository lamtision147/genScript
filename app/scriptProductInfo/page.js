import NextScriptProductInfoPage from "@/components/next-script-product-info-page";

export default async function ScriptProductInfoPage({ searchParams }) {
  const params = await searchParams;
  return <NextScriptProductInfoPage initialHistoryId={params?.historyId || ""} />;
}
