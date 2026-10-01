"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import AppShell from "@/components/AppShell";
import { Alert, Button, Card, PageLoader } from "@/components/ui";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchResult, resetExam } from "@/store/slices/examSlice";

function ResultContent() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const { result, status, error } = useAppSelector((state) => state.exam);
  const isCurrent = result?.id === sessionId;

  // Submitting already put the result in the store; fetch only on a direct visit.
  useEffect(() => {
    if (!isCurrent && status !== "submitting") dispatch(fetchResult(sessionId));
  }, [dispatch, sessionId, isCurrent, status]);

  if (status === "failed" && !isCurrent) {
    return (
      <Card>
        <Alert>{error}</Alert>
        <Button className="mt-4" variant="secondary" onClick={() => router.replace("/dashboard")}>
          Back to dashboard
        </Button>
      </Card>
    );
  }

  if (!isCurrent || !result) return <PageLoader label="Loading your result" />;

  const handleAgain = () => {
    dispatch(resetExam());
    router.push("/dashboard");
  };

  return (
    <div className="flex flex-col gap-6">
      <Card
        className={result.passed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}
      >
        <p className="text-sm text-slate-600">
          {result.domain_name} · {result.topic_name}
        </p>
        <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
          {result.score}
          <span className="text-2xl text-slate-400"> / {result.total}</span>
        </p>
        <p className="mt-1 text-sm font-medium text-slate-700">
          {result.percentage}% · {result.passed ? "Passed" : "Not passed"}{" "}
          <span className="font-normal text-slate-500">(60% to pass)</span>
        </p>

        <div className="mt-5 flex gap-2">
          <Button onClick={handleAgain}>Take another exam</Button>
          <Button variant="secondary" onClick={() => router.push("/dashboard")}>
            Back to dashboard
          </Button>
        </div>
      </Card>

      <section>
        <h2 className="text-sm font-medium text-slate-700">Answer review</h2>
        <p className="mt-1 text-xs text-slate-500">
          Correct answers are released by the API only after submission.
        </p>

        <ol className="mt-3 flex flex-col gap-3">
          {result.breakdown.map((item, index) => (
            <li key={item.question_id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">
                    {index + 1}. {item.text}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.is_correct
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {item.is_correct ? "Correct" : "Incorrect"}
                  </span>
                </div>

                <ul className="mt-3 flex flex-col gap-1.5">
                  {item.options.map((option, optionIndex) => {
                    const isCorrect = optionIndex === item.correct_option;
                    const isChosen = optionIndex === item.selected_option;

                    return (
                      <li
                        key={optionIndex}
                        className={`rounded-md border px-3 py-2 text-sm ${
                          isCorrect
                            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                            : isChosen
                              ? "border-red-300 bg-red-50 text-red-900"
                              : "border-slate-200 text-slate-600"
                        }`}
                      >
                        <span>{option}</span>
                        {isCorrect && <span className="ml-2 text-xs font-medium">Correct answer</span>}
                        {isChosen && !isCorrect && (
                          <span className="ml-2 text-xs font-medium">Your answer</span>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {item.selected_option === null && (
                  <p className="mt-2 text-xs text-slate-500">You left this question blank.</p>
                )}
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default function ResultPage() {
  return (
    <AppShell>
      <ResultContent />
    </AppShell>
  );
}
