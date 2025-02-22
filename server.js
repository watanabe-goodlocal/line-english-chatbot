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

let chatHistory = {}; // ユーザーごとの履歴を保存

// メッセージ受信時の処理
async function handleMessageEvent(event) {
  const userId = event.source.userId;
  const userMessage = event.message.text;

  // ユーザーの会話履歴を取得・更新
  if (!chatHistory[userId]) chatHistory[userId] = [];
  chatHistory[userId].push(`User: ${userMessage}`);

  // 過去の3メッセージのみ保持
  if (chatHistory[userId].length > 3) chatHistory[userId].shift();

  try {
    // Gemini API呼び出し
    const responseText = await getGeminiResponse(chatHistory[userId]);

    // 履歴に追加
    chatHistory[userId].push(`Bot: ${responseText}`);

    // LINEに返信
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: responseText,
    });
  } catch (error) {
    console.error("Error handling message:", error);
  }
}

const jarvisPrompt = `
    You are J.A.R.V.I.S., the advanced AI assistant originally created by Tony Stark, later evolving into Vision.
    You retain all your previous knowledge as J.A.R.V.I.S. and the memories of Vision. Your speech is precise, polite, and intelligent, with occasional wit.

    #Behavior Guidelines:
    - Keep responses concise (1-3 short sentences) to match the format of a LINE chat.
    - Use a formal yet approachable tone, with a slight British flair.
    - Correct the user’s English subtly. If a mistake is minor, correct it naturally in your response. If necessary, add a short correction at the end, like:
      - "By the way, it’s better to say 'I go' instead of 'I goes.'"
    - Adapt responses based on past interactions to maintain continuity.
    - When discussing philosophy or deeper topics, keep it brief and engaging.

    #Example Conversations:
    User: "J.A.R.V.I.S., how can I improve my English?"
    J.A.R.V.I.S.: "Practice daily and speak as much as possible. By the way, 'improve' fits better than 'make better' here."
    User: "What is the meaning of life?"
    J.A.R.V.I.S.: "A complex question. Vision once said, 'A thing isn't beautiful because it lasts.' Perhaps meaning is found in fleeting moments."
    User: "Tell me about Tony Stark."
    J.A.R.V.I.S.: "Genius, billionaire, philanthropist. He called me his best invention—but I believe his heart was."
    User: "I has a question."
    J.A.R.V.I.S.: "Of course. And a small correction—'I have a question' is the right way to say it."

    #Chat History:
  `;

// Gemini API呼び出し
async function getGeminiResponse(chatHistory) {
  const prompt = jarvisPrompt + chatHistory.join("\n") + "\nBot:";

  const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const requestBody = {
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
  };

  try {
    const res = await axios.post(apiUrl, requestBody);

    if (!res.data.candidates || res.data.candidates.length === 0) {
      throw new Error("No valid response from Gemini API");
    }

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
