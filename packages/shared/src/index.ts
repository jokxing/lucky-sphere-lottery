export type JoinMode = "IMPORT_ONLY" | "OPEN_SIGNUP" | "BOTH";

export type ParticipantSource = "IMPORT" | "SIGNUP";

export type EventPublic = {
  id: string;
  title: string;
  joinMode: JoinMode;
  createdAt: string;
};


