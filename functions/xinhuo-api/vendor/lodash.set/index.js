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

function isSafePath(parts) {
  return parts.length > 0 && parts.every((part) => !BLOCKED_KEYS.has(part));
}

function set(target, path, value) {
  if (target === null || (typeof target !== "object" && typeof target !== "function")) {
    return target;
  }

  const parts = toPath(path);
  if (!isSafePath(parts)) {
    return target;
  }

  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    const existing = cursor[key];
    if (existing === null || (typeof existing !== "object" && typeof existing !== "function")) {
      cursor[key] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    }
    cursor = cursor[key];
  }

  cursor[parts.at(-1)] = value;
  return target;
}

module.exports = set;
