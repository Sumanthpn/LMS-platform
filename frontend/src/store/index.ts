import { configureStore } from "@reduxjs/toolkit";

import authReducer from "@/store/slices/authSlice";
import catalogReducer from "@/store/slices/catalogSlice";
import examReducer from "@/store/slices/examSlice";

export const makeStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      catalog: catalogReducer,
      exam: examReducer,
    },
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
