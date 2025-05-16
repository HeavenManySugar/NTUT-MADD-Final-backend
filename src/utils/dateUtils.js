/**
 * Format a date object to ISO string
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string
 */
exports.formatDate = (date) => {
  return date.toISOString();
};

/**
 * Get current date and time
 * @returns {Date} - Current date and time
 */
exports.getCurrentDate = () => {
  return new Date();
};

/**
 * Add days to a date
 * @param {Date} date - Starting date
 * @param {number} days - Number of days to add
 * @returns {Date} - New date
 */
exports.addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Check if a date is in the past
 * @param {Date} date - Date to check
 * @returns {boolean} - True if date is in the past
 */
exports.isDateInPast = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

/**
 * Format duration between two dates in human readable format
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {string} - Human readable duration
 */
exports.formatDuration = (startDate, endDate) => {
  const diffInMs = Math.abs(endDate - startDate);
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays > 30) {
    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''}`;
  } else if (diffInDays > 0) {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''}`;
  } else {
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    if (diffInHours > 0) {
      return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''}`;
    } else {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''}`;
    }
  }
};
