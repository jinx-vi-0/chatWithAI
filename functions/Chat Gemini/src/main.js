import { Client, Users } from 'node-appwrite';
import fetch from 'node-fetch';
import { getStaticFile } from './utils/staticFile.js';

let conversationContext = [];

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
  
  const users = new Users(client);

  try {
    const response = await users.list();
    log(`Total users: ${response.total}`);
  } catch (err) {
    error("Could not list users: " + err.message);
  }

  if (req.method === 'GET') {
    return res.send(getStaticFile('index.html'), 200, {
      'Content-Type': 'text/html; charset=utf-8',
    });
  }

  if (req.method === 'POST') {
    const body = req.body;

    if (!body.prompt) {
      return res.json({ ok: false, error: 'Prompt is required' });
    }

    // Add the user's message to the conversation context
    conversationContext.push(`User: ${body.prompt}`);
  
    // Keep only the last 5 messages in the conversation
    const context = conversationContext.slice(-5).join('\n');
  
    // Construct the prompt for the AI
    const prompt = `${context}\nAI: Your output should be HTML. Do not include any heading or body tags. Just the content. Respond to greetings with a polite greeting.`;
  
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;
  
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received';
      
      // Add the AI's response to the conversation context
      conversationContext.push(`AI: ${generatedText}`);

      return res.json({ ok: true, output: generatedText });
    } catch (err) {
      return res.json({ ok: false, error: err.message });
    }
  }

  // Handle unsupported methods
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
};
