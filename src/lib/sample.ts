import type { Question } from "./types";

/** Sample questions so the game works before you import your own CSV. */
export const SAMPLE_QUESTIONS: Question[] = [
  {
    id: "q1",
    text: "Name something people do during a boring meeting",
    answers: [
      { text: "Check their phone", points: 32 },
      { text: "Doodle", points: 22 },
      { text: "Daydream", points: 15 },
      { text: "Fall asleep", points: 11 },
      { text: "Eat snacks", points: 8 },
      { text: "Answer emails", points: 6 },
    ],
  },
  {
    id: "q2",
    text: "Name something you'd find on an office desk",
    answers: [
      { text: "Computer", points: 35 },
      { text: "Coffee mug", points: 20 },
      { text: "Pen", points: 14 },
      { text: "Stapler", points: 10 },
      { text: "Sticky notes", points: 9 },
      { text: "Phone", points: 7 },
      { text: "Plant", points: 5 },
    ],
  },
  {
    id: "q3",
    text: "Name a food you'd see at a Filipino party",
    answers: [
      { text: "Lechon", points: 34 },
      { text: "Pancit", points: 25 },
      { text: "Lumpia", points: 18 },
      { text: "Spaghetti", points: 10 },
      { text: "Leche flan", points: 7 },
    ],
  },
  {
    id: "q4",
    text: "Name a reason you might be late to work",
    answers: [
      { text: "Traffic", points: 40 },
      { text: "Overslept", points: 25 },
      { text: "Kids", points: 12 },
      { text: "Weather", points: 9 },
      { text: "Lost keys", points: 6 },
      { text: "Car trouble", points: 5 },
    ],
  },
  {
    id: "q5",
    text: "Name something people say on a video call",
    answers: [
      { text: "You're on mute", points: 41 },
      { text: "Can you see my screen?", points: 22 },
      { text: "Can you hear me?", points: 15 },
      { text: "Sorry, go ahead", points: 9 },
      { text: "Let's take this offline", points: 7 },
    ],
  },
];
