import { GoogleGenAI } from "@google/genai";

export async function summarizeLog(log: any[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return "Error: API Key no configurada.";
  }

  const ai = new GoogleGenAI({ apiKey });
  const logText = log.map(entry => `[${entry.date}] ${entry.text}`).join('\n');
  const prompt = `Actúa como un asistente experto en logística. Resume el siguiente historial de bitácora de un proceso de adquisición en exactamente 2 líneas, destacando el estado actual y los próximos pasos:\n\n${logText}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp", // Using 2.0 flash as it's the current high-perf flash model
      contents: prompt,
    });

    return response.text || "No se pudo generar el resumen.";
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "Error al conectar con la IA.";
  }
}
