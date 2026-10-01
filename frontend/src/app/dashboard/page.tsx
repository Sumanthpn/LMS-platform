"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import DomainTopicPicker from "@/components/DomainTopicPicker";
import { Alert, Button, Card, PageLoader, Spinner } from "@/components/ui";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchDomains } from "@/store/slices/catalogSlice";
import { fetchHistory, resetExam, startExam } from "@/store/slices/examSlice";

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function DashboardContent() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const user = useAppSelector((state) => state.auth.user);
  const { domains, status: catalogStatus, error: catalogError } = useAppSelector(
    (state) => state.catalog,
  );
  const { status: examStatus, error: examError, history, historyStatus } = useAppSelector(
    (state) => state.exam,
  );

  // Default the pickers to whatever the user chose during onboarding.
  const [domainId, setDomainId] = useState<string | null>(user?.onboarding?.domain_id ?? null);
  const [topicId, setTopicId] = useState<string | null>(user?.onboarding?.topic_id ?? null);

  useEffect(() => {
    if (catalogStatus === "idle") dispatch(fetchDomains());
    if (historyStatus === "idle") dispatch(fetchHistory());
  }, [dispatch, catalogStatus, historyStatus]);

  const handleSelectDomain = (id: string) => {
    setDomainId(id);
    setTopicId(null);
  };

  const handleStart = async () => {
    if (!domainId || !topicId) return;
    // Drop any previous session so stale answers cannot bleed into the new exam.
    dispatch(resetExam());
    const result = await dispatch(startExam({ domain_id: domainId, topic_id: topicId }));
    if (startExam.fulfilled.match(result)) router.push(`/exam/${result.payload.id}`);
  };

  if (catalogStatus === "loading" || catalogStatus === "idle") {
    return <PageLoader label="Loading your dashboard" />;
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
        <h1 className="text-2xl font-semibold tracking-tight">
          Hi {user?.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          You started with{" "}
          <span className="font-medium text-slate-700">{user?.onboarding?.topic_name}</span>. Pick
          any domain and topic to begin an exam.
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

        {examError && (
          <div className="mt-5">
            <Alert>{examError}</Alert>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-5">
          <p className="text-xs text-slate-500">
            Each exam draws 5–10 random questions. Your score is calculated on the server.
          </p>
          <Button
            onClick={handleStart}
            disabled={!domainId || !topicId}
            loading={examStatus === "starting"}
          >
            Start exam
          </Button>
        </div>
      </Card>

      <section>
        <h2 className="text-sm font-medium text-slate-700">Recent attempts</h2>

        {historyStatus === "loading" ? (
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Loading history…
          </div>
        ) : history.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No exams yet. Your first result will appear here.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {history.map((attempt) => (
              <li
                key={attempt.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{attempt.topic_name}</p>
                  <p className="text-xs text-slate-500">
                    {attempt.domain_name} · {formatDate(attempt.started_at)}
                  </p>
                </div>

                {attempt.status === "submitted" ? (
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-medium text-slate-900">
                      {attempt.score}/{attempt.total}
                    </span>
                    <Button
                      variant="secondary"
                      className="px-3 py-1 text-xs"
                      onClick={() => router.push(`/result/${attempt.id}`)}
                    >
                      View
                    </Button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      In progress
                    </span>
                    <Button
                      variant="secondary"
                      className="px-3 py-1 text-xs"
                      onClick={() => router.push(`/exam/${attempt.id}`)}
                    >
                      Resume
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}
