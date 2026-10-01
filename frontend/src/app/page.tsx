"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { PageLoader } from "@/components/ui";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { restoreSession } from "@/store/slices/authSlice";

/**
 * Entry point. Sends the visitor to the right place for their session state:
 * login if signed out, onboarding if signed up but not set up, else dashboard.
 */
export default function HomePage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { user, initialised } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!initialised) dispatch(restoreSession());
  }, [dispatch, initialised]);

  useEffect(() => {
    if (!initialised) return;
    if (!user) router.replace("/login");
    else if (!user.onboarding) router.replace("/onboarding");
    else router.replace("/dashboard");
  }, [initialised, user, router]);

  return <PageLoader />;
}
