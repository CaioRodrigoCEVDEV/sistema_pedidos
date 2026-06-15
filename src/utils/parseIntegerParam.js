function parseIntegerParam(value) {
  if (Array.isArray(value)) {
    return null;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (
      normalizedValue === "" ||
      normalizedValue === "null" ||
      normalizedValue === "undefined"
    ) {
      return null;
    }
  }

  if (value === undefined || value === null) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

module.exports = {
  parseIntegerParam,
};
