# liuli 面试搭档：模型来源与许可

本版使用为薪火未来项目新编写的原创小熊猫形象，不使用影视、游戏或动画角色的名称、外形文件、贴图、骨骼或动画。源模型即 `frontend/modules/group-1-interview/avatar/liuli-rig.ts` 中可编辑的几何、材质和关节定义；静态兼容形象在 `VirtualInterviewer.tsx` 中。

这些新增源码及原创几何遵循仓库根目录 `LICENSE` 的 MIT 许可（Copyright (c) 2026 liuli-cc）。该许可允许使用、修改、分发及商业使用，分发时保留 MIT 版权与许可声明。没有新增付费素材、远程模型 CDN、字体、纹理或第三方人物形象依赖。渲染依赖 Three.js，沿用项目已有依赖及其 MIT 许可。

## 本次候选素材核查

2026-09-23 检查了 Quaternius 官方 [Ultimate Monsters](https://quaternius.com/packs/ultimatemonsters.html) 素材页：该页明确标注 CC0 并允许个人与商业项目使用。Creative Commons 的 [CC0 官方说明](https://creativecommons.org/publicdomain/zero/1.0/) 说明复制、修改和分发的商业用途授权范围。这套素材未被下载、改编或包含在本项目中；它适用于今后扩展角色的候选库。本版使用原创源码模型以直接控制面试所需的嘴部、眉眼、耳朵、双臂、腿部与尾巴动作。

## 动作与性能边界

- `idle / listening / thinking / speaking / scoring` 驱动姿态过渡；`audioLevel` 驱动说话强度，`inputLevel` 可单独驱动倾听反应。
- 口型是音量与节奏驱动的表情动画，不是音素级唇形同步。没有可用播放音量时使用说话节奏近似。
- 减少动态效果时切换静态表情；页面隐藏、角色离开视口或 WebGL 上下文丢失时停止绘制。WebGL 不可用时显示原创 SVG 形象。
- 角色互动最多 60 帧/秒，待机最多 30 帧/秒，像素倍率上限 1.5。重复静态细节按关节实例化，材质与几何共用；卸载时释放 GPU 资源。

本次没有引入额外素材许可义务。以上来源核查记录不代表第三方作者为薪火未来提供背书。
