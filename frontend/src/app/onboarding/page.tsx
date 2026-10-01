"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import DomainTopicPicker from "@/components/DomainTopicPicker";
import { Alert, Button, Card, PageLoader } from "@/components/ui";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { saveOnboarding } from "@/store/slices/authSlice";
import { fetchDomains } from "@/store/slices/catalogSlice";

function OnboardingContent() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const { domains, status: catalogStatus, error: catalogError } = useAppSelector(
    (state) => state.catalog,
  );
  const { status: authStatus, error: authError } = useAppSelector((state) => state.auth);

  const [domainId, setDomainId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);

  useEffect(() => {
    if (catalogStatus === "idle") dispatch(fetchDomains());
  }, [dispatch, catalogStatus]);

  const handleSelectDomain = (id: string) => {
    setDomainId(id);
    // The old topic belongs to a different domain, so it cannot stay selected.
    setTopicId(null);
  };

  const handleSave = async () => {
    if (!domainId || !topicId) return;
    const result = await dispatch(saveOnboarding({ domain_id: domainId, topic_id: topicId }));
    if (saveOnboarding.fulfilled.match(result)) router.replace("/dashboard");
  };

  if (catalogStatus === "loading" || catalogStatus === "idle") {
    return <PageLoader label="Loading domains" />;
  }

  if (catalogStatus === "failed") {
    return (
      <Card>
        <Alert>{catalogError}</Alert>
        <Button className="mt-4" variant="secondary" onClick={() => dispatch(fetchDomains())}>
          Try again
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tell us what you are studying. You can take exams on any topic later — this just sets your
          starting point.
        </p>
      </div>

      <Card>
        <DomainTopicPicker
          domains={domains}
          selectedDomainId={domainId}
          selectedTopicId={topicId}
          onSelectDomain={handleSelectDomain}
          onSelectTopic={setTopicId}
        />

        {authError && (
          <div className="mt-5">
            <Alert>{authError}</Alert>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            {topicId ? "Ready to continue." : "Select a domain and topic to continue."}
          </p>
          <Button
            onClick={handleSave}
            disabled={!domainId || !topicId}
            loading={authStatus === "loading"}
          >
            Continue
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function OnboardingPage() {
  // requireOnboarding=false: this is the page that completes onboarding.
  return (
    <AppShell requireOnboarding={false}>
      <OnboardingContent />
    </AppShell>
  );
}
