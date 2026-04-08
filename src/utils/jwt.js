const BASE_URL = import.meta.env.VITE_API_URL as string;
console.log("🔥 BASE_URL:", BASE_URL);
console.log("🔥 ENV FULL:", import.meta.env);

/* ============================================================
   TOKEN STORAGE
   ============================================================ */
export const tokenStorage = {
  getAccess: () => localStorage.getItem("hrms_access_token"),
  getRefresh: () => localStorage.getItem("hrms_refresh_token"),
  set: (access: string, refresh: string) => {
    localStorage.setItem("hrms_access_token", access);
    localStorage.setItem("hrms_refresh_token", refresh);
  },
  clear: () => {
    localStorage.removeItem("hrms_access_token");
    localStorage.removeItem("hrms_refresh_token");
    localStorage.removeItem("hrms_current");
  },
};

/* ============================================================
   API ERROR CLASS
   ============================================================ */
export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/* ============================================================
   REFRESH TOKEN
   ============================================================ */
async function attemptRefresh(): Promise<boolean> {
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    tokenStorage.set(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

/* ============================================================
   BASE FETCH
   ============================================================ */
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
  retry = true
): Promise<any> {
  const token = tokenStorage.getAccess();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && retry) {
    const refreshed = await attemptRefresh();
    if (refreshed) return apiFetch(endpoint, options, false);
    else {
      tokenStorage.clear();
      window.location.href = "/";
      return;
    }
  }

  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(data.message || "Request failed", response.status, data);
  }
  return data;
}

/* ============================================================
   AUTH API
   ============================================================ */
