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
        const { formData, files, analysis } = req.body;

        // Configuração das APIs
        const GROQ_API_KEY = process.env.GROQ_API_KEY || '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';
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAU4L2t6ix4N9sjZTUyhzDv2iB6-apIefs';

        // Prompt para geração do MCE
        const mcePrompt = `
Você é um especialista em elaboração de documentos ambientais. Gere um Memorial de Caracterização do Empreendimento (MCE) completo e profissional baseado nos dados fornecidos.

DADOS DO EMPREENDIMENTO:
- Razão Social: ${formData.razaoSocial}
- CNPJ: ${formData.cnpj}
- Endereço: ${formData.endereco}
- Coordenadas: ${formData.latitude}, ${formData.longitude}
- Atividade Principal: ${formData.atividadePrincipal}
- Funcionários: ${formData.funcionarios}
- Funcionamento: ${formData.funcionamentoHoras}
- Produção Anual: ${formData.producaoAnual}
- Matéria-Prima: ${formData.materiaPrima}
- Área Total: ${formData.areaTotal} m²
- Área Construída: ${formData.areaConstruida} m²
- Consumo de Água: ${formData.consumoAgua} m³/dia
- Corpo Receptor: ${formData.corpoReceptor}
- Responsável Técnico: ${formData.nomeRT}
- CREA: ${formData.creaRT}
- Processo Produtivo: ${formData.descricaoProcesso}
- Tipo de Licenciamento: ${formData.tipoLicenciamento}

${analysis ? `ANÁLISE PRÉVIA DA IA: ${JSON.stringify(analysis)}` : ''}

Gere um MCE completo seguindo a estrutura padrão brasileira:

1. APRESENTAÇÃO
- Definir o documento como MCE
- Propósito para licenciamento ambiental
- Contextualizar o tipo de licenciamento solicitado

2. IDENTIFICAÇÃO DO EMPREENDIMENTO
- Dados cadastrais completos
- Localização com coordenadas
- Natureza da atividade

3. CARACTERIZAÇÃO DO EMPREENDIMENTO
- Natureza do empreendimento
- Mão de obra (número de funcionários)
- Período de funcionamento
- Áreas do empreendimento

4. DESCRIÇÃO DETALHADA DO PROCESSO PRODUTIVO
- Fluxograma conceitual do processo
- Descrição de cada etapa
- Matérias-primas utilizadas
- Produtos gerados

5. FONTES DE ABASTECIMENTO DE ÁGUA
- Identificação das fontes
- Vazões captadas
- Situação das outorgas

6. EFLUENTES LÍQUIDOS GERADOS
- Origem dos efluentes
- Sistema de tratamento
- Destino final
- Conformidade com legislação

7. RESÍDUOS SÓLIDOS
- Tipos de resíduos gerados
- Classificação conforme NBR 10004
- Formas de acondicionamento
- Destinação final

8. EMISSÕES ATMOSFÉRICAS
- Fontes de emissão
- Tipos de poluentes
- Sistemas de controle
- Monitoramento

9. FONTES DE RUÍDO E VIBRAÇÕES
- Identificação das fontes
- Medidas de controle adotadas
- Conformidade com legislação

10. RESPONSÁVEL TÉCNICO
- Dados do profissional
- ART/RRT
- Formação e especialização

11. DECLARAÇÕES E RESPONSABILIDADES
- Declaração de veracidade
- Responsabilidade técnica
- Compromissos ambientais

12. ANEXOS
- Lista de documentos anexados
- Referências técnicas utilizadas

Use linguagem técnica e formal. Seja detalhado e específico. Inclua todas as informações relevantes para licenciamento ambiental. Cite legislações pertinentes como CONAMA 430/2011, 357/2005, NBR 10004, Lei 12.305/2010.
`;

        // Chamada para Groq (principal)
        let mceContent = '';
        let apiUsed = '';

        try {
            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.1-70b-versatile',
                    messages: [
                        {
                            role: 'system',
                            content: 'Você é um consultor ambiental sênior especializado em elaboração de MCEs no Brasil. Gere documentos técnicos completos, precisos e em conformidade com a legislação brasileira. Use terminologia técnica adequada e estruture o documento de forma profissional.'
                        },
                        {
                            role: 'user',
                            content: mcePrompt
                        }
                    ],
                    max_tokens: 4000,
                    temperature: 0.2
                })
            });

            if (groqResponse.ok) {
                const groqResult = await groqResponse.json();
                mceContent = groqResult.choices[0].message.content;
                apiUsed = 'Groq Llama 3.1';
            } else {
                throw new Error(`Groq API falhou: ${groqResponse.status}`);
            }
        } catch (groqError) {
            console.log('Groq falhou, tentando Gemini:', groqError.message);
            
            // Fallback: usar Gemini
            try {
                const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: mcePrompt
                            }]
                        }]
                    })
                });

                if (geminiResponse.ok) {
                    const geminiResult = await geminiResponse.json();
                    mceContent = geminiResult.candidates[0].content.parts[0].text;
                    apiUsed = 'Google Gemini';
                } else {
                    throw new Error(`Gemini API falhou: ${geminiResponse.status}`);
                }
            } catch (geminiError) {
                throw new Error(`Ambas APIs falharam. Groq: ${groqError.message}, Gemini: ${geminiError.message}`);
            }
        }

        // Pós-processamento do conteúdo
        const processedContent = postProcessMCE(mceContent, formData, apiUsed);

        res.status(200).json({
            content: processedContent,
            metadata: {
                generatedAt: new Date().toISOString(),
                company: formData.razaoSocial,
                pages: Math.ceil(processedContent.length / 3000),
                sections: 12,
                aiEngine: apiUsed
            }
        });

    } catch (error) {
        console.error('Erro na geração:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: error.message 
        });
    }
}

