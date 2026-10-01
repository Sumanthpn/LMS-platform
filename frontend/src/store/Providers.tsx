"use client";

import { useState } from "react";
import { Provider } from "react-redux";

import { makeStore } from "@/store";

/**
 * Creates the store once and hands it to React-Redux.
 *
 * The lazy `useState` initialiser runs a single time per mounted component,
 * so the store is never rebuilt on re-render. Building it here rather than at
 * module scope also keeps a server render from sharing one store across
 * requests.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const [store] = useState(makeStore);

  return <Provider store={store}>{children}</Provider>;
}
