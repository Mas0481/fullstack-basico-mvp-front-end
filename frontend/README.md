# MVP - Sprint: Arquitetura de Software | Frontend

Interface de planejamento de coletas e entregas desenvolvida por **Marcio Almeida
da Silva**, Pós-Graduação em Engenharia de Software, PUC-Rio.
React, Vite e Leaflet permitem cadastrar clientes, organizar paradas, inserir
entregas avulsas no mapa e visualizar trajetos e uma matriz de distâncias.

## Arquitetura: cenário 1.1

![Fluxograma da arquitetura](public/arquitetura.svg)

Dois componentes desenvolvidos: esta interface e uma API Python/FastAPI em
repositório separado. A API integra Nominatim e OSRM via HTTP/JSON e persiste
clientes, endereços, entregas e rotas no MySQL. As APIs externas são consumidas
pelo backend; o usuário permanece nesta aplicação. O MySQL é infraestrutura de
persistência, não uma API REST desenvolvida como terceiro módulo.

O navegador carrega o React servido pelo Nginx e chama /api no mesmo domínio.
O Nginx encaminha a chamada a backend:8000 na rede Docker. Somente o backend
conecta a db:3306. Os nomes backend e db são internos ao Docker.

## Executar com Docker

Pré-requisitos: Docker Desktop com containers Linux e Compose 2.24.4+,
internet e os dois repositórios baixados. Não precisa instalar Python, Node
ou MySQL no computador para essa execução.

Clone ou extraia cada componente de forma que as pastas fiquem assim:

```text
mvp/
  frontend/   # raiz deste repositório: Dockerfile, compose.yaml, README.md
  backend/    # raiz do outro repositório: Dockerfile, requirements.txt, app/
```

Na pasta frontend:

```powershell
Copy-Item .env.example .env
# Edite .env: defina MYSQL_PASSWORD e MYSQL_ROOT_PASSWORD com senhas diferentes.
# Preencha um contato real no EXTERNAL_API_USER_AGENT.
docker compose up -d --build --wait
docker compose ps
```

No Linux/macOS use `cp .env.example .env`. Se a pasta do backend tiver outro
nome, ajuste BACKEND_CONTEXT no .env. Abra:

- Interface: http://localhost:8080
- Swagger da API: http://localhost:8001/docs

FRONTEND_PORT, FRONTEND_ORIGIN e BACKEND_PORT permitem trocar as portas;
a origem deve acompanhar a porta do frontend. Os links acima são os padrões.
O Compose fica na raiz deste repositório e cria frontend, backend e MySQL.
O volume mysql_data mantém os dados entre reinicializações.

```powershell
docker compose logs --tail=50 backend
docker compose stop
docker compose start
docker compose down
```

`down` remove containers e rede, preservando o volume. Não use `down -v` se
quiser manter os dados. Pare outra cópia que use as mesmas portas antes de iniciar.

## Desenvolvimento local opcional

Requer Node.js 22+, npm e a API rodando na porta 8000:

```powershell
npm ci
npm run dev
npm run build
```

Abra http://localhost:5173. O Vite encaminha /api para http://localhost:8000;
configure API_PROXY_TARGET se sua API estiver em outra porta. Com o backend
do Compose, no PowerShell: `$env:API_PROXY_TARGET='http://localhost:8001'`.

## Evidências dos quatro métodos HTTP

| Método | Rota chamada pela interface | Ação na tela |
| --- | --- | --- |
| GET | /api/clientes | Abrir a lista de clientes |
| POST | /api/clientes | Salvar um novo cliente |
| PUT | /api/clientes/{cliente_id} | Editar e salvar um cliente |
| DELETE | /api/clientes/{cliente_id} | Excluir cliente sem entregas |
| DELETE | /api/entregas/{entrega_id} | Lixeira da entrega |

As chamadas estão em src/App.jsx; api.js centraliza o cliente HTTP.
A API tem outras rotas para a empresa, entregas, geocodificação, rota e matriz.

## Uso e diferenciais

1. Configure e localize o endereço da empresa.
2. Cadastre um cliente e uma entrega para hoje, ou arraste o alvo no mapa para
   inserir uma entrega avulsa.
3. Marque as entregas e arraste as alças dos cards para ordenar as paradas.
4. Calcule a rota ou compare as distâncias e tempos na matriz.
5. Use a lixeira para excluir uma entrega, preservando o cadastro do cliente.

A ordem manual fica na tela até recarregar; calcular salva a sequência da rota.
Erros de rede, pontos sem trajeto e falhas de gravação mostram orientações.
Arraste por toque e teclado, alvo com consulta reversa e matriz são diferenciais
além do CRUD básico. Ajuda e Documentação estão no menu.

## Serviços externos e entrega acadêmica

- [APIs externas: endpoints, cadastro, licença e limites](docs/APIS_EXTERNAS.md)
- [Matriz de requisitos e pendências de entrega](docs/REQUISITOS_MVP.md)
- [Roteiro de vídeo, até 6 minutos](docs/ROTEIRO_VIDEO.md)
- [Publicação em repositórios separados](docs/PUBLICACAO.md)

O .env real não deve ser publicado; .env.example permite configurar outra máquina.
