# 高考就业导向专业参考站（理科）

面向理科本科考生的就业导向静态网站：近五年就业形势 + 绿牌推荐专业 + 专业对应岗位。

## 本地运行
```bash
cd gaokao-employment-site
python3 -m http.server 8000   # 或任意静态服务器
# 浏览器打开 http://localhost:8000/
```

## 数据校验
```bash
node scripts/validate-data.mjs
```

## 数据来源
就业数据以麦可思《就业蓝皮书》绿牌口径为主，夸克 + 媒体交叉核验。
每条数据的来源与判定见 `data/data-review.md`。
