import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // POSTメソッド以外は許可しない
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { pdfText } = req.body;

    // リクエストボディのバリデーション
    if (!pdfText) {
      return res.status(400).json({ error: 'pdfText is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error: API key is missing' });
    }

    // Gemini APIクライアントの初期化
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // モデルの取得。JSON形式での出力を強制する
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const prompt = `以下のテキストから月曜日〜金曜日の時間割（科目、先生、教室）を抽出し、以下のJSONフォーマットのみを出力して。

フォーマット指定：
{
  "timetable": {
    "月": [ {"subject": "科目名", "teacher": "先生名", "room": "教室名"} ],
    "火": [ {"subject": "科目名", "teacher": "先生名", "room": "教室名"} ],
    "水": [ {"subject": "科目名", "teacher": "先生名", "room": "教室名"} ],
    "木": [ {"subject": "科目名", "teacher": "先生名", "room": "教室名"} ],
    "金": [ {"subject": "科目名", "teacher": "先生名", "room": "教室名"} ]
  }
}

テキスト：
${pdfText}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // 文字列として返ってきたJSONをパースして、フロントにJSONとして返す
    const parsedData = JSON.parse(text);
    return res.status(200).json(parsedData);

  } catch (error) {
    console.error("Gemini API Error:", error);
    // エラー時はステータスコード500で返す
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      details: error.message 
    });
  }
}