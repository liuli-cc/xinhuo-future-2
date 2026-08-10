# 薪火未来 — 数据库设计文档

## 设计原则

1. **分层设计**: 标准字典层、组织层、用户层、业务层、导入层
2. **禁止巨型表**: 就业数据不创建104列大表，拆分为多个关联实体
3. **柔性科目**: 高考成绩使用键值对设计，支持新旧高考模式
4. **原始数据保留**: 所有Excel数据先入staging层，再清洗入库
5. **敏感数据隔离**: 学生隐私信息单独表，默认API不返回
6. **扩展性**: 所有字典使用namespace+code模式，不硬编码中文枚举

## 字符集

全部使用 `utf8mb4`，排序规则 `utf8mb4_unicode_ci`

## 时间戳

- `created_at`, `updated_at`: MySQL DATETIME(timezone=True)
- 业务时间戳 (如 `expires_at`, `last_seen_at`): Unix毫秒整数（兼容旧系统）

---

## ER Diagram (Mermaid)

```mermaid
erDiagram
    %% ── Reference Layer ──
    ref_major_standard {
        int id PK
        string discipline_name "学科门类"
        string major_category_name "专业类"
        string major_name "专业名称"
        string major_code "专业代码(NULLABLE)"
        string source
        bool is_active
    }

    ref_job_standard {
        int id PK
        string job_domain "岗位大类"
        string job_category "岗位类"
        string job_name "岗位名称"
        json aliases
        bool is_active
    }

    ref_code_values {
        int id PK
        string namespace
        string code
        string label
        string parent_code
        json metadata
    }

    %% ── Organization Layer ──
    universities {
        int id PK
        string name
        string short_name
        string code UK
    }

    colleges {
        int id PK
        int university_id FK
        string name
    }

    university_major_programs {
        int id PK
        int university_id FK
        int college_id FK
        int standard_major_id FK "可NULL"
        string major_code
        string major_name
        string degree_category
        int study_years
        string mapping_status
    }

    %% ── Users Layer ──
    users {
        int id PK
        string student_id UK "学号/工号"
        string name
        string email
        string role "student/teacher/counselor/college_admin/school_admin/admin"
        string account_status "pending/active/rejected/suspended"
        string password_hash "SECRET"
        string password_salt "SECRET"
        string college
        string major
        string class_name
        json interests
    }

    student_profiles {
        int id PK
        int user_id FK_UK
        string student_no UK
        int college_id FK
        int major_program_id FK
        string class_name
        string enrollment_date
        string graduation_date
    }

    student_private_profiles {
        int id PK
        int student_id FK_UK
        string real_name
        string id_card "ENCRYPTED"
        string phone
        string ethnicity
        string political_status
    }

    teacher_profiles {
        int id PK
        int user_id FK_UK
        string staff_no UK
        int college_id FK
        string title
    }

    user_sessions {
        string id PK "SHA256(token)"
        int user_id FK
        int expires_at
        int revoked_at
    }

    %% ── Admission Layer ──
    student_admissions {
        int id PK
        int student_id FK
        string candidate_no
        string source_province
        int normalized_major_id FK
        string subject_stream
        float filing_score
        int admission_year
    }

    student_admission_scores {
        int id PK
        int admission_id FK
        string subject_code
        string subject_name
        float score
    }

    %% ── Employment Layer ──
    employers {
        int id PK
        string name
        string unified_social_credit_code UK
        string organization_type
        string industry
    }

    student_employments {
        int id PK
        int student_id FK
        int employer_id FK
        string destination_code
        int job_standard_id FK
        string job_title_raw
        string audit_status
    }

    employment_reviews {
        int id PK
        int employment_id FK
        int reviewer_id FK
        string status
        string reason
    }

    study_abroad_records {
        int id PK
        int student_id FK
        string institution_name
        string country_region
    }

    %% ── Files & Import Layer ──
    files {
        string id PK "UUID"
        string owner_type
        string owner_id
        string object_key "COS key"
        string original_filename
        string mime_type
        int file_size
        string sha256
    }

    data_import_batches {
        int id PK
        string source_type
        string source_filename
        int source_year
        string status
        int total_rows
    }

    data_import_rows {
        int id PK
        int batch_id FK
        int row_number
        json raw_data
        string normalized_status
        string target_table
        string target_id
    }

    %% ── Relationships ──
    universities ||--o{ colleges : ""
    colleges ||--o{ university_major_programs : ""
    ref_major_standard ||--o{ university_major_programs : "standard_major_id"
    users ||--o| student_profiles : ""
    users ||--o| teacher_profiles : ""
    student_profiles ||--o| student_private_profiles : ""
    colleges ||--o{ student_profiles : ""
    university_major_programs ||--o{ student_profiles : ""
    users ||--o{ user_sessions : ""
    student_profiles ||--o{ student_admissions : ""
    student_admissions ||--o{ student_admission_scores : ""
    student_profiles ||--o{ student_employments : ""
    employers ||--o{ student_employments : ""
    ref_job_standard ||--o{ student_employments : ""
    student_employments ||--o{ employment_reviews : ""
    student_profiles ||--o{ study_abroad_records : ""
    data_import_batches ||--o{ data_import_rows : ""
    users ||--o{ files : "created_by"
```

## 关键设计决策

### 1. 高考成绩为什么使用键值对

不同省份、不同年份高考科目不同：
- 旧高考: 语文、数学、外语、理综/文综
- 新高考 3+1+2: 语文、数学、外语 + 物理/历史 + 化学/生物/地理/政治
- 艺术类: 专业课成绩

使用 `student_admission_scores(subject_code, subject_name, score)` 键值设计，
新增科目不需要修改数据库结构。

### 2. 就业数据为什么不建104列大表

就业数据字段包含：
- 学生基本信息 (~15字段)
- 就业去向 (~10字段)
- 升学/留学 (~5字段)
- 审核信息 (~5字段)
- 档案转递 (~10字段)
- 户口迁移 (~5字段)
- 行政信息 (~50+字段)

拆分为:
- `student_employments` — 核心就业数据
- `employers` — 用人单位（可复用）
- `employment_reviews` — 审核历史
- `study_abroad_records` — 留学记录
- `graduate_administration` — 行政信息
- `data_import_rows.raw_data` — 未结构化字段暂存

### 3. 敏感数据隔离

`student_private_profiles` 与 `student_profiles` 分离：
- 身份证、手机号、住址等敏感信息单独存储
- 默认 API 不返回 private_profiles
- 日志系统自动屏蔽敏感字段
- 预留应用层加密能力

### 4. 原始数据暂存层

所有 Excel 导入的数据首先进入:
1. `data_import_batches` (批次记录)
2. `data_import_rows` (逐行原始JSON)

然后经过清洗、验证、标准化后进入业务表。
原始数据永久保留，支持：
- 不同年份格式差异
- 字段新增/删除
- 数据纠错和回溯
