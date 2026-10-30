import {
  configureStore,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { PlannerInput } from "@/lib/types";

export const initialDraft: PlannerInput = {
  destinationSlug: "bali",
  vibes: ["Nature"],
  interests: ["Local food", "Hidden gems"],
  budget: 150,
  pace: "BALANCED",
  days: 5,
  startDate: "",
  travelers: 2,
};
const planner = createSlice({
  name: "planner",
  initialState: initialDraft,
  reducers: {
    updateDraft: (state, action: PayloadAction<Partial<PlannerInput>>) => {
      Object.assign(state, action.payload);
    },
    resetDraft: () => initialDraft,
  },
});
export const { updateDraft, resetDraft } = planner.actions;
export const makeStore = () =>
  configureStore({ reducer: { planner: planner.reducer } });
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
