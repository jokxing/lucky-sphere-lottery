function adminKey() {
  return localStorage.getItem("ADMIN_KEY") || "";
}

export class ApiError<T = any> extends Error {
  code: string;
  status: number;
  data: T;
  constructor(code: string, status: number, data: T) {
    super(code);
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

async function request<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json");
  const key = adminKey();
  if (key) headers.set("x-admin-key", key);

  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(String(data?.error || `HTTP_${res.status}`), res.status, data);
  }
  return data as T;
}

export const api = {
  // demo
  demoBootstrap: () => request<any>("/api/demo/bootstrap", { method: "POST", body: JSON.stringify({}) }),
  demoState: (eventId: string) => request<any>(`/api/demo/events/${eventId}/state`),
  demoDraw: (eventId: string, payload: { prizeId: string; count?: number; seed?: string }) =>
    request<any>(`/api/demo/events/${eventId}/draw`, { method: "POST", body: JSON.stringify(payload) }),

  // admin
  listEvents: () => request<Array<any>>("/api/admin/events"),
  createEvent: (payload: {
    title: string;
    joinMode: "IMPORT_ONLY" | "OPEN_SIGNUP" | "BOTH";
    accessCode?: string | null;
    resultsPublic?: boolean;
  }) =>
    request<any>("/api/admin/events", { method: "POST", body: JSON.stringify(payload) }),
  updateEvent: (
    eventId: string,
    payload: Partial<{ title: string; joinMode: "IMPORT_ONLY" | "OPEN_SIGNUP" | "BOTH"; accessCode: string | null; resultsPublic: boolean }>,
  ) => request<any>(`/api/admin/events/${eventId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  createPrize: (eventId: string, payload: { name: string; winnersCount?: number; order?: number }) =>
    request<any>(`/api/admin/events/${eventId}/prizes`, { method: "POST", body: JSON.stringify(payload) }),
  importParticipants: (eventId: string, names: string[]) =>
    request<{ created: number }>(`/api/admin/events/${eventId}/participants/import`, {
      method: "POST",
      body: JSON.stringify({ participants: names.map((displayName) => ({ displayName })) }),
    }),
  draw: (eventId: string, payload: { prizeId: string; count?: number; seed?: string }) =>
    request<any>(`/api/admin/events/${eventId}/draws`, { method: "POST", body: JSON.stringify(payload) }),
  adminEventState: (eventId: string) => request<any>(`/api/admin/events/${eventId}/state`),
  adminResetEvent: (eventId: string) =>
    request<any>(`/api/admin/events/${eventId}/reset`, { method: "POST", body: JSON.stringify({}) }),
  updatePrize: (eventId: string, prizeId: string, payload: Partial<{ name: string; winnersCount: number; order: number }>) =>
    request<any>(`/api/admin/events/${eventId}/prizes/${prizeId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deletePrize: (eventId: string, prizeId: string) =>
    request<any>(`/api/admin/events/${eventId}/prizes/${prizeId}`, { method: "DELETE", body: JSON.stringify({}) }),
  updateParticipant: (eventId: string, participantId: string, payload: Partial<{ displayName: string; disabled: boolean }>) =>
    request<any>(`/api/admin/events/${eventId}/participants/${participantId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteParticipant: (eventId: string, participantId: string) =>
    request<any>(`/api/admin/events/${eventId}/participants/${participantId}`, { method: "DELETE", body: JSON.stringify({}) }),

  // public
  getEventPublic: (eventId: string) => request<any>(`/api/public/events/${eventId}`),
  signup: (eventId: string, payload: { displayName: string; accessCode?: string }) =>
    request<any>(`/api/public/events/${eventId}/signup`, { method: "POST", body: JSON.stringify(payload) }),
  getResults: (eventId: string) => request<any>(`/api/public/events/${eventId}/results`),

  // rooms (friend circle)
  createRoom: (payload: {
    title: string;
    accessCode: string;
    totalAmount: number;
    totalCount: number;
    minAmount?: number;
    maxAmount?: number | null;
  }) => request<any>("/api/public/rooms", { method: "POST", body: JSON.stringify(payload) }),
  enterRoom: (roomId: string, payload: { accessCode: string }) =>
    request<any>(`/api/public/rooms/${roomId}/enter`, { method: "POST", body: JSON.stringify(payload) }),
  claimRoom: (roomId: string, payload: { accessCode: string; deviceId: string; name: string }) =>
    request<any>(`/api/public/rooms/${roomId}/claim`, { method: "POST", body: JSON.stringify(payload) }),
  roomBoard: (roomId: string, payload: { accessCode: string }) =>
    request<any>(`/api/public/rooms/${roomId}/board`, { method: "POST", body: JSON.stringify(payload) }),

  // admin rooms
  adminListRooms: () => request<Array<any>>("/api/admin/rooms"),
  adminGetRoom: (roomId: string) => request<any>(`/api/admin/rooms/${roomId}`),
  adminCloseRoom: (roomId: string) => request<any>(`/api/admin/rooms/${roomId}/close`, { method: "POST", body: JSON.stringify({}) }),
};


