"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface ReviewState {
  selectionsJson: string;
  hasSelections: boolean;
}

interface ReviewContextValue {
  state: ReviewState;
  update: (next: ReviewState) => void;
}

const ReviewContext = createContext<ReviewContextValue | null>(null);

export function ReviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ReviewState>({
    selectionsJson: "[]",
    hasSelections: false,
  });

  return (
    <ReviewContext.Provider value={{ state, update: setState }}>
      {children}
    </ReviewContext.Provider>
  );
}

export function useReviewState() {
  return useContext(ReviewContext);
}
