
import fetch from 'node-fetch';

module.exports = async function realOpenAILLM(aggregates) {

  const text = JSON.stringify(aggregates, null, 2);

  const prompt = `
You are an expert systems engineer. Analyze the following aggregated server metrics:

${text}

Provide:
- trends
- anomalies
- spikes or drifts
- high-level recommendations
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();

  return data.choices?.[0]?.message?.content || 'No insights generated.';

};