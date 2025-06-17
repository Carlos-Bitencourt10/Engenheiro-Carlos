export default async function handler(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        const { formData, files } = req.body;

        // Configuração da API Groq
        const GROQ_API_KEY = process.env.GROQ_API_KEY || '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';

        const prompt = `
Você é um especialista em licenciamento ambiental brasileiro. Analise os dados fornecidos para um Memorial de Caracterização do Empreendimento (MCE) e forneça:

1. Análise técnica dos dados
2. Sugestões de melhorias
3. Pontos de atenção regulamentares

DADOS DO EMPREENDIMENTO:
- Empresa: ${formData.razaoSocial}
- CNPJ: ${formData.cnpj}
- Atividade: ${formData.atividadePrincipal}
- Funcionários: ${formData.funcionarios}
- Produção: ${formData.producaoAnual}
- Consumo de água: ${formData.consumoAgua} m³/dia
- Processo: ${formData.descricaoProcesso}
- Documentos anexados: ${files?.length || 0} arquivo(s)

Forneça sua resposta em formato JSON com:
{
  "analysis": "análise técnica detalhada",
  "suggestions": ["sugestão 1", "sugestão 2", "sugestão 3"],
  "warnings": ["ponto de atenção 1", "ponto de atenção 2"],
  "compliance": "avaliação de conformidade legal"
}`;

        // Chamada para API Groq
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    {
                        role: 'system',
                        content: 'Você é um consultor ambiental especializado em licenciamento no Brasil. Seja preciso, técnico e foque na conformidade com CONAMA, SEMAD e legislação ambiental.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 1500,
                temperature: 0.3
            })
        });

        if (!groqResponse.ok) {
            throw new Error(`Erro Groq API: ${groqResponse.status}`);
        }

        const groqResult = await groqResponse.json();
        let aiResponse = groqResult.choices[0].message.content;

        // Tentar extrair JSON da resposta
        let analysisResult;
        try {
            // Encontrar JSON na resposta
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysisResult = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('JSON não encontrado');
            }
        } catch (e) {
            // Fallback: criar estrutura manual
            analysisResult = {
                analysis: aiResponse,
                suggestions: [
                    "Verificar conformidade da outorga de água",
                    "Revisar sistema de tratamento de efluentes",
                    "Confirmar licenças ambientais vigentes"
                ],
                warnings: [
                    "Atenção aos prazos de renovação de licenças",
                    "Monitorar parâmetros de qualidade da água"
                ],
                compliance: "Análise detalhada necessária"
            };
        }

        res.status(200).json(analysisResult);

    } catch (error) {
        console.error('Erro na análise:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: error.message 
        });
    }
}
