import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { api } from "@/lib/api";
import { errorMessage } from "@/store/slices/authSlice";
import type {
  AnswerMap,
  ExamQuestion,
  ExamResult,
  ExamSession,
  ExamSummary,
  SavedAnswer,
} from "@/types";

type ExamStatus =
  | "idle"
  | "starting"
  | "active"
  | "submitting"
  | "submitted"
  | "failed";

interface ExamState {
  sessionId: string | null;
  domainName: string | null;
  topicName: string | null;
  questions: ExamQuestion[];
  /** Index of the question on screen; Previous/Next move this. */
  currentIndex: number;
  /** question id -> chosen option index. Only answered questions appear. */
  answers: AnswerMap;
  status: ExamStatus;
  error: string | null;
  /** Whether the in-progress answers have reached the server. */
  progressStatus: "idle" | "saving" | "saved" | "failed";
  result: ExamResult | null;
  history: ExamSummary[];
  historyStatus: "idle" | "loading" | "succeeded" | "failed";
}

const initialState: ExamState = {
  sessionId: null,
  domainName: null,
  topicName: null,
  questions: [],
  currentIndex: 0,
  answers: {},
  status: "idle",
  error: null,
  progressStatus: "idle",
  result: null,
  history: [],
  historyStatus: "idle",
};

export const startExam = createAsyncThunk<
  ExamSession,
  { domain_id: string; topic_id: string },
  { rejectValue: string }
>("exam/start", async (payload, { rejectWithValue }) => {
  try {
    return await api.post<ExamSession>("/api/exams/start", payload);
  } catch (error) {
    return rejectWithValue(errorMessage(error));
  }
});

