export type FacultySeed = {
  id: number;
  name: string;
  title: string;
  position: string;
  mentorLevel: "博士研究生导师" | "硕士研究生导师" | "教师";
  researchAreas: string[];
  email: string;
  description: string;
  profileUrl: string;
};

export type FacultyRecord = FacultySeed & {
  school: string;
  college: string;
  sourceUpdatedAt: string;
  displayOrder: number;
};

export const imnuAiFacultySnapshot = {
  school: "内蒙古师范大学",
  college: "人工智能学院",
  sourceUrl: "https://sai.imnu.edu.cn/faculty/jsml.htm",
  mentorSourceUrl: "https://sai.imnu.edu.cn/faculty/dsml.htm",
  updatedAt: "2026-07-16",
  faculty: [
    { id: 2421, name: "焦李成", title: "华山学者杰出教授", position: "", mentorLevel: "博士研究生导师", researchAreas: ["智能感知与图像理解", "深度学习与类脑计算", "进化优化与遥感解译"], email: "jiao@imnu.edu.cn", description: "欧洲科学院外籍院士、俄罗斯自然科学院外籍院士、IEEE Life Fellow，长期从事智能感知、图像理解与类脑计算研究。", profileUrl: "https://sai.imnu.edu.cn/info/1081/2421.htm" },
    { id: 1121, name: "公茂果", title: "二级教授", position: "人工智能学院院长（兼）", mentorLevel: "博士研究生导师", researchAreas: ["人工智能", "协同智能系统"], email: "gong@imnu.edu.cn", description: "国家级领军人才、IEEE Fellow，现为内蒙古师范大学党委委员、副校长、人工智能学院院长（兼）。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1121.htm" },
    { id: 1131, name: "陈宏研", title: "", position: "学院党总支负责人", mentorLevel: "教师", researchAreas: ["学院管理"], email: "", description: "蒙古族，中共党员，硕士研究生，现任人工智能学院党总支负责人。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1131.htm" },
    { id: 1141, name: "李艳玲", title: "教授", position: "", mentorLevel: "博士研究生导师", researchAreas: ["自然语言处理", "法律人工智能", "机器学习"], email: "", description: "工学博士、博士研究生导师，主要研究方向为自然语言处理、法律人工智能与机器学习。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1141.htm" },
    { id: 1151, name: "白双成", title: "研究员（三级）", position: "", mentorLevel: "硕士研究生导师", researchAreas: ["语言智能", "多语种信息处理"], email: "bsc@imnu.edu.cn", description: "北京语言大学语言工程方向博士，雄鹰计划引进人才，研究方向为语言智能与多语种信息处理。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1151.htm" },
    { id: 1161, name: "张丽娜", title: "四级教授", position: "", mentorLevel: "博士研究生导师", researchAreas: ["信息智能感知与智慧牧业", "现代信息技术与物理学科教学"], email: "", description: "蒙古族，工学博士、博士研究生导师，研究方向为信息智能感知、智慧牧业和现代信息技术教学。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1161.htm" },
    { id: 2461, name: "玉山", title: "教授", position: "", mentorLevel: "博士研究生导师", researchAreas: ["地理科学", "地理信息系统"], email: "yushangis@163.com", description: "蒙古族，博士、教授、博士生导师，主要从事地理科学及相关交叉方向研究。", profileUrl: "https://sai.imnu.edu.cn/info/1081/2461.htm" },
    { id: 1181, name: "额尔敦陶克素", title: "", position: "", mentorLevel: "教师", researchAreas: ["软件工程", "系统分析", "数据库应用"], email: "", description: "研究与教学方向涵盖软件工程、系统分析和数据库应用。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1181.htm" },
    { id: 1171, name: "包秀荣", title: "副教授", position: "", mentorLevel: "硕士研究生导师", researchAreas: ["高速光信号处理", "模式识别", "通信技术"], email: "", description: "蒙古族，工学博士、硕士研究生导师，主要从事高速光信号处理、模式识别和通信技术研究。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1171.htm" },
    { id: 1231, name: "杨帆", title: "副教授", position: "", mentorLevel: "硕士研究生导师", researchAreas: ["散射雷达", "软件无线电", "深度学习", "虚拟仿真教学"], email: "", description: "硕士生导师，主要研究人工智能、机器人、生物雷达与虚拟仿真教学。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1231.htm" },
    { id: 1191, name: "包正义", title: "副教授", position: "", mentorLevel: "硕士研究生导师", researchAreas: ["生态环境建模", "大气碳源汇模拟", "计算机遥感应用"], email: "bzy@lreis.ac.cn", description: "中国科学院地理科学与资源研究所博士，主要从事生态环境建模、大气碳源汇模拟和计算机遥感应用。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1191.htm" },
    { id: 1221, name: "张珏", title: "副教授", position: "", mentorLevel: "硕士研究生导师", researchAreas: ["信息与智能感知技术", "农畜产品智能化检测"], email: "", description: "工学博士、硕士研究生导师，致力于农畜产品加工及智能化检测技术的研发与推广。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1221.htm" },
    { id: 1261, name: "常明扬", title: "", position: "", mentorLevel: "硕士研究生导师", researchAreas: ["智能超表面", "无线能量传输", "携能通信"], email: "", description: "电子科学与技术博士，主要从事智能超表面、无线能量传输和携能通信研究。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1261.htm" },
    { id: 1211, name: "梁学军", title: "讲师", position: "", mentorLevel: "教师", researchAreas: ["计算机科学", "教育技术"], email: "", description: "长期从事计算机科学与教育技术相关教学工作。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1211.htm" },
    { id: 1201, name: "吴晓庆", title: "", position: "", mentorLevel: "硕士研究生导师", researchAreas: ["智慧畜牧业"], email: "", description: "蒙古族，主要研究方向为智慧畜牧业。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1201.htm" },
    { id: 1241, name: "鲍伶波", title: "讲师", position: "", mentorLevel: "硕士研究生导师", researchAreas: ["微磁学模拟"], email: "", description: "理学博士、硕士研究生导师，主要从事微磁学模拟研究。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1241.htm" },
    { id: 1281, name: "郝帅", title: "", position: "", mentorLevel: "硕士研究生导师", researchAreas: ["图像超分辨率", "语义分割", "大模型技术"], email: "", description: "工学博士，入选“英才兴蒙”人才计划第六类，主要从事图像处理、语义分割和大模型技术研究。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1281.htm" },
    { id: 1251, name: "赵宏宇", title: "", position: "", mentorLevel: "硕士研究生导师", researchAreas: ["人工智能", "图像处理", "电子电路", "智能系统"], email: "dmhz@live.cn", description: "工学博士、硕士研究生导师，研究方向涵盖人工智能、图像处理、电子电路和智能系统。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1251.htm" },
    { id: 1271, name: "杜敏康", title: "讲师", position: "", mentorLevel: "硕士研究生导师", researchAreas: ["大气水汽输运及动力机制", "区域气候变化"], email: "", description: "理学博士，主要从事大气水汽输运及其动力机制、区域气候变化研究。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1271.htm" },
    { id: 2451, name: "陈佳乐", title: "讲师", position: "", mentorLevel: "硕士研究生导师", researchAreas: ["深度学习", "低光照图像增强", "水下图像增强", "医学图像增强"], email: "", description: "信息与通信工程博士，主要从事深度学习及低光照、水下和内窥镜医学图像增强研究。", profileUrl: "https://sai.imnu.edu.cn/info/1081/2451.htm" },
    { id: 2471, name: "李广飞", title: "", position: "", mentorLevel: "硕士研究生导师", researchAreas: ["小样本学习", "多模态遥感影像智能解译"], email: "", description: "西安电子科技大学博士，主要从事小样本学习和多模态遥感影像智能解译研究。", profileUrl: "https://sai.imnu.edu.cn/info/1081/2471.htm" },
    { id: 2501, name: "张敬超", title: "", position: "", mentorLevel: "硕士研究生导师", researchAreas: ["工业智能监测与诊断", "边缘智能计算", "可解释深度学习"], email: "", description: "信息与通信工程博士，主要从事工业智能监测与诊断、边缘智能计算和可解释深度学习研究。", profileUrl: "https://sai.imnu.edu.cn/info/1081/2501.htm" },
    { id: 2971, name: "刘凯", title: "", position: "", mentorLevel: "硕士研究生导师", researchAreas: ["计算机视觉", "目标计数", "视觉语言多模态", "低空遥感"], email: "", description: "重庆大学软件工程博士，研究方向为计算机视觉、目标计数、视觉语言多模态与低空遥感。", profileUrl: "https://sai.imnu.edu.cn/info/1081/2971.htm" },
    { id: 2991, name: "武子丰", title: "讲师", position: "", mentorLevel: "教师", researchAreas: ["人工智能与地貌学交叉应用", "干旱区风沙地貌演化", "土地沙漠化监测与风险评估"], email: "", description: "博士、讲师，主要从事人工智能与地貌学交叉应用、干旱区风沙地貌和土地沙漠化监测研究。", profileUrl: "https://sai.imnu.edu.cn/info/1081/2991.htm" },
    { id: 3401, name: "魏生", title: "讲师", position: "", mentorLevel: "教师", researchAreas: ["人工智能", "声固耦合", "声源定位"], email: "", description: "工学博士、讲师，主要从事人工智能、声固耦合和声源定位研究。", profileUrl: "https://sai.imnu.edu.cn/info/1081/3401.htm" },
    { id: 1291, name: "宝力尔", title: "助理研究员", position: "", mentorLevel: "教师", researchAreas: ["学院管理"], email: "", description: "蒙古族，中共党员，硕士研究生，助理研究员。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1291.htm" },
    { id: 1301, name: "刘志英", title: "", position: "", mentorLevel: "教师", researchAreas: ["学院管理"], email: "", description: "中共党员，大学本科学历，学士学位。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1301.htm" },
    { id: 1311, name: "王一鹤", title: "", position: "学就办主任兼综合办主任", mentorLevel: "教师", researchAreas: ["学生与综合管理"], email: "", description: "硕士研究生，现任学就办主任兼综合办主任。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1311.htm" },
    { id: 1571, name: "于洋", title: "", position: "", mentorLevel: "教师", researchAreas: ["学院管理"], email: "", description: "蒙古族，中共党员，博士研究生。", profileUrl: "https://sai.imnu.edu.cn/info/1081/1571.htm" },
    { id: 2491, name: "赵泰莹", title: "", position: "", mentorLevel: "教师", researchAreas: ["学院管理"], email: "", description: "蒙古族，大学本科学历，学士学位。", profileUrl: "https://sai.imnu.edu.cn/info/1081/2491.htm" },
  ] satisfies FacultySeed[],
};
