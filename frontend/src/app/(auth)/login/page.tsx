"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";

import { Alert, Button, Card, Field, PageLoader } from "@/components/ui";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearAuthError, login } from "@/store/slices/authSlice";

function LoginForm() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, error } = useAppSelector((state) => state.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);

  // Clear any error left over from a previous visit to this form.
  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  const emailError = touched && !email.trim() ? "Email is required" : null;
  const passwordError = touched && !password ? "Password is required" : null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!email.trim() || !password) return;

    const result = await dispatch(login({ email: email.trim(), password }));
    if (login.fulfilled.match(result)) {
      const next = searchParams.get("next");
      // Onboarding state decides the landing page; AppShell handles the rest.
      router.replace(next ?? (result.payload.user.onboarding ? "/dashboard" : "/onboarding"));
    }
  };

  return (
    <Card>
      <h1 className="text-xl font-semibold tracking-tight">Log in</h1>
      <p className="mt-1 text-sm text-slate-500">Welcome back. Pick up where you left off.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-5 flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}

        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          error={emailError}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          error={passwordError}
          onChange={(event) => setPassword(event.target.value)}
        />

        <Button type="submit" loading={status === "loading"}>
          {status === "loading" ? "Logging in" : "Log in"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        No account?{" "}
        <Link href="/signup" className="font-medium text-slate-900 underline underline-offset-2">
          Sign up
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary during static rendering.
  return (
    <Suspense fallback={<PageLoader />}>
      <LoginForm />
    </Suspense>
  );
}
