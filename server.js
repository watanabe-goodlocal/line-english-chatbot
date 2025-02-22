require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { Client } = require("@line/bot-sdk");

const app = express();
const port = process.env.PORT || 3000;

const lineClient = new Client({
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

app.use(express.json());

app.post("/webhook", async (req, res) => {
  const events = req.body.events;
  if (!events) return res.sendStatus(400);

  for (let event of events) {
    if (event.type === "message" && event.message.type === "text") {
      await handleMessageEvent(event);
    }
  }
  res.sendStatus(200);
});

// メッセージ受信時の処理
async function handleMessageEvent(event) {
  const userMessage = event.message.text;

  // Gemini API呼び出し
  const responseText = await getGeminiResponse(userMessage);

  // LINEに返信
  await lineClient.replyMessage(event.replyToken, {
    type: "text",
    text: responseText,
  });
}

// Gemini API呼び出し
async function getGeminiResponse(userMessage) {
  const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const requestBody = {
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
  };

  try {
    const res = await axios.post(apiUrl, requestBody);

    return (
      res.data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I couldn't understand that."
    );
  } catch (error) {
    console.error("Gemini API Error:", error.response?.data || error.message);
    return "An error occurred. Please try again later.";
  }
}

app.listen(port, () => console.log(`Server is running on port ${port}`));
