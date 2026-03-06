export interface ScheduledEvent {
  id: string;
  eventUniqueId: string;
  guildId: string;
  channelId: string;
  postAt: number;
  status: "pending" | "posting" | "posted" | "failed" | "cancelled";
  createdBy: string;
  retryCount: number;
  errorMessage: string | null;
  messageId: string | null;
  postedAt: number | null;
  trackMapPath: string | null;
  createdAt: string;
}
