import { notFound } from "next/navigation";
import { TimelineShell } from "@/components/timeline/timeline-shell";
import { getResearchTimeline } from "@/data/research-corpus";
import { getMessages } from "@/i18n";
import { isLocale } from "@/i18n/config";

export default async function TimelinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const timeline = getResearchTimeline(locale);
  return <TimelineShell locale={locale} messages={messages} timeline={timeline} />;
}
