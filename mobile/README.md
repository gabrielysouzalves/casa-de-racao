# Aplicativo mobile — Casa de Ração

Aplicativo React Native com Expo para a equipe consultar e gerenciar pedidos da loja. O mobile utiliza a mesma API e o mesmo banco MySQL do sistema web.

## Funcionalidades

- Login com usuário cadastrado no sistema web.
- Consulta da fila e histórico recente.
- Criação de pedidos presenciais e de entrega.
- Início, conclusão e cancelamento dos atendimentos.
- Avisos locais após operações, com mensagem na tela como alternativa caso o recurso de notificação do aparelho falhe.

Os dados de estoque e financeiro são administrados pelo painel web.

## Executar

Com o backend compilado e em execução na porta 3000:

```bash
cd mobile
npm install
npx expo install --fix
npx expo start
```

Abra o QR Code com o Expo Go. Celular e computador precisam estar na mesma rede Wi-Fi.

Na tela inicial, informe o endereço do servidor usando o IP do computador na rede local, por exemplo:

```text
http://192.168.1.10:3000
```

Esse IP é apenas ilustrativo; consulte o IP real do computador. O endereço `localhost` no celular não aponta para o computador.

## Observações

- O login mobile usa token de sessão temporário, mantido somente enquanto o aplicativo está aberto.
- Para testes locais, a comunicação ocorre na rede Wi-Fi. Para uso externo, é necessário configurar HTTPS.
- As notificações são **locais**, relacionadas às ações feitas no próprio celular; não há envio push de outro dispositivo.
- As versões recomendadas das bibliotecas são ajustadas por `npx expo install --fix`.
- Para conferir o TypeScript, execute `npx tsc --noEmit` dentro da pasta `mobile`.

Consulte [a documentação da API](../docs/api-pedidos.md) para as rotas e regras dos atendimentos.
