"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { PageLoader } from "@/components/ui";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout, restoreSession } from "@/store/slices/authSlice";
import { resetExam } from "@/store/slices/examSlice";

/**
 * Client-side half of route protection.
 *
 * `middleware.ts` already blocks unauthenticated requests before render; this
 * restores the user into Redux and enforces the rule middleware cannot see —
 * that an authenticated but un-onboarded user belongs on /onboarding.
 */
export default function AppShell({
  children,
  requireOnboarding = true,
}: {
  children: ReactNode;
  requireOnboarding?: boolean;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { user, initialised } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!initialised) dispatch(restoreSession());
  }, [dispatch, initialised]);

  useEffect(() => {
    if (!initialised) return;
    if (!user) {
      router.replace("/login");
    } else if (requireOnboarding && !user.onboarding) {
      router.replace("/onboarding");
    }
  }, [initialised, user, requireOnboarding, router]);

  if (!initialised) return <PageLoader label="Restoring your session" />;
  if (!user) return <PageLoader label="Redirecting" />;
  if (requireOnboarding && !user.onboarding) return <PageLoader label="Finishing setup" />;

  const handleLogout = () => {
    dispatch(logout());
    dispatch(resetExam());
    router.replace("/login");
  };

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight text-slate-900">
            LMS Platform
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">{user.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md px-2.5 py-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
