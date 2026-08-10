# Cross-Group Contracts

跨组数据交换的稳定接口定义。

## 使用规则

1. **强制使用**: 任何跨模块数据传输必须使用这里的 Schema，不得直接导入其他模块的 SQLAlchemy Model
2. **只增不改**: 新增字段可以，修改/删除已有字段需要跨组 Review
3. **不做业务逻辑**: Contract 只定义数据结构，不包含业务方法

## Contract → Owner → Consumer

| Contract | Owner | Consumers |
|----------|-------|-----------|
| `StudentSummary` | Shared | Group1, Group2, Group3 |
| `StudentAcademicProfile` | Shared | Group2, Group3 |
| `StudentCareerIntent` | Shared/Group2 | Group1, Group3 |
| `StudentPortraitSummary` | Group2 | Group1, Group3 |
| `GrowthProgressSummary` | Group2 | Group3 |
| `RoleModelMatchSummary` | Group2 | Group1, Group3 |
| `JobSummary` | Group3 | Group1, Group2 |
| `JobRequirementProfile` | Group3 | Group1, Group2 |
| `GeneratedResumeSummary` | Group1 | Group3 |
| `InterviewAssessmentSummary` | Group1 | Group3 |
| `JobMatchRequest` | Group3 | (internal assembly) |
| `JobMatchResult` | Group3 | Group1, Group2 |

## Mock Data

开发时如果依赖的 Contract 还没有真实数据源，使用:

```python
from app.tests.fixtures.mock_data import make_student_portrait

# Group3 开发匹配算法时，Group2 的画像还没建好:
portrait = make_student_portrait(user_id=1)
```

## 添加新 Contract

1. 确认新字段在实际数据库表中有对应列
2. 在本目录新建或扩展对应文件
3. 更新 `__init__.py` 的 `__all__`
4. 在 `tests/fixtures/mock_data.py` 添加 mock 生成器
5. 发 PR 并 @ 所有三个组的 Reviewer
