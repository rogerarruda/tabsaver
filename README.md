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
`chrome.storage.local.collections` é mantido. Backup e sincronização ficam para uma próxima etapa.

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
