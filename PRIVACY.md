# Política de privacidade do TabSaver

Última atualização: 29 de outubro de 2026.

O TabSaver é uma extensão open source desenvolvida por [Roger Arruda](https://rogerarruda.dev) para salvar e organizar abas no próprio navegador. Esta política descreve o comportamento da versão disponível neste repositório.

## Dados armazenados

Quando você usa a extensão, ela pode armazenar localmente:

- Títulos e endereços das páginas que você decide salvar.
- Nomes de coleções, datas, notas, etiquetas, favoritos e coleções fixadas.
- Nome, cor e estado recolhido dos grupos de abas salvos.
- Preferências de idioma, aparência e densidade da interface.
- Itens na lixeira, cópias automáticas de recuperação e o estado anterior à última restauração de backup.
- Informações de funcionamento, como conclusão do tutorial, data da última exportação preparada e adiamento do lembrete de backup.

A extensão consulta os títulos e endereços das abas da janela atual para exibir o painel de abas abertas e executar as ações solicitadas. Não lê o conteúdo das páginas por scripts, senhas, cookies ou formulários.

## Onde ficam os dados

Na extensão instalada, os dados ficam principalmente em `chrome.storage.local`, dentro do perfil do Chrome. Algumas preferências também são armazenadas no armazenamento local da página para aplicação da aparência inicial. A prévia web usada no desenvolvimento utiliza `localStorage` e não tem acesso às abas reais do Chrome.

Não há servidor do TabSaver para receber coleções, cadastro de conta, anúncios, analytics ou telemetria. Não há sincronização ativa com Google Drive nem com outros serviços de nuvem.

O Chrome pode aplicar proteções e políticas próprias ao perfil e ao dispositivo. O TabSaver não adiciona criptografia própria aos dados locais ou aos arquivos JSON exportados.

## Uso da rede e de serviços externos

A extensão não envia suas coleções para serviços externos. Os ícones dos sites são solicitados pela API interna de favicons do Chrome; nenhum serviço externo de imagens é integrado pelo TabSaver.

Ao abrir uma aba salva, o navegador acessa o endereço correspondente normalmente. Se você clicar no link do desenvolvedor, acessará `rogerarruda.dev`. Essas páginas e o próprio navegador têm suas políticas e práticas de privacidade.

## Permissões

- **`tabs`:** consultar títulos e endereços das abas, além de executar ações de abertura e fechamento solicitadas pelo usuário.
- **`storage`:** manter coleções, preferências e dados de recuperação no navegador.
- **`favicon`:** exibir os ícones das páginas pela API interna do Chrome.
- **`contextMenus`:** oferecer opções de salvar uma página ou um link pelo menu de contexto.
- **`tabGroups`:** preservar e recriar os metadados de grupos de abas.

O manifesto também declara a página do TabSaver como substituta da nova aba. O acesso pelo ícone da extensão funciona mesmo que você use outra página como nova aba.

## Backups, exclusão e retenção

Você pode exportar e importar seus dados por um arquivo JSON, sem enviá-los a um servidor do TabSaver. O arquivo pode conter endereços com parâmetros pessoais ou sensíveis, notas e itens da lixeira. Você controla onde ele é salvo e com quem o compartilha.

Itens excluídos vão para a lixeira e permanecem nela até serem restaurados ou removidos. Antes de alterações em coleções ou na lixeira, a extensão guarda cópias automáticas locais, mantendo até cinco estados recentes; bibliotecas grandes podem ter menos cópias para limitar o espaço usado. Também é mantida uma cópia para desfazer a última restauração de backup.

Excluir um item da lixeira não apaga cópias anteriores de recuperação nem arquivos JSON já exportados. Esses arquivos são independentes e precisam ser removidos por você caso não queira mais mantê-los.

Você pode remover os dados locais pelas ferramentas de gerenciamento do navegador ou desinstalando a extensão. Isso não exclui arquivos de backup salvos fora do perfil. Exportar um backup antes da desinstalação é necessário se quiser preservar suas coleções.

## Alterações nesta política

Mudanças no comportamento da extensão devem ser acompanhadas de uma atualização desta política e da data acima. Novos serviços ou integrações de nuvem precisarão ter seu funcionamento documentado antes de serem disponibilizados.

## Contato e código-fonte

- Desenvolvedor: [Roger Arruda](https://rogerarruda.dev).
- Código-fonte: [github.com/rogerarruda/tabsaver](https://github.com/rogerarruda/tabsaver).
- Problemas e dúvidas: [Issues do projeto](https://github.com/rogerarruda/tabsaver/issues).

As issues são públicas. Não inclua nelas backups pessoais, URLs privadas ou outras informações sensíveis.
