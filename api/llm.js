
//const fetch = require('fetch');

module.exports = async function generateInsightsLLM(aggregates) {

  const restructured = restructureForLLM(aggregates);

  // For initial testing without LLM -> mock summary
  let insights;
  if (!process.env.LLM_API_KEY) {
    insights = mockInsights(restructured);
  }
  else
    insights = await realOpenAILLM(restructured);

  return [ insights, restructured ];

};

async function realOpenAILLM(restructured) {

  const text = JSON.stringify(restructured, null, 2);

  const prompt = `
You are an expert platform engineer. Analyze the following aggregated server metrics:

${text}

Note: CPU and Memory in Percent usage, Disk I/O and Net I/O in MB/s

Look for:
- trends in comparison across servers
- anomalies and patterns
- spikes, memory leaks -> OOMKill or drifts
- high demand or low resources

<analyze>`;
//Emphasize important points at high-level.
//- high-level recommendations

  //console.log('Making API Request:', text);
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

}

function mockInsights(aggregates) {
  const summary = [];

  for (const serverId of Object.keys(aggregates)) {
    summary.push(
      `Server ${serverId} shows ${aggregates[serverId].length} aggregated metric entries -- Mock LLM.`
    );
  }

  return summary.join('\n');
}

function restructureForLLM(rows) {
  const result = {};

  for (const r of rows) {
    const server = r.server_id;
    const ts = r.ts.toISOString();

    if (!result[server]) result[server] = {};
    if (!result[server][ts]) result[server][ts] = { ts: r.ts.getTime() };

    if (!result[server][ts][r.metric_type]) {
      result[server][ts][r.metric_type] = Number(Number(r.avg_value).toFixed(2));
    }
  }

  // Convert timestamp objects → sorted arrays
  for (const server of Object.keys(result)) {
    const tsMap = result[server];
    result[server] = Object.values(tsMap)
      .sort((a, b) => new Date(a.ts) - new Date(b.ts));
  }

  return result;
}
