"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import { Alert, Button, Card, PageLoader } from "@/components/ui";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  goToQuestion,
  loadExam,
  nextQuestion,
  previousQuestion,
  selectAnswer,
  submitExam,
} from "@/store/slices/examSlice";

function ExamContent() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const { sessionId: loadedId, topicName, domainName, questions, currentIndex, answers, status, error } =
    useAppSelector((state) => state.exam);

  const [confirming, setConfirming] = useState(false);

  // Fetch the session if we arrived by direct link or page refresh, in which
  // case Redux is empty even though the exam exists on the server.
  useEffect(() => {
    if (loadedId !== sessionId && status !== "starting" && status !== "submitting") {
      dispatch(loadExam(sessionId));
    }
  }, [dispatch, sessionId, loadedId, status]);

  // Submitting navigates to the result page.
  useEffect(() => {
    if (status === "submitted") router.replace(`/result/${sessionId}`);
  }, [status, sessionId, router]);

  if (status === "failed") {
    return (
      <Card>
        <Alert>{error}</Alert>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => dispatch(loadExam(sessionId))}>
            Try again
          </Button>
          <Button variant="ghost" onClick={() => router.replace("/dashboard")}>
            Back to dashboard
          </Button>
        </div>
      </Card>
    );
  }

  if (loadedId !== sessionId || questions.length === 0) {
    return <PageLoader label="Loading your exam" />;
  }

  const question = questions[currentIndex];
  const selected = answers[question.id];
  const answeredCount = Object.keys(answers).length;
  const isLast = currentIndex === questions.length - 1;
  const unanswered = questions.length - answeredCount;

  const handleSubmit = () => {
    setConfirming(false);
    dispatch(submitExam());
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{topicName}</h1>
          <p className="text-sm text-slate-500">{domainName}</p>
        </div>
        <p className="text-sm text-slate-500">
          Question {currentIndex + 1} of {questions.length} · {answeredCount} answered
        </p>
      </div>

      {/* Progress bar doubles as a jump-to-question strip. */}
      <div className="flex flex-wrap gap-1.5">
        {questions.map((item, index) => {
          const isAnswered = item.id in answers;
          const isCurrent = index === currentIndex;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={`Go to question ${index + 1}`}
              aria-current={isCurrent}
              onClick={() => dispatch(goToQuestion(index))}
              className={`size-8 rounded-md border text-xs font-medium transition-colors ${
                isCurrent
                  ? "border-slate-900 bg-slate-900 text-white"
                  : isAnswered
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"
              }`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      <Card>
        <p className="text-base font-medium text-slate-900">{question.text}</p>

        <fieldset className="mt-4 flex flex-col gap-2">
          <legend className="sr-only">Answer options</legend>

          {question.options.map((option, index) => {
            const checked = selected === index;
            return (
              <label
                key={index}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  checked
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 bg-white hover:border-slate-400"
                }`}
              >
                <input
                  type="radio"
                  // Name is per-question so navigating does not carry a selection over.
                  name={`question-${question.id}`}
                  value={index}
                  checked={checked}
                  onChange={() =>
                    dispatch(selectAnswer({ questionId: question.id, option: index }))
                  }
                  className="mt-0.5 size-4 accent-slate-900"
                />
                <span className="text-sm text-slate-800">{option}</span>
              </label>
            );
          })}
        </fieldset>
      </Card>

      {error && <Alert>{error}</Alert>}

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          onClick={() => dispatch(previousQuestion())}
          disabled={currentIndex === 0}
        >
          ← Previous
        </Button>

        {isLast ? (
          <Button onClick={() => setConfirming(true)} loading={status === "submitting"}>
            Submit exam
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => dispatch(nextQuestion())}>
            Next →
          </Button>
        )}
      </div>

      {confirming && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm font-medium text-slate-900">Submit this exam?</p>
          <p className="mt-1 text-sm text-slate-600">
            {unanswered > 0
              ? `${unanswered} question${unanswered === 1 ? " is" : "s are"} still unanswered and will be marked incorrect.`
              : "All questions answered. You cannot change your answers after submitting."}
          </p>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSubmit} loading={status === "submitting"}>
              Yes, submit
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Keep working
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function ExamPage() {
  return (
    <AppShell>
      <ExamContent />
    </AppShell>
  );
}