export const authApi = {
  signup: async (name: string, email: string, password: string, role: string) => {
    const data = await apiFetch("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password, role }),
    });
    tokenStorage.set(data.accessToken, data.refreshToken);
    localStorage.setItem("hrms_current", JSON.stringify(data.user));
    return data;
  },

  login: async (email: string, password: string, role: string) => {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    });
    tokenStorage.set(data.accessToken, data.refreshToken);
    localStorage.setItem("hrms_current", JSON.stringify(data.user));
    return data;
  },

  logout: async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      tokenStorage.clear();
    }
  },

  resetPassword: async (email: string, newPassword: string) => {
    return apiFetch("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, newPassword }),
    });
  },

  changePassword: async (oldPassword: string, newPassword: string) => {
    return apiFetch("/auth/change-password", {
      method: "PUT",
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  },

  getMe: async () => {
    return apiFetch("/auth/me");
  },
};

/* ============================================================
   PROFILE API
   ============================================================ */
export const profileApi = {
  get: async () => apiFetch("/profile"),

  update: async (updates: {
    name?: string;
    phone?: string;
    department?: string;
    avatar?: string;
  }) => {
    return apiFetch("/profile", {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  deleteAccount: async () => apiFetch("/profile", { method: "DELETE" }),
};

/* ============================================================
   DASHBOARD API
   ============================================================ */
export const dashboardApi = {
  getStats: async () => apiFetch("/dashboard/stats"),

  getUsers: async (params?: {
    role?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return apiFetch(`/dashboard/users${query ? `?${query}` : ""}`);
  },

  updateUser: async (id: string, updates: any) => {
    return apiFetch(`/dashboard/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  deleteUser: async (id: string) =>
    apiFetch(`/dashboard/users/${id}`, { method: "DELETE" }),
};

/* ============================================================
   ATTENDANCE API
   ============================================================ */
export const attendanceApi = {
  checkIn: () => apiFetch("/attendance/checkin", { method: "POST" }),
  checkOut: () => apiFetch("/attendance/checkout", { method: "POST" }),
  getToday: () => apiFetch("/attendance/today"),
  getMy: () => apiFetch("/attendance/my"),
  getAll: () => apiFetch("/attendance/all"),
};

/* ============================================================
   LEAVE API
   ============================================================ */
export const leaveApi = {
  apply: (data: {
    type: string;
    isEmergency: boolean;
    priority: string;
    startDate: string;
    endDate: string;
    reason: string;
    description?: string;
    emergencyContact?: string;
  }) =>
    apiFetch("/leaves/apply", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMy: () => apiFetch("/leaves/my"),

  getPending: () => apiFetch("/leaves/pending"),

  getAll: () => apiFetch("/leaves/all"),

  approve: (id: string) =>
    apiFetch(`/leaves/${id}/approve`, { method: "PUT" }),

  reject: (id: string, reason?: string) =>
    apiFetch(`/leaves/${id}/reject`, {
      method: "PUT",
      body: JSON.stringify({ reason: reason || "" }),
    }),
};

/* ============================================================
   TASK API
   ============================================================ */
export const taskApi = {
  create: (data: any) =>
    apiFetch("/tasks", { method: "POST", body: JSON.stringify(data) }),

  getAll: () => apiFetch("/tasks/all"),

  getMy: () => apiFetch("/tasks/my"),

  update: (id: string, data: any) =>
    apiFetch(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string) => apiFetch(`/tasks/${id}`, { method: "DELETE" }),

  addUpdate: (id: string, data: any) =>
    apiFetch(`/tasks/${id}/update`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

/* ============================================================
   PROJECT API
   ============================================================ */
export const projectApi = {
  create: (data: any) =>
    apiFetch("/projects", { method: "POST", body: JSON.stringify(data) }),

  getAll: () => apiFetch("/projects/all"),

  getMy: () => apiFetch("/projects/my"),

  update: (id: string, data: any) =>
    apiFetch(`/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string) => apiFetch(`/projects/${id}`, { method: "DELETE" }),
};

/* ============================================================
   PAYROLL API
   ============================================================ */
export const payrollApi = {
  create: (data: any) =>
    apiFetch("/payroll", { method: "POST", body: JSON.stringify(data) }),

  getAll: () => apiFetch("/payroll/all"),

  getMy: () => apiFetch("/payroll/my"),

  process: () => apiFetch("/payroll/process", { method: "POST" }),

  update: (id: string, data: any) =>
    apiFetch(`/payroll/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string) => apiFetch(`/payroll/${id}`, { method: "DELETE" }),
};

/* ============================================================
   CLIENT API
   ============================================================ */
export const clientApi = {
  create: (data: any) =>
    apiFetch("/clients", { method: "POST", body: JSON.stringify(data) }),

  getAll: () => apiFetch("/clients"),

  update: (id: string, data: any) =>
    apiFetch(`/clients/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string) => apiFetch(`/clients/${id}`, { method: "DELETE" }),

  createInvoice: (data: any) =>
    apiFetch("/clients/invoices", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getInvoices: () => apiFetch("/clients/invoices"),
};

/* ============================================================
   CALENDAR API
   ============================================================ */
export const calendarApi = {
  create: (data: any) =>
    apiFetch("/calendar", { method: "POST", body: JSON.stringify(data) }),

  getEvents: () => apiFetch("/calendar"),

  getAll: () => apiFetch("/calendar/all"),

  update: (id: string, data: any) =>
    apiFetch(`/calendar/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string) => apiFetch(`/calendar/${id}`, { method: "DELETE" }),
};

/* ============================================================
   DAILY STATUS API
   ============================================================ */
export const dailyStatusApi = {
  submit: (data: any) =>
    apiFetch("/daily-status", { method: "POST", body: JSON.stringify(data) }),

  getMy: () => apiFetch("/daily-status/my"),

  getAll: () => apiFetch("/daily-status/all"),

  addComment: (id: string, comment: string) =>
    apiFetch(`/daily-status/${id}/comment`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    }),
};

/* ============================================================
   TIMESHEET API
   ============================================================ */
export const timesheetApi = {
  add: (data: any) =>
    apiFetch("/timesheets", { method: "POST", body: JSON.stringify(data) }),

  getMy: () => apiFetch("/timesheets/my"),

  getAll: () => apiFetch("/timesheets/all"),

  approve: (id: string) =>
    apiFetch(`/timesheets/${id}/approve`, { method: "PUT" }),

  reject: (id: string) =>
    apiFetch(`/timesheets/${id}/reject`, { method: "PUT" }),
};

/* ============================================================
   VENDOR API
   ============================================================ */
export const vendorApi = {
  create: (data: any) =>
    apiFetch("/vendors", { method: "POST", body: JSON.stringify(data) }),

  getAll: () => apiFetch("/vendors"),

  update: (id: string, data: any) =>
    apiFetch(`/vendors/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string) => apiFetch(`/vendors/${id}`, { method: "DELETE" }),
};

/* ============================================================
   FREELANCER API
   ============================================================ */
export const freelancerApi = {
  create: (data: any) =>
    apiFetch("/freelancers", { method: "POST", body: JSON.stringify(data) }),

  getAll: () => apiFetch("/freelancers"),

  update: (id: string, data: any) =>
    apiFetch(`/freelancers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) => apiFetch(`/freelancers/${id}`, { method: "DELETE" }),
};
