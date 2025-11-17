import arcjet, { shield, detectBot, slidingWindow } from "@arcjet/node";
import { ENV } from "./env.js";
const aj = arcjet({
key: ENV.ARCJET_KEY,
rules: [
// Shield: Chống các đợt tấn công cơ bản (ví dụ: SQL injection)
shield({ mode: "LIVE" }),
// Cài đặt luật phát hiện bot
detectBot({
mode: "LIVE", // "LIVE": Chặn luôn. Dùng "DRY_RUN" thì chỉ log lại chứ không chặn
// Chặn tất cả bot, ngoại trừ mấy con bot này:
allow: [
"CATEGORY:SEARCH_ENGINE", // Bot của Google, Bing, v.v.
// Bỏ comment mấy dòng dưới nếu muốn cho phép các loại bot phổ biến khác
//full list ở đây nhé: https://arcjet.com/bot-list
//"CATEGORY:MONITOR", // Bot theo dõi uptime
//"CATEGORY:PREVIEW", // Bot tạo preview link (của Slack, Discord...)
],
}),
// Cài đặt rate limit (giới hạn yêu cầu)
slidingWindow({
mode: "LIVE",
max: 100,
interval: 60,
}),
],
});
export default aj;