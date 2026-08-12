# 备份与恢复

创建备份：`backend/scripts/backup_database.sh /安全备份目录`。脚本以仅当前用户可读的权限生成压缩 SQL、SHA-256 和元数据，默认保留 30 天；可用 `BACKUP_RETENTION_DAYS` 调整，设为 0 时不自动清理。

校验但不恢复：`backend/scripts/restore_database.sh /path/file.sql.gz --verify-only`。

真正恢复必须在隔离环境先演练，并显式加入 `--apply`。脚本要求输入目标数据库名确认，不接受空目标或通配符。恢复后依次检查迁移版本、表计数、登录、成长闭环和就绪探针。

目标：RPO 24 小时以内、RTO 4 小时以内。正式上线后应配置异地加密备份、月度恢复演练与演练记录。本次未对任何真实数据库执行恢复。
