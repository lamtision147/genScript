"use client";

import NextSupportChatWidget from "@/components/next-support-chat-widget";

export default function NextSupportChatShell({
  language = "vi",
  page = "unknown",
  user = null,
  context = {}
}) {
  return (
    <NextSupportChatWidget
      language={language}
      page={page}
      user={user}
      context={context}
      isAuthenticated={Boolean(user?.id)}
    />
  );
}
