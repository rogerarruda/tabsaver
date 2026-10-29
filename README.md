# tabsaver

> An Extension.js example.

## Available Scripts

In the project directory, you can run the following scripts:

### npm dev

**Development Mode**: This command runs your extension in development mode. It will launch a new browser instance with your extension loaded. The page will automatically reload whenever you make changes to your code, allowing for a smooth development experience.

```bash
npm dev
```

### npm start

**Production Preview**: This command runs your extension in production mode. It will launch a new browser instance with your extension loaded, simulating the environment and behavior of your extension as it will appear once published.

```bash
npm start
```

### npm build

**Build for Production**: This command builds your extension for production. It optimizes and bundles your extension, preparing it for deployment to the target browser's store.

```bash
npm build
```

## Learn More

To learn more about creating cross-browser extensions with Extension.js, visit the [official documentation](https://extension.js.org).

## Interface atualizada

Interface em português, com navegação entre coleções, busca por nome, título ou site,
ordenação, renomeação e painel das abas da janela atual. O formato existente em
`chrome.storage.local.collections` é mantido. Backup e restauração por arquivo estão disponíveis; sincronização em nuvem fica para uma próxima etapa.

Para experimentar no Chrome:

1. Execute `npm run build`.
2. Acesse `chrome://extensions` e ative o modo de desenvolvedor.
3. Use **Carregar sem compactação** e selecione a pasta `dist/chrome` deste projeto.
   Se a extensão já estiver carregada dessa pasta, use **Recarregar**.
4. Abra uma nova aba.

As capturas em `design-review` usam dados fictícios na prévia local. Essa prévia
não acessa as abas nem as coleções reais da extensão. A compilação e os fluxos de
criação e busca foram verificados; o fluxo completo de salvar e fechar abas deve
ser conferido na extensão carregada. O registro de revisão inclui as verificações
que ainda não foram realizadas.

### Idioma e aparência

Os seletores no topo da página oferecem:

- **Idioma:** Automático, Português (BR) ou English. Automático segue o idioma
  principal do navegador: português usa PT-BR; os demais idiomas usam inglês.
- **Aparência:** Sistema, Claro ou Escuro. Sistema acompanha mudanças de aparência
  sem recarregar a página; uma escolha manual tem prioridade.

As escolhas são salvas separadamente das coleções, em `chrome.storage.local.preferences`,
e atualizadas nas outras páginas abertas da extensão. Datas e nomes das novas sessões
usam o idioma escolhido. Nomes de coleções e títulos de páginas existentes são preservados.

Verificação desta etapa: compilação e checagem de tipos dos novos módulos passaram.
Na prévia foram verificados seleção manual, detecção automática de idioma, retorno ao
automático, mudanças do tema do sistema, prioridade manual e persistência após recarga.
O verificador de tipos geral ainda encontra problemas anteriores do exemplo de testes
(`extension-fixtures` ausente) e da declaração de módulos Vue.


### Backup e restauração

Na barra acima das coleções:

- **Exportar backup:** baixa um JSON com todas as coleções salvas e as preferências.
  O arquivo preserva os dados antigos, inclusive os que não podem ser exibidos.
- **Restaurar backup:** selecione um arquivo exportado pelo TabSaver (até 20 MB).
  A prévia informa a quantidade de coleções e abas e a data do backup.
- **Adicionar às coleções atuais** mantém as existentes e evita repetir coleções
  idênticas. **Substituir todas as coleções** troca as atuais pelas do arquivo.
- A restauração de idioma e aparência é opcional. Nenhuma aba aberta é fechada
  ou reaberta pela importação.
- **Desfazer restauração** recupera a cópia anterior à última restauração. Essa
  cópia fica no armazenamento local, disponível mesmo após recarregar a página.
  Desfazer também substitui alterações feitas desde aquela restauração.

O formato contém `app: "tabsaver"`, `version: 1`, `exportedAt`, `collections` e
`preferences`. Arquivos inválidos e versões desconhecidas são recusados antes de
qualquer alteração. A cópia de recuperação usa a chave `backupRecovery` e não
entra no arquivo exportado. A gravação no Chrome atualiza os dados e a cópia em
uma única chamada de armazenamento, sem novas permissões.

Verificações: `node --test tests/*.test.cjs`, compilação de produção e conferência
na prévia de exportação, importação, mesclagem, substituição, preferências,
recusa de JSON inválido e desfazer após recarregar. A API de armazenamento Chrome
foi coberta por simulação nos testes; o fluxo instalado deve ser conferido no Chrome.

### Tutorial de primeiros passos

O tutorial abre na primeira visita e pode ser reaberto em **Como usar**, no topo.
São cinco etapas: configurar/verificar a nova aba, salvar a janela atual, retomar
coleções, backup e personalização. A ajuda **Não abriu o TabSaver?** explica como
verificar se a extensão está ativa e possíveis conflitos com outra extensão.

A substituição da nova aba já é declarada em `chrome_url_overrides.newtab`.
O tutorial orienta essa configuração e oferece um botão para abrir os detalhes
da extensão em `chrome://extensions`; ele não muda configurações nem desativa
outras extensões automaticamente. Na prévia local, mostra a orientação de que a
extensão deve estar instalada para controlar a nova aba.

Concluir, escolher **Ver depois** ou fechar grava `tutorialSeen: true`, sem alterar
coleções ou preferências. Se essa gravação falhar, o tutorial ainda fecha e mostra
um aviso. Esse estado local não faz parte do backup das coleções.

Referência: https://developer.chrome.com/docs/extensions/develop/ui/override-chrome-pages

### Acesso pelo ícone

Clique no ícone do TabSaver na barra de ferramentas ou no menu de extensões do
Chrome para abrir a interface em uma aba. Esse acesso funciona mesmo quando outra
página é usada como nova aba. O tutorial também explica essa alternativa.

O clique usa o caminho da página declarado no manifesto compilado, sem depender
de abrir `chrome://newtab`. Não exige permissões adicionais.

O botão **Configurar nova aba**, no topo, abre a primeira etapa do tutorial com a
ajuda de configuração expandida. Na extensão instalada, oferece acesso direto aos
detalhes do TabSaver no Chrome. O botão orienta o usuário; não força a ativação do
override, cuja configuração é controlada pelo Chrome e pelo manifesto.
