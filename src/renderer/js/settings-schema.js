export const SETTINGS_SCHEMA = [
  {
    id: 'you', title: 'Eu e o Kortex', icon: 'i-user', groups: [
      { rows: [
        { type: 'link', label: 'Perfil do utilizador', to: 'you/profile' },
        { type: 'link', label: 'Importar de outro navegador', to: 'you/import' }
      ]}
    ]
  },
  {
    id: 'assistant', title: 'Assistente de IA', icon: 'i-assistant', groups: [
      { title: 'Geral', rows: [
        { type: 'select', key: 'ai.model', label: 'Modelo', options: [{val:'deepseek-v4-flash', text:'Flash (Rápido)'}, {val:'deepseek-v4-pro', text:'Pro (Capaz)'}], default: 'deepseek-v4-flash' },
        { type: 'toggle', key: 'ai.thinking', label: 'Pensar mais (raciocínio)', default: false }
      ]},
      { title: 'Comportamento', rows: [
        { type: 'toggle', key: 'ai.readPageOnOpen', label: 'Ler a página ao abrir o painel', default: true },
        { type: 'toggle', key: 'ai.saveChats', label: 'Guardar histórico de chats', default: true },
        { type: 'danger', action: 'clearChats', label: 'Apagar todos os chats', btnLabel: 'Apagar' }
      ]}
    ]
  },
  {
    id: 'privacy', title: 'Privacidade e segurança', icon: 'i-shield', groups: [
      { rows: [
        { type: 'link', label: 'Limpar dados de navegação', to: 'privacy/clear-data' },
        { type: 'link', label: 'Definições de sites', to: 'privacy/site-settings' },
        { type: 'toggle', key: 'privacy.blockAds', label: 'Bloquear anúncios e rastreadores', default: true },
        { type: 'toggle', key: 'privacy.dnt', label: 'Enviar "Não rastrear"', default: true },
        { type: 'toggle', key: 'privacy.httpsFirst', label: 'Usar sempre ligações seguras (HTTPS)', default: true }
      ]}
    ]
  },
  {
    id: 'appearance', title: 'Aspeto', icon: 'i-palette', groups: [
      { title: 'Tema', rows: [
        { type: 'select', key: 'appearance.theme', label: 'Tema', options: [{val:'dark', text:'Escuro'}, {val:'light', text:'Claro'}, {val:'system', text:'Sistema'}], default: 'dark' },
        { type: 'swatches', key: 'appearance.accent', label: 'Cor de destaque', default: '#ff5722', options: ['#ff5722', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444'] },
        { type: 'toggle', key: 'appearance.reduceMotion', label: 'Reduzir animações', default: false }
      ]},
      { title: 'Separadores', rows: [
        { type: 'toggle', key: 'tabs.hoverPreview', label: 'Pré-visualização ao passar o rato', default: true }
      ]}
    ]
  },
  {
    id: 'search', title: 'Motor de pesquisa', icon: 'i-search', groups: [
      { rows: [
        { type: 'select', key: 'search.engine', label: 'Motor predefinido', options: [{val:'google', text:'Google'}, {val:'duckduckgo', text:'DuckDuckGo'}, {val:'bing', text:'Bing'}], default: 'duckduckgo' },
        { type: 'toggle', key: 'omnibox.remoteSuggestions', label: 'Mostrar sugestões de pesquisa', desc: 'O que escreves é enviado ao motor', default: true },
        { type: 'button', action: 'clearSearches', label: 'Apagar pesquisas guardadas', btnLabel: 'Apagar' }
      ]}
    ]
  },
  {
    id: 'downloads', title: 'Transferências', icon: 'i-download', groups: [
      { rows: [
        { type: 'toggle', key: 'downloads.askEach', label: 'Perguntar onde guardar cada ficheiro', default: false },
        { type: 'toggle', key: 'downloads.warnDangerous', label: 'Avisar em ficheiros perigosos', default: true }
      ]}
    ]
  },
  {
    id: 'system', title: 'Sistema', icon: 'i-wrench', groups: [
      { rows: [
        { type: 'toggle', key: 'system.background', label: 'Continuar a executar em segundo plano', default: false },
        { type: 'button', action: 'openDataFolder', label: 'Abrir pasta de dados', btnLabel: 'Abrir' }
      ]}
    ]
  },
  {
    id: 'about', title: 'Acerca do Kortex', icon: 'i-k', groups: [
      { rows: [
        { type: 'readonly', label: 'Versão do Kortex', value: '1.0.0' },
        { type: 'readonly', label: 'Electron', value: '30.5.1' },
        { type: 'readonly', label: 'Chromium', value: '124.0.6367.243' }
      ]}
    ]
  }
];