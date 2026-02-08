export const TARGET_HOURS = 486;
export const ROUND_STEP_MINUTES = 60;
export const BASELINE_COMPLETED_MINUTES = 20 * 60;

export const formatTime = (date) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

export const formatDate = (date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);

export const formatDateTime = (date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

export const roundUpToStep = (date, stepMinutes) => {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const minutes = rounded.getMinutes();
  const next = Math.ceil(minutes / stepMinutes) * stepMinutes;
  if (next === 60) {
    rounded.setMinutes(0);
    rounded.setHours(rounded.getHours() + 1);
  } else {
    rounded.setMinutes(next);
  }
  return rounded;
};

export const roundUpToHour = (date) => {
  const rounded = new Date(date);
  const hasRemainder =
    rounded.getMinutes() !== 0 ||
    rounded.getSeconds() !== 0 ||
    rounded.getMilliseconds() !== 0;
  rounded.setMinutes(0, 0, 0);
  if (hasRemainder) {
    rounded.setHours(rounded.getHours() + 1);
  }
  return rounded;
};

export const roundDownToHour = (date) => {
  const rounded = new Date(date);
  rounded.setMinutes(0, 0, 0);
  return rounded;
};

export const diffMinutes = (start, end) => Math.max(0, (end - start) / 60000);

export const minutesToHours = (minutes) => minutes / 60;

export const formatHours = (hours) => `${hours.toFixed(2)} hrs`;

