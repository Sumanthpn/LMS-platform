import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { ApiError, api } from "@/lib/api";
import { clearToken, readToken, writeToken } from "@/lib/token";
import type { AuthResponse, RequestStatus, User } from "@/types";

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}

interface AuthState {
  user: User | null;
  token: string | null;
  status: RequestStatus;
  error: string | null;
  /** False until we have tried to restore a session, so guards do not flash. */
  initialised: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  status: "idle",
  error: null,
  initialised: false,
};

export const signup = createAsyncThunk<
  AuthResponse,
  { name: string; email: string; password: string },
  { rejectValue: string }
>("auth/signup", async (payload, { rejectWithValue }) => {
  try {
    return await api.post<AuthResponse>("/api/auth/signup", payload, { auth: false });
  } catch (error) {
    return rejectWithValue(errorMessage(error));
  }
});

export const login = createAsyncThunk<
  AuthResponse,
  { email: string; password: string },
  { rejectValue: string }
>("auth/login", async (payload, { rejectWithValue }) => {
  try {
    return await api.post<AuthResponse>("/api/auth/login", payload, { auth: false });
  } catch (error) {
    return rejectWithValue(errorMessage(error));
  }
});

/** Restore the session on a page load from the token cookie. */
export const restoreSession = createAsyncThunk<User | null, void>(
  "auth/restoreSession",
  async () => {
    if (!readToken()) return null;
    try {
      return await api.get<User>("/api/auth/me");
    } catch (error) {
      // An expired or tampered token should not leave a stale cookie behind.
      if (error instanceof ApiError && error.status === 401) clearToken();
      return null;
    }
  },
);

export const saveOnboarding = createAsyncThunk<
  User,
  { domain_id: string; topic_id: string },
  { rejectValue: string }
>("auth/saveOnboarding", async (payload, { rejectWithValue }) => {
  try {
    return await api.post<User>("/api/onboarding", payload);
  } catch (error) {
    return rejectWithValue(errorMessage(error));
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      clearToken();
      state.user = null;
      state.token = null;
      state.status = "idle";
      state.error = null;
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    const authenticated = (state: AuthState, action: PayloadAction<AuthResponse>) => {
      writeToken(action.payload.access_token);
      state.status = "succeeded";
      state.token = action.payload.access_token;
      state.user = action.payload.user;
      state.error = null;
      state.initialised = true;
    };

    builder
      // signup and login share request/success/failure handling.
      .addCase(signup.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(signup.fulfilled, authenticated)
      .addCase(signup.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? "Signup failed";
      })
      .addCase(login.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(login.fulfilled, authenticated)
      .addCase(login.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? "Login failed";
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.user = action.payload;
        state.token = action.payload ? readToken() : null;
        state.initialised = true;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.initialised = true;
      })
      .addCase(saveOnboarding.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(saveOnboarding.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload;
      })
      .addCase(saveOnboarding.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? "Could not save your selection";
      });
  },
});

export const { logout, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
