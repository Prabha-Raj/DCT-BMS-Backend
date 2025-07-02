// Validate time format (HH:MM)
export const isValidTime = (time) => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);

// Compare two time strings
export const compareTimes = (a, b) => a.localeCompare(b);