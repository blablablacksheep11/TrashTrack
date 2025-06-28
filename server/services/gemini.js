import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY,
});

/**
 * Classify an image using Gemini AI
 * @param {string} imageBase64 - The base64 encoded image string
 * @returns {Promise<string>} - The classification result (paper, plastic, general)
 */
export default async function classifyWaste(imageBase64) {
  const contents = [
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64,
      },
    },
    {
      text: 'Is this a paper, plastic, or general waste. Return me the response in single vocabulary. Return general waste if multiple material detected.',
    },
  ];

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents,
  });

  if (response.error) throw new Error(response.error.message);

  return response.text.toLowerCase();
}
