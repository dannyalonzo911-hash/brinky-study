# Brinky Study Cloud

A cloud-hostable version of Brinky Study. It does **not** use Ollama or OpenAI credits. It uses the Gemini Developer API from the server side, so the API key never appears in the browser.

## Local test

1. Install Node.js 18+.
2. Create a Gemini Developer API key in Google AI Studio.
3. Open Command Prompt in this folder.
4. Run:

   set "GEMINI_API_KEY=YOUR_KEY_HERE"
   node server.js

5. Open http://localhost:3000

## Render deployment (no Vercel)

This repo includes `render.yaml` for a free Render web service.

1. Put this folder in a GitHub repository.
2. In Render, create a new Web Service from that repository (or use the Blueprint from `render.yaml`).
3. Choose the Free instance if prompted.
4. Add environment variable `GEMINI_API_KEY` with your Gemini API key.
5. Deploy.
6. Render gives you an HTTPS public URL you can open from another device.

Optional environment variable:
- `GEMINI_MODEL=gemini-2.5-flash`

## Notes

- The free Render web service may spin down after inactivity, so the first request after a while can be slower.
- Chat history is saved in the browser using localStorage, not in a database.
- Never put the Gemini key into `public/app.js`, HTML, or any client-side file.
