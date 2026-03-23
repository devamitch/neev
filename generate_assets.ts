import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateImage() {
  console.log("Generating hero image...");
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: {
      parts: [
        {
          text: 'A premium, editorial-style photograph of a modern Asian family (Indian) in a warm, minimalist, sunlit home. The mood is calm, structured, and deeply connected. Soft natural lighting, cream and sage green tones, high-end magazine aesthetic, like Vogue India meets a wellness journal. No clutter, very elegant. Portrait orientation.',
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "3:4",
        imageSize: "1K"
      }
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const base64Data = part.inlineData.data;
      const buffer = Buffer.from(base64Data, 'base64');
      const publicDir = path.join(process.cwd(), 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir);
      }
      fs.writeFileSync(path.join(publicDir, 'hero-family.png'), buffer);
      console.log("Hero image saved to public/hero-family.png");
    }
  }
}

generateImage().catch(console.error);
