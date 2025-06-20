const { createApp, ref, computed, watch, onMounted } = Vue;

createApp({
  setup() {
    // --- Estado da Aplicação ---
    const apiKey = ref('');
    const apiKeyFromLocalStorage = ref(false);
    const persona = ref('');
    const pilares = ref('');
    const tipoConteudo = ref('Carrossel');
    const topico = ref('');
    const isLoading = ref(false);
    const isGeneratingPillars = ref(false);
    const isGeneratingSuggestions = ref(false);
    const generatedContent = ref('');
    const errorMessage = ref('');
    const copyButtonText = ref('Copiar');
    const weeklySchedule = ref([]);

    // --- Funções de Inicialização e API Key (localStorage) ---
    const initializeApiKey = () => {
      const storedApiKey = localStorage.getItem('geminiApiKey');
      if (storedApiKey) {
        apiKey.value = storedApiKey;
        apiKeyFromLocalStorage.value = true;
      } else {
        apiKey.value = '';
        apiKeyFromLocalStorage.value = false;
      }
    };

    const saveApiKey = () => {
      if (apiKey.value) {
        localStorage.setItem('geminiApiKey', apiKey.value);
        apiKeyFromLocalStorage.value = true;
        errorMessage.value = ''; // Limpa qualquer erro anterior de chave ausente
      } else {
        errorMessage.value = 'A chave da API não pode ser vazia para salvar.';
      }
    };

    const clearApiKey = () => {
      localStorage.removeItem('geminiApiKey');
      apiKey.value = '';
      apiKeyFromLocalStorage.value = false;
      errorMessage.value = 'Chave da API removida. Insira uma nova chave para continuar.';
    };

    // --- Funções de Planejamento ---
    const generateWeeklySchedule = () => {
      const schedule = [];
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(today.setDate(diff));

      const daysOfWeek = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
      const formatSuggestions = ['Carrossel', 'Reel', 'Story Interativo', 'Legenda Longa', 'Live', 'Post Único (Inspiração)', 'Descanso/Repost'];

      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(monday);
        currentDate.setDate(monday.getDate() + i);

        schedule.push({
          dayName: daysOfWeek[i],
          date: currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          format: formatSuggestions[i],
          suggestion: '',
          isRegenerating: false
        });
      }
      weeklySchedule.value = schedule;
    };

    const selectDay = (day) => {
      const formatMap = { 'Carrossel': 'Carrossel', 'Reel': 'Reel', 'Story Interativo': 'Story Interativo', 'Legenda Longa': 'Legenda Longa', 'Live': 'Live', 'Post Único (Inspiração)': 'Legenda Longa', 'Descanso/Repost': 'Reel' };
      tipoConteudo.value = formatMap[day.format] || 'Carrossel';
      topico.value = day.suggestion || '';
      document.getElementById('generation-module').scrollIntoView({ behavior: 'smooth' });
    };

    const generatePillars = async () => {
      if (!apiKey.value || !persona.value) {
        errorMessage.value = "Por favor, defina a persona e insira sua chave da API.";
        return;
      }
      isGeneratingPillars.value = true;
      errorMessage.value = '';
      const prompt = `Baseado na seguinte persona de um psicólogo, sugira 4 ou 5 pilares de conteúdo centrais.
            Persona: "${persona.value}"
            REGRAS: A resposta deve ser apenas o texto, com cada pilar em uma nova linha, numerado. Exemplo:\n1. Pilar Um\n2. Pilar Dois`;

      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey.value}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        if (!response.ok) throw new Error((await response.json()).error?.message || 'Erro na API');

        const data = await response.json();
        if (data.candidates && data.candidates[0].content?.parts?.length > 0) {
          pilares.value = data.candidates[0].content.parts[0].text.trim();
        } else {
          throw new Error("Não foi possível gerar os pilares de conteúdo.");
        }
      } catch (error) {
        errorMessage.value = `Erro ao gerar pilares: ${error.message}`;
      } finally {
        isGeneratingPillars.value = false;
      }
    };

    const generateWeeklySuggestions = async () => {
      if (!apiKey.value || !persona.value || !pilares.value) {
        errorMessage.value = "Por favor, defina a Persona, os Pilares e insira sua chave da API para gerar sugestões.";
        return;
      }

      isGeneratingSuggestions.value = true;
      errorMessage.value = '';

      const prompt = `
                Aja como um especialista em marketing de conteúdo para psicólogos. Baseado na persona e nos pilares de conteúdo a seguir, crie 7 TÓPICOS de posts para o Instagram, um para cada dia da semana, começando pela Segunda-feira.
                - Persona: ${persona.value}
                - Pilares: ${pilares.value}
                
                REGRAS DE FORMATAÇÃO ESTRITAS:
                - A resposta DEVE ser exclusivamente uma lista não ordenada HTML (<ul>).
                - Cada item da lista (<li>) deve conter APENAS o texto da ideia do post. Não inclua o dia da semana ou o formato.
                - Exemplo de resposta: <ul><li>5 mitos sobre ansiedade</li><li>Exercício de respiração para acalmar a mente</li>...</ul>
                - É PROIBIDO usar Markdown, negrito, ou qualquer outra tag HTML além de <ul> e <li>.`;

      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey.value}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        if (!response.ok) throw new Error((await response.json()).error?.message || 'Erro na API');

        const data = await response.json();
        if (data.candidates && data.candidates[0].content?.parts?.length > 0) {
          let rawText = data.candidates[0].content.parts[0].text.replace(/```html|```/g, '').trim();

          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = rawText;
          const suggestions = Array.from(tempDiv.querySelectorAll('li')).map(li => li.textContent);

          weeklySchedule.value.forEach((day, index) => {
            if (suggestions[index]) {
              day.suggestion = suggestions[index];
            }
          });

        } else {
          throw new Error("Não foi possível gerar sugestões.");
        }
      } catch (error) {
        errorMessage.value = `Erro ao gerar sugestões: ${error.message}`;
      } finally {
        isGeneratingSuggestions.value = false;
      }
    };

    const regenerateSuggestion = async (day, index) => {
      if (!apiKey.value || !persona.value || !pilares.value) {
        errorMessage.value = "Por favor, defina a Persona, os Pilares e insira sua chave da API para regenerar sugestões.";
        return;
      }

      weeklySchedule.value[index].isRegenerating = true;
      errorMessage.value = '';

      const prompt = `
                Aja como um especialista em marketing de conteúdo para psicólogos. Baseado na persona e pilares abaixo, crie UMA ÚNICA e NOVA ideia de post para o formato "${day.format}".
                - Persona: ${persona.value}
                - Pilares: ${pilares.value}
                - Ideia anterior (evite esta): ${day.suggestion}

                REGRAS: A resposta deve ser APENAS o texto da nova ideia. Sem HTML, sem Markdown, apenas texto puro.`;

      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey.value}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        if (!response.ok) throw new Error((await response.json()).error?.message || 'Erro na API');

        const data = await response.json();
        if (data.candidates && data.candidates[0].content?.parts?.length > 0) {
          let newSuggestion = data.candidates[0].content.parts[0].text.trim();
          weeklySchedule.value[index].suggestion = newSuggestion;
        } else {
          throw new Error("Não foi possível gerar uma nova sugestão.");
        }
      } catch (error) {
        errorMessage.value = `Erro ao regenerar: ${error.message}`;
      } finally {
        weeklySchedule.value[index].isRegenerating = false;
      }
    };

    // --- Funções de Geração de Conteúdo ---
    const createPrompt = () => {
      let prompt = `
                Aja como um especialista em marketing digital para psicólogos, seguindo rigorosamente as diretrizes éticas do Conselho Federal de Psicologia (CFP) do Brasil. Sua tarefa é criar um conteúdo para o Instagram que seja educativo, acolhedor e que gere conexão, sem nunca ser sensacionalista ou prometer resultados. É estritamente proibido usar termos como "preço", "desconto", "promoção", "garantia de cura" ou qualquer linguagem que mercantilize a saúde mental.
                Baseie-se nas seguintes informações estratégicas:
                - Persona (Público-Alvo): ${persona.value}
                - Pilares de Conteúdo: ${pilares.value}
                Agora, crie o seguinte conteúdo:
                - Tipo de Conteúdo: ${tipoConteudo.value}
                ${topico.value ? `- Tópico Específico: ${topico.value}` : ''}
                Instruções para o formato "${tipoConteudo.value}":`;

      switch (tipoConteudo.value) {
        case 'Reel': prompt += " Crie um roteiro curto e dinâmico para um Reel de até 30 segundos. Inclua sugestões de cenas/texto na tela e uma narração em off."; break;
        case 'Carrossel': prompt += " Estruture um post em formato carrossel com 5 slides. Mantenha o texto de cada slide MUITO CONCISO (idealmente 1-2 frases curtas). O Slide 1 deve ser um título de impacto. Os slides 2 a 4 devem apresentar dicas ou passos de forma direta. O Slide 5 deve ser uma chamada para ação (CTA) ética e breve."; break;
        case 'Legenda Longa': prompt += " Escreva uma legenda longa e reflexiva. Comece com uma frase de impacto. Desenvolva o tópico de forma aprofundada. Finalize com uma pergunta ou CTA para estimular a interação."; break;
        case 'Story Interativo': prompt += " Crie o texto para um Story interativo. Sugira uma imagem de fundo e o texto para uma enquete (com duas opções) ou uma caixa de perguntas."; break;
        case 'Live': prompt += " Crie um título e um roteiro com os principais tópicos para uma Live de 20-30 minutos. A estrutura deve conter uma introdução, desenvolvimento em 3 a 4 pontos, e um fechamento com espaço para perguntas."; break;
      }

      prompt += `\n\nAo final, sempre inclua uma seção de hashtags e um CTA ético.
             **REGRAS DE FORMATAÇÃO ESTRITAS:**
             1.  **A resposta DEVE ser exclusivamente em HTML limpo.**
             2.  Use as seguintes tags: <h3> para títulos principais, <h4> para subtítulos (como 'Slide 1'), <p> para parágrafos, <ul> e <li> para listas, e <strong> para negrito.
             3.  Para a lista de hashtags, coloque-as dentro de um parágrafo com a classe "hashtags", separadas por espaços. Ex: <p class="hashtags">#psicologia #saudemental</p>.
             4.  **É PROIBIDO usar CUALQUER elemento de Markdown.** Não use asteriscos (*), hashtags (#) fora da lista de hashtags, ou delimitadores de bloco de código como \`\`\`html ou \`\`\`.
             5.  A resposta não deve conter as tags <html>, <head>, ou <body>. Apenas o conteúdo HTML que será inserido na div.`;
      return prompt;
    };

    const generateContent = async () => {
      if (!apiKey.value) { errorMessage.value = "Por favor, insira sua chave da API do Google AI."; return; }
      if (!persona.value || !pilares.value) { errorMessage.value = "Por favor, preencha os campos de Persona e Pilares de Conteúdo."; return; }

      isLoading.value = true;
      generatedContent.value = '';
      errorMessage.value = '';

      const fullPrompt = createPrompt();
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey.value}`;

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }),
        });
        if (!response.ok) throw new Error((await response.json()).error?.message || `Erro na API: ${response.statusText}`);

        const data = await response.json();
        if (data.candidates && data.candidates[0].content?.parts?.length > 0) {
          let rawText = data.candidates[0].content.parts[0].text;
          generatedContent.value = rawText.replace(/```html|```/g, '').trim();
        } else if (data.candidates && data.candidates[0].finishReason === 'SAFETY') {
          throw new Error("A resposta foi bloqueada por políticas de segurança. Tente reformular seu tópico.");
        } else {
          throw new Error("A resposta da API não continha o conteúdo esperado ou estava vazia.");
        }
      } catch (error) {
        errorMessage.value = `Erro ao gerar conteúdo: ${error.message}`;
      } finally {
        isLoading.value = false;
      }
    };

    // --- Funções de Utilidade ---
    const copyToClipboard = () => {
      if (generatedContent.value) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = renderedHtml.value;
        const textToCopy = tempDiv.textContent || tempDiv.innerText || "";
        navigator.clipboard.writeText(textToCopy).then(() => {
          copyButtonText.value = 'Copiado!';
          setTimeout(() => { copyButtonText.value = 'Copiar'; }, 2000);
        }).catch(err => { console.error('Erro ao copiar texto: ', err); });
      }
    };

    const renderedHtml = computed(() => {
      if (isLoading.value) return '<div class="flex justify-center items-center h-full"><p style="color: var(--subtext0)">Gerando conteúdo... por favor, aguarde.</p></div>';
      if (generatedContent.value) return generatedContent.value;
      return '<div class="flex justify-center items-center h-full"><p style="color: var(--overlay0)">Seu conteúdo gerado aparecerá aqui.</p></div>';
    });

    // --- Ciclo de Vida e Watchers ---
    const loadFromLocalStorage = () => {
      persona.value = localStorage.getItem('psicoAppPersona') || 'Mães de primeira viagem (25-35 anos) enfrentando ansiedade, sobrecarga e os desafios do puerpério. Elas buscam validação, dicas práticas e um espaço seguro para falar sobre suas dificuldades sem julgamento.';
      pilares.value = localStorage.getItem('psicoAppPilares') || '1. Saúde Mental no Puerpério; 2. Autocuidado para Mães; 3. Relacionamentos após o bebê; 4. Desmistificando a Terapia Parental.';
    };

    // Watchers para salvar persona e pilares no localStorage
    watch(persona, (newVal) => localStorage.setItem('psicoAppPersona', newVal));
    watch(pilares, (newVal) => localStorage.setItem('psicoAppPilares', newVal));

    onMounted(() => {
      initializeApiKey(); // Inicializa a chave da API (do localStorage)
      loadFromLocalStorage(); // Carrega persona e pilares padrão/salvos
      generateWeeklySchedule(); // Gera a estrutura da semana
    });

    return {
      apiKey,
      apiKeyFromLocalStorage, // Usado para controlar visibilidade do input de API Key
      persona,
      pilares,
      tipoConteudo,
      topico,
      isLoading,
      generatedContent,
      errorMessage,
      generateContent,
      copyToClipboard,
      copyButtonText,
      renderedHtml,
      weeklySchedule,
      selectDay,
      generateWeeklySuggestions,
      isGeneratingSuggestions,
      regenerateSuggestion,
      generatePillars,
      isGeneratingPillars,
      // Funções adicionadas para o gerenciamento da API Key via localStorage
      saveApiKey,
      clearApiKey
    };
  }
}).mount('#app');
