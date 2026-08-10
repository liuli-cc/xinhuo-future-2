import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

for (const [path, text] of [
  ["/", "登录成长平台"],
  ["/account", "账号与隐私"],
  ["/admin", "管理中心"],
  ["/teacher", "教师工作台"],
  ["/dashboard", "成长首页"],
  ["/growth-map", "成长地图"],
  ["/interview", "模拟面试"],
  ["/portrait", "能力画像"],
  ["/ai", "成长决策引擎"],
  ["/resources", "成长资源"],
  ["/career", "实习就业"],
]) {
  test(`static-export contains ${path}`, async () => {
    const fileName = path === "/" ? "index.html" : `${path.slice(1)}.html`;
    const html = await readFile(`${projectRoot}/out/${fileName}`, "utf8");
    assert.match(html, /<!DOCTYPE html>/i);
    assert.match(html, new RegExp(text));
    assert.doesNotMatch(html, /正在连接成长档案|正在同步/);
  });
}

test("unresolved roles do not flash access-denied states", async () => {
  const [adminHtml, teacherHtml] = await Promise.all([
    readFile(`${projectRoot}/out/admin.html`, "utf8"),
    readFile(`${projectRoot}/out/teacher.html`, "utf8"),
  ]);

  assert.doesNotMatch(adminHtml, /没有管理员权限/);
  assert.doesNotMatch(teacherHtml, /请前往管理中心/);
});
