"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Alert, Button, Card, Field } from "@/components/ui";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearAuthError, signup } from "@/store/slices/authSlice";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { status, error } = useAppSelector((state) => state.auth);

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  // Mirrors the backend's Pydantic rules so users see problems before a round trip.
  const errors = {
    name: !form.name.trim() ? "Name is required" : null,
    email: !form.email.trim()
      ? "Email is required"
      : !EMAIL_PATTERN.test(form.email.trim())
        ? "Enter a valid email address"
        : null,
    password:
      form.password.length < 8 ? "Password must be at least 8 characters" : null,
  };
  const isValid = Object.values(errors).every((value) => value === null);

  const update = (field: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!isValid) return;

    const result = await dispatch(
      signup({ name: form.name.trim(), email: form.email.trim(), password: form.password }),
    );
    // A new account has no onboarding yet, so always go there next.
    if (signup.fulfilled.match(result)) router.replace("/onboarding");
  };

  return (
    <Card>
      <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-slate-500">Takes about ten seconds.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-5 flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}

        <Field
          label="Name"
          name="name"
          autoComplete="name"
          placeholder="Sumanth"
          value={form.name}
          error={touched ? errors.name : null}
          onChange={update("name")}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          error={touched ? errors.email : null}
          onChange={update("email")}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          hint="Stored only as a bcrypt hash."
          value={form.password}
          error={touched ? errors.password : null}
          onChange={update("password")}
        />

        <Button type="submit" loading={status === "loading"}>
          {status === "loading" ? "Creating account" : "Sign up"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-slate-900 underline underline-offset-2">
          Log in
        </Link>
      </p>
    </Card>
  );
}
