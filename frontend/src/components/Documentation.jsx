import { api } from '../api'



const integrations = [

  ['POST /api/clientes/geocodificar', 'Nominatim', 'GET /search', 'Converte endereço em coordenadas.'],

  ['POST /api/clientes/geocodificar-reverso', 'Nominatim', 'GET /reverse', 'Encontra o endereço próximo às coordenadas.'],

  ['POST /api/rotas/calcular', 'OSRM', 'GET /route/v1/driving/{coordenadas}', 'Calcula e salva uma rota na ordem dos IDs enviados, definida pelos cards selecionados.'],

  ['POST /api/rotas/matriz', 'OSRM', 'GET /table/v1/driving/{coordenadas}', 'Compara distâncias e tempos entre todos os pontos.'],

]



const endpoints = [

  ['GET', '/api/health', 'Verificar se a API responde.'],

  ['GET / POST', '/api/empresa/endereco', 'Consultar ou salvar o endereço da empresa.'],

  ['GET / POST', '/api/clientes', 'Listar ou cadastrar clientes.'],

  ['PUT / DELETE', '/api/clientes/{cliente_id}', 'Editar ou excluir um cliente.'],

  ['GET / POST', '/api/entregas', 'Listar todas as entregas ou cadastrar uma entrega de cliente.'],

  ['POST', '/api/entregas/avulsas', 'Criar entrega no ponto do alvo, sem cliente cadastrado.'],

  ['PUT', '/api/entregas/avulsas/{entrega_id}', 'Editar identificação, endereço, coordenadas, data e observações de uma avulsa.'],

  ['PUT / DELETE', '/api/entregas/{entrega_id}', 'Editar uma entrega de cliente ou excluir qualquer entrega e suas rotas vinculadas, preservando o cliente e seu endereço.'],

]



const examples = [

  { title: 'Localizar um endereço', endpoint: '/api/clientes/geocodificar', body: { logradouro: 'Avenida Borges de Medeiros', cidade: 'Porto Alegre', estado: 'RS' }, result: 'Retorna latitude, longitude e display_name (endereço encontrado).' },

  { title: 'Consultar um ponto', endpoint: '/api/clientes/geocodificar-reverso', body: { latitude: -29.886, longitude: -50.268 }, result: 'Retorna latitude, longitude, display_name e address (partes do endereço). O local encontrado pode ser próximo ao ponto informado.' },

  { title: 'Calcular uma rota', endpoint: '/api/rotas/calcular', body: { entrega_ids: [1, 2] }, result: 'Retorna o ID da rota salva, distancia_km, duracao_minutos, geometry (desenho do trajeto) e paradas.' },

  { title: 'Comparar paradas', endpoint: '/api/rotas/matriz', body: { entrega_ids: [1, 2] }, result: 'Retorna pontos, distancias_km e duracoes_minutos. A empresa ocupa a primeira posição; linhas são origens e colunas são destinos. null significa ausência de trajeto.' },

]



