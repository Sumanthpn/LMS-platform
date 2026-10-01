import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { api } from "@/lib/api";
import { errorMessage } from "@/store/slices/authSlice";
import type { Domain, RequestStatus } from "@/types";

interface CatalogState {
  domains: Domain[];
  status: RequestStatus;
  error: string | null;
}

const initialState: CatalogState = {
  domains: [],
  status: "idle",
  error: null,
};

export const fetchDomains = createAsyncThunk<Domain[], void, { rejectValue: string }>(
  "catalog/fetchDomains",
  async (_, { rejectWithValue }) => {
    try {
      return await api.get<Domain[]>("/api/domains");
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  },
);

const catalogSlice = createSlice({
  name: "catalog",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDomains.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchDomains.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.domains = action.payload;
      })
      .addCase(fetchDomains.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? "Could not load the catalog";
      });
  },
});

export default catalogSlice.reducer;
