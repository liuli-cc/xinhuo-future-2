"use strict";

const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function toPath(path) {
  if (Array.isArray(path)) {
    return path.map(String);
  }

  return String(path)
    .replace(/\[(?:"([^"]*)"|'([^']*)'|([^\]]+))\]/g, (_match, doubleQuoted, singleQuoted, plain) => {
      return `.${doubleQuoted ?? singleQuoted ?? plain}`;
    })
    .split(".")
    .filter(Boolean);
}

function unset(target, path) {
  if (target === null || (typeof target !== "object" && typeof target !== "function")) {
    return true;
  }

  const parts = toPath(path);
  if (parts.length === 0 || parts.some((part) => BLOCKED_KEYS.has(part))) {
    return false;
  }

  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    cursor = cursor?.[parts[index]];
    if (cursor === null || (typeof cursor !== "object" && typeof cursor !== "function")) {
      return true;
    }
  }

  return delete cursor[parts.at(-1)];
}

module.exports = unset;