/** Re-fetch an in-progress session so a refresh mid-exam is not fatal. */
export const loadExam = createAsyncThunk<ExamSession, string, { rejectValue: string }>(
  "exam/load",
  async (sessionId, { rejectWithValue }) => {
    try {
      return await api.get<ExamSession>(`/api/exams/${sessionId}`);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  },
);

/**
 * Persist the answers picked so far.
 *
 * Debounced by the exam page rather than fired on every click, so a run of
 * quick selections collapses into one request.
 */
export const saveProgress = createAsyncThunk<
  void,
  void,
  { state: { exam: ExamState }; rejectValue: string }
>("exam/saveProgress", async (_, { getState, rejectWithValue }) => {
  const { sessionId, answers } = getState().exam;
  if (!sessionId) return;

  const body = {
    answers: Object.entries(answers).map(([question_id, selected_option]) => ({
      question_id,
      selected_option,
    })),
  };

  try {
    await api.put<void>(`/api/exams/${sessionId}/answers`, body);
  } catch (error) {
    return rejectWithValue(errorMessage(error));
  }
});

export const submitExam = createAsyncThunk<
  ExamResult,
  void,
  { state: { exam: ExamState }; rejectValue: string }
>("exam/submit", async (_, { getState, rejectWithValue }) => {
  const { sessionId, questions, answers } = getState().exam;
  if (!sessionId) return rejectWithValue("No exam in progress");

  // Send every question, with null for the ones left blank, so the backend
  // records a complete picture of the attempt.
  const body = {
    answers: questions.map((question) => ({
      question_id: question.id,
      selected_option: answers[question.id] ?? null,
    })),
  };

  try {
    return await api.post<ExamResult>(`/api/exams/${sessionId}/submit`, body);
  } catch (error) {
    return rejectWithValue(errorMessage(error));
  }
});

export const fetchResult = createAsyncThunk<ExamResult, string, { rejectValue: string }>(
  "exam/fetchResult",
  async (sessionId, { rejectWithValue }) => {
    try {
      return await api.get<ExamResult>(`/api/exams/${sessionId}/result`);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  },
);

export const fetchHistory = createAsyncThunk<ExamSummary[], void, { rejectValue: string }>(
  "exam/fetchHistory",
  async (_, { rejectWithValue }) => {
    try {
      return await api.get<ExamSummary[]>("/api/exams");
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  },
);

function toAnswerMap(saved: SavedAnswer[]): AnswerMap {
  const map: AnswerMap = {};
  for (const answer of saved) {
    if (answer.selected_option !== null) map[answer.question_id] = answer.selected_option;
  }
  return map;
}

/**
 * Where to drop the user in when resuming: the first question they have not
 * answered, or the last one if they have answered them all, since that is
 * where Submit lives.
 */
function resumeIndex(questions: ExamQuestion[], answers: AnswerMap): number {
  if (questions.length === 0) return 0;
  const next = questions.findIndex((question) => !(question.id in answers));
  return next === -1 ? questions.length - 1 : next;
}

function applySession(state: ExamState, session: ExamSession) {
  const answers = toAnswerMap(session.answers ?? []);

  state.sessionId = session.id;
  state.domainName = session.domain_name;
  state.topicName = session.topic_name;
  state.questions = session.questions;
  state.answers = answers;
  state.currentIndex = resumeIndex(session.questions, answers);
  state.status = "active";
  state.error = null;
  state.progressStatus = "idle";
  state.result = null;
}

const examSlice = createSlice({
  name: "exam",
  initialState,
  reducers: {
    selectAnswer(state, action: PayloadAction<{ questionId: string; option: number }>) {
      state.answers[action.payload.questionId] = action.payload.option;
    },
    clearAnswer(state, action: PayloadAction<string>) {
      delete state.answers[action.payload];
    },
    goToQuestion(state, action: PayloadAction<number>) {
      const index = action.payload;
      if (index >= 0 && index < state.questions.length) state.currentIndex = index;
    },
    nextQuestion(state) {
      if (state.currentIndex < state.questions.length - 1) state.currentIndex += 1;
    },
    previousQuestion(state) {
      if (state.currentIndex > 0) state.currentIndex -= 1;
    },
    /** Wipe session state — on logout, or before starting a fresh exam. */
    resetExam() {
      return initialState;
    },
    clearExamError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(startExam.pending, (state) => {
        state.status = "starting";
        state.error = null;
      })
      .addCase(startExam.fulfilled, (state, action) => applySession(state, action.payload))
      .addCase(startExam.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? "Could not start the exam";
      })
      .addCase(loadExam.pending, (state) => {
        state.status = "starting";
        state.error = null;
      })
      // Saved answers come back with the session, so a refresh or a resume
      // rebuilds the attempt from the server rather than from memory.
      .addCase(loadExam.fulfilled, (state, action) => applySession(state, action.payload))
      .addCase(loadExam.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? "Could not load the exam";
      })
      .addCase(saveProgress.pending, (state) => {
        state.progressStatus = "saving";
      })
      .addCase(saveProgress.fulfilled, (state) => {
        state.progressStatus = "saved";
      })
      // A failed save is surfaced as an indicator, not an error banner: it must
      // not interrupt the exam, but the user should know answers are not stored.
      .addCase(saveProgress.rejected, (state) => {
        state.progressStatus = "failed";
      })
      .addCase(submitExam.pending, (state) => {
        state.status = "submitting";
        state.error = null;
      })
      .addCase(submitExam.fulfilled, (state, action) => {
        state.status = "submitted";
        state.result = action.payload;
      })
      .addCase(submitExam.rejected, (state, action) => {
        // Stay on "active" so the user can retry without losing their answers.
        state.status = "active";
        state.error = action.payload ?? "Could not submit the exam";
      })
      .addCase(fetchResult.fulfilled, (state, action) => {
        state.status = "submitted";
        state.result = action.payload;
        state.error = null;
      })
      .addCase(fetchResult.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? "Could not load the result";
      })
      .addCase(fetchHistory.pending, (state) => {
        state.historyStatus = "loading";
      })
      .addCase(fetchHistory.fulfilled, (state, action) => {
        state.historyStatus = "succeeded";
        state.history = action.payload;
      })
      .addCase(fetchHistory.rejected, (state) => {
        state.historyStatus = "failed";
      });
  },
});

export const {
  selectAnswer,
  clearAnswer,
  goToQuestion,
  nextQuestion,
  previousQuestion,
  resetExam,
  clearExamError,
} = examSlice.actions;

export default examSlice.reducer;