function postProcessMCE(content, formData, apiUsed) {
    const currentDate = new Date().toLocaleDateString('pt-BR');
    const currentTime = new Date().toLocaleTimeString('pt-BR');
    
    // Cabeçalho profissional
    const header = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    MEMORIAL DE CARACTERIZAÇÃO DO EMPREENDIMENTO             ║
║                                    (MCE)                                     ║
╚══════════════════════════════════════════════════════════════════════════════╝

EMPRESA: ${formData.razaoSocial}
CNPJ: ${formData.cnpj}
ENDEREÇO: ${formData.endereco}

DOCUMENTO TÉCNICO ELABORADO PARA FINS DE LICENCIAMENTO AMBIENTAL
${formData.tipoLicenciamento === 'LP' ? 'LICENÇA PRÉVIA (LP)' : 
  formData.tipoLicenciamento === 'LI' ? 'LICENÇA DE INSTALAÇÃO (LI)' : 
  formData.tipoLicenciamento === 'LO' ? 'LICENÇA DE OPERAÇÃO (LO)' : 
  'LICENCIAMENTO CORRETIVO (LC)'}

Data de Elaboração: ${currentDate} às ${currentTime}
Responsável Técnico: ${formData.nomeRT}
Registro Profissional: ${formData.creaRT}

═══════════════════════════════════════════════════════════════════════════════

`;

    // Rodapé profissional
    const footer = `

═══════════════════════════════════════════════════════════════════════════════

REFERÊNCIAS BIBLIOGRÁFICAS E LEGISLAÇÃO APLICÁVEL

LEGISLAÇÃO FEDERAL:
• Lei nº 6.938/1981 - Política Nacional do Meio Ambiente
• Lei nº 9.433/1997 - Política Nacional de Recursos Hídricos  
• Lei nº 12.305/2010 - Política Nacional de Resíduos Sólidos
• Resolução CONAMA nº 357/2005 - Classificação de águas e padrões de qualidade
• Resolução CONAMA nº 430/2011 - Condições de lançamento de efluentes
• Resolução CONAMA nº 503/2021 - Reúso de efluentes tratados

NORMAS TÉCNICAS:
• ABNT NBR 10.004/2004 - Resíduos Sólidos - Classificação
• ABNT NBR 10.151/2019 - Avaliação de Ruído em Áreas Habitadas
• ABNT NBR 7229/1993 - Projeto, construção e operação de tanques sépticos

LEGISLAÇÃO ESTADUAL (GOIÁS):
• Lei nº 12.596/1995 - Política Florestal do Estado de Goiás
• Decreto nº 1.745/1979 - Código Sanitário do Estado de Goiás

───────────────────────────────────────────────────────────────────────────────

RESPONSABILIDADE TÉCNICA

Declaro, para todos os fins de direito, que as informações constantes neste 
Memorial de Caracterização do Empreendimento são verdadeiras e correspondem 
à realidade do empreendimento. Estou ciente de que a omissão ou falsidade 
de informações pode acarretar sanções administrativas, civis e penais.

Este documento foi elaborado em conformidade com a legislação ambiental 
vigente e as normas técnicas aplicáveis, seguindo os melhores padrões 
da engenharia ambiental.

_________________________________
${formData.nomeRT}
Responsável Técnico
${formData.creaRT}

───────────────────────────────────────────────────────────────────────────────

INFORMAÇÕES TÉCNICAS DO DOCUMENTO

• Documento gerado por: Sistema de Laudos Ambientais
• Tecnologia utilizada: ${apiUsed}
• Processamento: Inteligência Artificial Avançada
• Conformidade: Legislação Ambiental Brasileira
• Versão: 1.0
• Formato: Memorial Técnico Profissional

Este documento foi gerado automaticamente com base nas informações fornecidas
e processado por sistema de IA especializado em documentação ambiental.

═══════════════════════════════════════════════════════════════════════════════
`;

    return header + content + footer;
}