function swaggerAddress() {

  const configured = import.meta.env.VITE_SWAGGER_URL

  if (configured) return configured

  const url = new URL(api.defaults.baseURL || '/', window.location.origin)

  // Endereços relativos usam o proxy do frontend; o Compose publica o Swagger em 8001.

  if (!/^https?:\/\//.test(api.defaults.baseURL || '')) url.port = '8001'

  url.pathname = '/docs'

  url.search = ''

  url.hash = ''

  return url.href

}



export default function Documentation() {

  return (

    <main className="single-column help-page documentation-page">

      <section className="panel help-intro">

        <span className="eyebrow">Referência técnica</span>

        <h1>Documentação do MVP - Sprint: Arquitetura de Software</h1>

        <p>Arquitetura, endpoints e exemplos para entender e testar a aplicação.</p>

        <a className="docs-link" href={swaggerAddress()} target="_blank" rel="noreferrer">Abrir Swagger da nossa API ↗</a>

        <p>O Swagger permite enviar requisições à API. As operações de cadastro, edição, exclusão e cálculo de rota alteram os dados do sistema.</p>

      </section>



      <section className="panel docs-section">

        <h2>Como as partes se conectam</h2>

        <p>A tela em React envia pedidos para nossa API FastAPI. A API consulta e salva os dados no MySQL e chama os serviços externos quando precisa localizar endereços ou calcular trajetos.</p>

        <p className="architecture-flow">Navegador → FastAPI → MySQL / Nominatim / OSRM</p>
        <p>Cenário 1.1 da Sprint: interface e API são os componentes desenvolvidos; Nominatim e OSRM são serviços externos. A comunicação usa HTTP e JSON, com persistência no MySQL.</p>
        <img src="/arquitetura.svg" alt="Arquitetura: React servido pelo Nginx chama FastAPI por HTTP; a API persiste no MySQL e consulta Nominatim e OSRM." style={{width: '100%', height: 'auto'}} />

        <p>O Docker executa frontend, backend e banco. Nominatim e OSRM são acessados pela internet. O navegador também carrega as imagens do mapa do OpenStreetMap e os marcadores do cdnjs.</p>

      </section>



      <section className="panel docs-section">

        <h2>As quatro integrações externas</h2>

        <p>São quatro endpoints, distribuídos entre dois serviços. A tela chama nossa API por POST; o backend consulta os provedores por GET.</p>

        <div className="docs-table-scroll">

          <table className="docs-table">

            <caption>Correspondência entre os endpoints internos e externos</caption>

            <thead><tr><th scope="col">Nossa API</th><th scope="col">Serviço</th><th scope="col">Endpoint externo</th><th scope="col">Função</th></tr></thead>

            <tbody>{integrations.map(([internal, provider, external, description]) => <tr key={internal}><td><code>{internal}</code></td><td>{provider}</td><td><code>{external}</code></td><td>{description}</td></tr>)}</tbody>

          </table>

        </div>

        <p>Os endpoints públicos usados não exigem cadastro nem chave e não têm pagamento configurado no MVP. Nominatim e OSRM têm limites de uso; seus servidores públicos não oferecem garantia de disponibilidade.</p>
        <p>Nominatim: no máximo uma consulta por segundo no total da aplicação, com cache, identificação e sem autocomplete. Use locais públicos na demonstração. Consulte a <a href="https://operations.osmfoundation.org/policies/nominatim/" target="_blank" rel="noreferrer">política do Nominatim</a>.</p>
        <p>Os dados OpenStreetMap são licenciados sob <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">ODbL, com atribuição aos contribuidores</a>. O software OSRM usa <a href="https://github.com/Project-OSRM/osrm-backend/blob/master/LICENSE.TXT" target="_blank" rel="noreferrer">licença BSD de duas cláusulas</a>; o servidor demonstrativo tem <a href="https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy" target="_blank" rel="noreferrer">condições próprias de acesso</a>.</p>

        <p>Endereços base: <code>https://nominatim.openstreetmap.org</code> e <code>https://router.project-osrm.org</code>. Podem ser alterados nas configurações do backend.</p>

        <ul>

          <li><a href="https://nominatim.org/release-docs/latest/api/Search/" target="_blank" rel="noreferrer">Documentação Nominatim: busca de endereço</a></li>

          <li><a href="https://nominatim.org/release-docs/latest/api/Reverse/" target="_blank" rel="noreferrer">Documentação Nominatim: busca por coordenadas</a></li>

          <li><a href="https://project-osrm.org/docs/v5.24.0/api/#route-service" target="_blank" rel="noreferrer">Documentação OSRM: cálculo de rota</a></li>

          <li><a href="https://project-osrm.org/docs/v5.24.0/api/#table-service" target="_blank" rel="noreferrer">Documentação OSRM: matriz de trajetos</a></li>

        </ul>

      </section>



      <section className="panel docs-section">

        <h2>Testar as integrações pelo Swagger</h2>
        <p>O frontend usa GET para listar clientes, POST para cadastrar, PUT para editar e DELETE para excluir. A API própria oferece 17 operações HTTP. Os quatro endpoints externos são integrações adicionais; o mínimo de quatro rotas do enunciado se refere à API desenvolvida.</p>

        <ol><li>Abra o Swagger pelo botão acima.</li><li>Localize o endpoint e clique em <strong>Try it out</strong>.</li><li>Preencha o corpo JSON usando um dos exemplos abaixo.</li><li>Clique em <strong>Execute</strong> e confira a resposta.</li></ol>

        <p>Para os exemplos de rota e matriz, cadastre a empresa com coordenadas e substitua os IDs 1 e 2 pelos IDs de entregas existentes.</p>

        <div className="docs-examples">{examples.map(example => <article key={example.endpoint}>

          <h3>{example.title}</h3><code>POST {example.endpoint}</code>

          <pre><code>{JSON.stringify(example.body, null, 2)}</code></pre><p>{example.result}</p>

        </article>)}</div>

      </section>



      <section className="panel docs-section">

        <h2>Outros endpoints da nossa API</h2>

        <div className="docs-table-scroll"><table className="docs-table">

          <caption>Cadastros e verificação de disponibilidade</caption>

          <thead><tr><th scope="col">Método</th><th scope="col">Endpoint</th><th scope="col">Função</th></tr></thead>

          <tbody>{endpoints.map(([method, endpoint, description]) => <tr key={endpoint}><td>{method}</td><td><code>{endpoint}</code></td><td>{description}</td></tr>)}</tbody>

        </table></div>

        <p>GET consulta; POST envia dados para cadastro ou processamento; PUT atualiza; DELETE exclui. Valores entre chaves, como cliente_id, devem ser substituídos pelo ID real.</p>

      </section>



      <section className="panel docs-section">
        <h2>Ordem das entregas e cálculo da rota</h2>
        <p>Em <strong>Rotas → Entregas de hoje</strong>, arraste a alça à esquerda do card com o mouse ou por toque. No teclado, foque a alça e use as setas para cima e para baixo. A lista contém entregas de clientes e avulsas previstas para a data atual.</p>
        <p>Somente os cards marcados entram no trajeto. Os números indicam a sequência das paradas após a empresa. Marcar as caixas em outra sequência não muda essa ordem: a posição dos cards na lista é que determina o percurso.</p>
        <p>A interface envia os IDs selecionados, na ordem da lista, para <code>POST /api/rotas/calcular</code> e <code>POST /api/rotas/matriz</code>. Por exemplo, <code>{JSON.stringify({ entrega_ids: [3, 1, 2] })}</code> solicita empresa → entrega 3 → entrega 1 → entrega 2. Substitua os números por IDs existentes.</p>
        <p>Arrastar não chama um endpoint de ordenação nem salva uma rota. A ordem manual fica na tela enquanto a aplicação permanece aberta e é perdida ao recarregar a página. Ao calcular, a sequência é salva junto com a rota. Não há otimização automática da ordem.</p>
        <p>Ao mudar a seleção ou a ordem, o trajeto exibido é limpo: calcule a rota e compare as paradas novamente. Durante o cálculo, seleção, arraste e exclusão ficam bloqueados.</p>
      </section>

      <section className="panel docs-section">
        <h2>Excluir uma entrega pela lixeira</h2>
        <p>A lixeira à direita do card solicita confirmação e chama <code>DELETE /api/entregas/&#123;entrega_id&#125;</code>, o mesmo endpoint usado na aba Entregas. Funciona para entregas de clientes e avulsas.</p>
        <p>A exclusão remove a entrega e as rotas vinculadas a ela. O cadastro do cliente e seu endereço permanecem no banco. Para uma entrega avulsa, os dados próprios da entrega também são removidos.</p>
        <p>Em caso de sucesso, a API retorna HTTP 204, sem corpo, e a tela remove o card, sua seleção e o trajeto exibido. As paradas restantes são renumeradas. HTTP 404 indica entrega não encontrada. Se a requisição falhar, a tela informa o erro e mantém o card; confira a lista atualizada antes de tentar novamente.</p>
      </section>

      <section className="panel docs-section">

        <h2>Entregas avulsas pelo mapa</h2>

        <p>Arraste o alvo do canto inferior direito. O popup consulta o Nominatim e permite conferir a referência, o destinatário e a data. Se o endereço não for encontrado, informe a referência manualmente.</p>

        <p><code>POST /api/entregas/avulsas</code> cria a entrega sem cliente. A resposta tem <code>avulsa: true</code>, <code>cliente_id: null</code> e <code>endereco_id: null</code>. Ela pode participar das mesmas rotas e matrizes que as entregas de clientes.</p>

        <pre className="docs-code"><code>{JSON.stringify({nome: 'Entrega avulsa', endereco: 'Avenida Paulista, São Paulo, SP', latitude: -23.5614, longitude: -46.6559, data_prevista: '2026-09-18', observacoes: 'Recepção', request_id: '7c5ab7c5-6df9-4cf6-b5f1-88b7617b8f50'}, null, 2)}</code></pre>

        <p>Altere a data do exemplo. O <code>request_id</code> é um UUID gerado para cada tentativa de cadastro: reutilize-o somente ao repetir a mesma tentativa. Isso evita duplicação se a conexão falhar. Omitir o campo faz a API gerar um novo UUID.</p>

        <p>Edite com <code>PUT /api/entregas/avulsas/&#123;entrega_id&#125;</code>, usando os mesmos dados sem request_id. Exclua com <code>DELETE /api/entregas/&#123;entrega_id&#125;</code>. A edição e a exclusão removem rotas antigas vinculadas; calcule novamente o trajeto.</p>

      </section>



      <section className="panel docs-section">

        <h2>Regras e respostas das integrações</h2>

        <ul>

          <li>A matriz aceita de 1 a 24 entregas, sem IDs repetidos, e inclui a empresa como primeiro ponto.</li>

          <li>Comparar paradas não salva uma rota e não altera nem otimiza a ordem das entregas.</li>

          <li>Distâncias são exibidas em quilômetros e tempos em minutos. Sentidos opostos podem ter valores diferentes.</li>

          <li>Ao soltar o alvo, a busca por coordenadas preenche a referência do popup com um endereço próximo. Apenas Inserir entrega avulsa salva a entrega, preservando a coordenada exata do alvo.</li>

          <li>As buscas de endereço compartilham cache em memória e intervalo mínimo de 1,05 segundo entre consultas externas no processo do backend.</li>

          <li>400: regra de negócio não atendida, como falta de coordenadas. 404: endereço ou entrega não encontrado.</li>

          <li>422: dados inválidos, limite de pontos, ponto sem via próxima (NoSegment) ou trajeto não encontrado (NoRoute).</li>
          <li>502: resposta inválida do provedor. 503: indisponibilidade ou excesso de consultas. 504: tempo de espera excedido.</li>
          <li>500 com código PersistenceError: o trajeto foi calculado, mas houve falha ao salvar.</li>
          <li>Erros de roteamento retornam detail com codigo, mensagem, orientacao e tentar_novamente. A tela mostra a mensagem e a orientação em português junto ao botão de cálculo. O trajeto anterior é limpo e o botão fica disponível para uma nova tentativa após a resposta.</li>

        </ul>

      </section>

    </main>

  )

}
