import { addDoc, collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "../firebase.js";
import { roundDownToHour, roundUpToHour } from "../utils/time.js";

const makeDate = (year, monthIndex, day, hour, minute = 0) =>
  new Date(year, monthIndex, day, hour, minute, 0, 0);

const createSeedSession = (start, end) => {
  const timeInRounded = roundUpToHour(start);
  const timeOutRounded = roundDownToHour(end);
  return {
    timeIn: start.getTime(),
    timeOut: end.getTime(),
    timeInRounded: timeInRounded.getTime(),
    timeOutRounded: timeOutRounded.getTime(),
    isCompleted: true,
    createdAt: Date.now(),
  };
};

const seedSessions = [
  createSeedSession(makeDate(2026, 1, 2, 8, 0), makeDate(2026, 1, 2, 12, 0)),
  createSeedSession(makeDate(2026, 1, 2, 13, 0), makeDate(2026, 1, 2, 17, 0)),
  createSeedSession(makeDate(2026, 1, 3, 13, 0), makeDate(2026, 1, 3, 17, 0)),
  createSeedSession(makeDate(2026, 1, 4, 8, 0), makeDate(2026, 1, 4, 12, 0)),
  createSeedSession(makeDate(2026, 1, 4, 13, 0), makeDate(2026, 1, 4, 17, 0)),
  createSeedSession(makeDate(2026, 1, 5, 8, 0), makeDate(2026, 1, 5, 12, 0)),
];

export const seedInitialSessions = async (userId) => {
  const sessionsRef = collection(db, "users", userId, "sessions");
  const existingQuery = query(sessionsRef, limit(1));
  const existingSnapshot = await getDocs(existingQuery);
  if (!existingSnapshot.empty) {
    return;
  }
  await Promise.all(seedSessions.map((session) => addDoc(sessionsRef, session)));
};

