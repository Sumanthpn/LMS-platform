"use client";

import type { Domain } from "@/types";

interface Props {
  domains: Domain[];
  selectedDomainId: string | null;
  selectedTopicId: string | null;
  onSelectDomain: (domainId: string) => void;
  onSelectTopic: (topicId: string) => void;
  /** Hide topics with too few questions to start an exam. */
  minQuestions?: number;
}

export default function DomainTopicPicker({
  domains,
  selectedDomainId,
  selectedTopicId,
  onSelectDomain,
  onSelectTopic,
  minQuestions = 5,
}: Props) {
  const selectedDomain = domains.find((domain) => domain.id === selectedDomainId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-sm font-medium text-slate-700">1. Choose a domain</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {domains.map((domain) => {
            const active = domain.id === selectedDomainId;
            return (
              <button
                key={domain.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectDomain(domain.id)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white hover:border-slate-400"
                }`}
              >
                <span className="block text-sm font-medium">{domain.name}</span>
                <span
                  className={`mt-1 block text-xs ${active ? "text-slate-300" : "text-slate-500"}`}
                >
                  {domain.topics.length} topic{domain.topics.length === 1 ? "" : "s"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-slate-700">2. Choose a topic</h2>

        {!selectedDomain ? (
          <p className="mt-2 text-sm text-slate-500">Pick a domain first.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {selectedDomain.topics.map((topic) => {
              const active = topic.id === selectedTopicId;
              const tooFew = topic.question_count < minQuestions;

              return (
                <button
                  key={topic.id}
                  type="button"
                  disabled={tooFew}
                  aria-pressed={active}
                  onClick={() => onSelectTopic(topic.id)}
                  className={`flex items-start justify-between gap-4 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    active
                      ? "border-slate-900 bg-slate-50"
                      : "border-slate-200 bg-white hover:border-slate-400"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{topic.name}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{topic.description}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {topic.question_count} Qs
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
