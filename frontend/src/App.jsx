import { useEffect, useMemo, useRef, useState } from 'react'

import { api } from './api'
import { apiErrorMessage } from './apiErrors'

import RouteMap from './components/RouteMap'
import DeliveryStopList from './components/DeliveryStopList'

import DistanceMatrix from './components/DistanceMatrix'

import Documentation from './components/Documentation'

import { localDate } from './components/MapDeliveryTarget'



const hoje = localDate()



const enderecoInicial = {

  logradouro: '',

  numero: '',

  bairro: '',

  cidade: 'Osório',

  estado: 'RS',

  cep: '',

  latitude: null,

  longitude: null,

}



export default function App() {

  const [aba, setAba] = useState('rotas')

  const [clientes, setClientes] = useState([])

  const [entregas, setEntregas] = useState([])
  const [ordemEntregas, setOrdemEntregas] = useState([])
  const [excluindoEntrega, setExcluindoEntrega] = useState(null)
  const exclusaoEmAndamento = useRef(false)

  const [selecionadas, setSelecionadas] = useState([])

  const [rota, setRota] = useState(null)
  const [calculandoRota, setCalculandoRota] = useState(false)
  const [erroRota, setErroRota] = useState('')
  const calculoEmAndamento = useRef(false)
  const versaoCalculo = useRef(0)

  const [mensagem, setMensagem] = useState('')

  const [empresaEndereco, setEmpresaEndereco] = useState(null)

  const [empresaCarregando, setEmpresaCarregando] = useState(true)

  const [apiDisponivel, setApiDisponivel] = useState(true)

  const [clienteEditando, setClienteEditando] = useState(null)

  const [entregaEditando, setEntregaEditando] = useState(null)

  const [avulsaForm, setAvulsaForm] = useState(null)



  const [clienteForm, setClienteForm] = useState({

    nome: '',

    telefone: '',

    endereco: enderecoInicial,

  })



  const [entregaForm, setEntregaForm] = useState({

    cliente_id: '',

    endereco_id: '',

    data_prevista: hoje,

    observacoes: '',

  })



  const [empresaForm, setEmpresaForm] = useState(enderecoInicial)



  async function carregar() {

    const [c, e] = await Promise.all([

      api.get('/api/clientes'),

      api.get('/api/entregas'),

    ])

    setClientes(c.data)

    setEntregas(e.data)



    try {

      const empresa = await api.get('/api/empresa/endereco')

      setEmpresaEndereco(empresa.data)

    } catch (err) {

      if (err.response?.status === 404) {

        setEmpresaEndereco(null)

        return

      }

      throw err

    }

  }



  useEffect(() => {

    carregar()

      .then(() => {

        setApiDisponivel(true)

        setMensagem('')

      })

      .catch(() => {

        setApiDisponivel(false)

        setMensagem('Não foi possível conectar com a API.')

      })

      .finally(() => setEmpresaCarregando(false))

  }, [])



  useEffect(() => {
    versaoCalculo.current += 1
    setRota(null)
    setErroRota('')
  }, [selecionadas, entregas, empresaEndereco])

  const entregasHoje = useMemo(() => {
    const atuais = entregas.filter(e => e.data_prevista === hoje)
    const ids = [...ordemEntregas, ...atuais.map(e => e.id).filter(id => !ordemEntregas.includes(id))]
    return ids.map(id => atuais.find(e => e.id === id)).filter(Boolean)
  }, [entregas, ordemEntregas])

  function reordenarEntregas(origem, destino) {
    if (calculandoRota || exclusaoEmAndamento.current) return
    const ids = entregasHoje.map(e => e.id)
    const de = ids.indexOf(origem), para = ids.indexOf(destino)
    if (de < 0 || para < 0 || de === para) return
    ids.splice(para, 0, ids.splice(de, 1)[0])
    setOrdemEntregas(ids)
    setSelecionadas(atual => ids.filter(id => atual.includes(id)))
  }

  const pontosSelecionados = selecionadas

    .map((id) => entregas.find((e) => e.id === id))

    .filter((e) => e?.latitude != null && e?.longitude != null)



  function toggleEntrega(id) {
    if (calculandoRota || exclusaoEmAndamento.current) return
    setSelecionadas(atual => {
      const nova = atual.includes(id) ? atual.filter(x => x !== id) : [...atual, id]
      return entregasHoje.map(e => e.id).filter(x => nova.includes(x))
    })
  }

  async function geocodificar() {

    const { logradouro, numero, bairro, cidade, estado, cep } = clienteForm.endereco



    if (!logradouro || !cidade || !estado) {

      setMensagem('Preencha logradouro, cidade e estado antes de localizar o endereço.')

      return

    }



    setMensagem('Localizando endereço...')

    try {

      const { data } = await api.post(

        '/api/clientes/geocodificar',

        { logradouro, numero, bairro, cidade, estado, cep }

      )



      setClienteForm((old) => ({

        ...old,

        endereco: {

          ...old.endereco,

          latitude: data.latitude,

          longitude: data.longitude,

        },

      }))

      setMensagem(`Endereço localizado: ${data.display_name}`)

    } catch (err) {

      setMensagem(

        err.response?.status === 404

          ? 'Endereço não localizado. Confira os dados informados.'

          : err.response?.data?.detail || 'Erro ao localizar endereço.'

      )

    }

  }



  async function geocodificarEmpresa() {

    const { logradouro, numero, bairro, cidade, estado, cep } = empresaForm



    if (!logradouro || !cidade || !estado) {

      setMensagem('Preencha logradouro, cidade e estado antes de localizar o endereço.')

      return

    }



    setMensagem('Localizando endereço da empresa...')

    try {

      const { data } = await api.post('/api/clientes/geocodificar', {

        logradouro,

        numero,

        bairro,

        cidade,

        estado,

        cep,

      })

      setEmpresaForm((old) => ({

        ...old,

        latitude: data.latitude,

        longitude: data.longitude,

      }))

      setMensagem(`Endereço localizado: ${data.display_name}`)

    } catch (err) {

      setMensagem(

        err.response?.status === 404

          ? 'Endereço não localizado. Confira os dados informados.'

          : err.response?.data?.detail || 'Erro ao localizar endereço.'

      )

    }

  }



  async function salvarEmpresa(event) {

    event.preventDefault()



    if (empresaForm.latitude == null || empresaForm.longitude == null) {

      setMensagem('Localize o endereço da empresa antes de continuar.')

      return

    }



    try {

      const { data } = await api.post('/api/empresa/endereco', empresaForm)

      setEmpresaEndereco(data)

      setMensagem('Endereço da empresa cadastrado.')

    } catch (err) {

      setMensagem(err.response?.data?.detail || 'Erro ao cadastrar endereço da empresa.')

    }

  }



  async function salvarCliente(event) {

    event.preventDefault()



    if (clienteForm.endereco.latitude == null) {

      setMensagem('Localize o endereço antes de salvar o cliente.')

      return

    }



    try {

      const endpoint = clienteEditando

        ? `/api/clientes/${clienteEditando}`

        : '/api/clientes'

      await api[clienteEditando ? 'put' : 'post'](endpoint, clienteForm)

      setClienteForm({

        nome: '',

        telefone: '',

        endereco: enderecoInicial,

      })

      setClienteEditando(null)

      setMensagem(clienteEditando ? 'Cliente atualizado.' : 'Cliente cadastrado.')

      await carregar()

    } catch (err) {

      setMensagem(err.response?.data?.detail || 'Erro ao cadastrar cliente.')

    }

  }



  function editarCliente(cliente) {

    setClienteEditando(cliente.id)

    setClienteForm({

      nome: cliente.nome,

      telefone: cliente.telefone || '',

      endereco: { ...enderecoInicial, ...(cliente.enderecos?.[0] || {}) },

    })

    setMensagem('Editando cliente.')

  }



  async function excluirCliente(cliente) {

    if (!window.confirm(`Excluir o cliente ${cliente.nome}?`)) return



    try {

      await api.delete(`/api/clientes/${cliente.id}`)

      setMensagem('Cliente excluído.')

      await carregar()

    } catch (err) {

      setMensagem(err.response?.data?.detail || 'Erro ao excluir cliente.')

    }

  }



  function cancelarEdicaoCliente() {

    setClienteEditando(null)

    setClienteForm({ nome: '', telefone: '', endereco: enderecoInicial })

  }



  function escolherCliente(clienteId) {

    const cliente = clientes.find((c) => c.id === Number(clienteId))

    const endereco = cliente?.enderecos?.[0]



    setEntregaForm((old) => ({

      ...old,

      cliente_id: clienteId,

      endereco_id: endereco?.id || '',

    }))

  }



  async function salvarEntrega(event) {

    event.preventDefault()

    if (avulsaForm) {

      try {

        await api.put(`/api/entregas/avulsas/${entregaEditando}`, {

          ...avulsaForm, latitude: Number(avulsaForm.latitude), longitude: Number(avulsaForm.longitude),

          data_prevista: entregaForm.data_prevista, observacoes: entregaForm.observacoes,

        })

        setRota(null)

        cancelarEdicaoEntrega()

        setMensagem('Entrega avulsa atualizada. Calcule novamente a rota, se necessário.')

        await carregar()

      } catch (err) {

        const detail = err.response?.data?.detail

        setMensagem(typeof detail === 'string' ? detail : 'Confira os dados da entrega avulsa.')

      }

      return

    }



    const cliente = clientes.find((item) => item.id === Number(entregaForm.cliente_id))

    const endereco = cliente?.enderecos?.find(

      (item) => item.id === Number(entregaForm.endereco_id)

    )



    if (!endereco) {

      setMensagem('Selecione um cliente com endereço cadastrado.')

      return

    }



    if (endereco.latitude == null || endereco.longitude == null) {

      setMensagem('Localize o endereço do cliente antes de cadastrar a entrega.')

      return

    }



    try {

      const payload = {

        ...entregaForm,

        cliente_id: Number(entregaForm.cliente_id),

        endereco_id: Number(entregaForm.endereco_id),

      }

      const endpoint = entregaEditando

        ? `/api/entregas/${entregaEditando}`

        : '/api/entregas'

      await api[entregaEditando ? 'put' : 'post'](endpoint, payload)

      setEntregaForm({

        cliente_id: '',

        endereco_id: '',

        data_prevista: hoje,

        observacoes: '',

      })

      setEntregaEditando(null)

      setMensagem(entregaEditando ? 'Entrega atualizada.' : 'Entrega cadastrada.')

      await carregar()

    } catch (err) {

      setMensagem(err.response?.data?.detail || 'Erro ao cadastrar entrega.')

    }

  }



  function editarEntrega(entrega) {

    setAvulsaForm(entrega.avulsa ? {nome: entrega.cliente_nome, endereco: entrega.endereco_resumo, latitude: entrega.latitude, longitude: entrega.longitude} : null)

    setEntregaEditando(entrega.id)

    setEntregaForm({

      cliente_id: String(entrega.cliente_id),

      endereco_id: String(entrega.endereco_id),

      data_prevista: entrega.data_prevista,

      observacoes: entrega.observacoes || '',

    })

    setMensagem('Editando entrega.')

  }



  async function excluirEntrega(entrega) {
    if (calculoEmAndamento.current || exclusaoEmAndamento.current) return
    if (!window.confirm(`Excluir a entrega #${entrega.id} de ${entrega.cliente_nome}? As rotas vinculadas também serão removidas. O cadastro do cliente e seu endereço serão mantidos.`)) return
    exclusaoEmAndamento.current = true
    setExcluindoEntrega(entrega.id)
    try {
      await api.delete(`/api/entregas/${entrega.id}`)
      setEntregas(atual => atual.filter(item => item.id !== entrega.id))
      setOrdemEntregas(atual => atual.filter(id => id !== entrega.id))
      setSelecionadas(atual => atual.filter(id => id !== entrega.id))
      setRota(null)
      if (entregaEditando === entrega.id) cancelarEdicaoEntrega()
      setMensagem('Entrega excluída.')
    } catch (err) {
      setMensagem(apiErrorMessage(err, 'Erro ao excluir entrega. Tente novamente.'))
    } finally {
      exclusaoEmAndamento.current = false
      setExcluindoEntrega(null)
    }
  }

  function cancelarEdicaoEntrega() {

    setAvulsaForm(null)

    setEntregaEditando(null)

    setEntregaForm({

      cliente_id: '',

      endereco_id: '',

      data_prevista: hoje,

      observacoes: '',

    })

  }



  function incluirAvulsa(entrega) {

    setEntregas(atual => [...atual.filter(item => item.id !== entrega.id), entrega])

    setRota(null)

    if (entrega.data_prevista === hoje) {

      setSelecionadas(atual => atual.includes(entrega.id) ? atual : [...atual, entrega.id])

    }

    setMensagem(`Entrega avulsa #${entrega.id} cadastrada.`)

  }



  async function calcularRota() {
    if (calculoEmAndamento.current || exclusaoEmAndamento.current) return
    if (selecionadas.length < 1) {
      setErroRota('Selecione pelo menos uma entrega para calcular a rota.')
      return
    }
    calculoEmAndamento.current = true
    const versao = ++versaoCalculo.current
    setCalculandoRota(true)
    setRota(null)
    setErroRota('')
    setMensagem('Calculando rota...')
    try {
      const { data } = await api.post('/api/rotas/calcular', {
        entrega_ids: selecionadas,
      }, { timeout: 45000 })
      if (versao === versaoCalculo.current) {
        setRota(data)
        setMensagem(`Rota ${data.id} calculada e salva.`)
      }
    } catch (err) {
      if (versao === versaoCalculo.current) {
        setMensagem('')
        setErroRota(apiErrorMessage(err, 'Não foi possível calcular a rota. Confira os pontos selecionados.'))
      }
    } finally {
      calculoEmAndamento.current = false
      setCalculandoRota(false)
    }
  }

  if (!empresaCarregando && apiDisponivel && !empresaEndereco) {

    return (

      <div className="app setup-app">

        <header>

          <div>

            <div className="brand">MVP - Arquitetura de Software</div>

            <div className="subtitle">Configuração inicial</div>

          </div>

          <div className="api-badge">Endereço da empresa</div>

        </header>



        {mensagem && <div className="message">{mensagem}</div>}



        <main className="single-column setup-main">

          <section className="panel setup-panel">

            <span className="eyebrow">Primeiro acesso</span>

            <h1>Cadastre o endereço da empresa</h1>

            <p>

              Ele será usado como ponto de partida para calcular as rotas de entrega.

            </p>



            <form onSubmit={salvarEmpresa} className="form-grid">

              {['logradouro', 'numero', 'bairro', 'cidade', 'estado', 'cep'].map((campo) => (

                <label key={campo}>

                  {campo.charAt(0).toUpperCase() + campo.slice(1)}

                  <input

                    required={['logradouro', 'cidade', 'estado'].includes(campo)}

                    value={empresaForm[campo] || ''}

                    onChange={(event) =>

                      setEmpresaForm({ ...empresaForm, [campo]: event.target.value })

                    }

                  />

                </label>

              ))}



              <div className="coordinates">

                Latitude: {empresaForm.latitude ?? '—'} · Longitude:{' '}

                {empresaForm.longitude ?? '—'}

              </div>



              <div className="actions">

                <button type="button" onClick={geocodificarEmpresa}>

                  Localizar endereço

                </button>

                <button className="primary" type="submit">

                  Continuar

                </button>

              </div>

            </form>

          </section>

        </main>

      </div>

    )

  }



  return (

    <div className="app">

      <header>

        <div>

          <div className="brand">MVP - Arquitetura de Software</div>

          <div className="subtitle">MVP • FastAPI + OpenStreetMap</div>

        </div>

        <div className="api-badge">API própria + API externa</div>

      </header>



      <nav>

        <button className={aba === 'rotas' ? 'active' : ''} onClick={() => setAba('rotas')}>

          Rotas

        </button>

        <button className={aba === 'clientes' ? 'active' : ''} onClick={() => setAba('clientes')}>

          Clientes

        </button>

        <button className={aba === 'entregas' ? 'active' : ''} onClick={() => setAba('entregas')}>

          Entregas

        </button>

        <button className={aba === 'documentacao' ? 'active' : ''} onClick={() => setAba('documentacao')}>

          Documentação

        </button>

        <button className={aba === 'ajuda' ? 'active' : ''} onClick={() => setAba('ajuda')}>

          Ajuda

        </button>

        <button className={aba === 'sobre' ? 'active' : ''} onClick={() => setAba('sobre')}>

          Sobre

        </button>

      </nav>



      {mensagem && <div className="message">{mensagem}</div>}



      {aba === 'rotas' && (

        <main className="route-layout">

          <section className="panel stops">

            <div className="panel-title">

              <div>

                <h2>Entregas de hoje</h2>

                <span>{hoje.split('-').reverse().join('/')}</span>

              </div>

              <span className="counter">{entregasHoje.length}</span>

            </div>



            {entregasHoje.length === 0 && (

              <div className="empty">Cadastre entregas para a data de hoje.</div>

            )}



            <DeliveryStopList
              entregas={entregasHoje}
              selecionadas={selecionadas}
              disabled={calculandoRota || excluindoEntrega !== null}
              excluindo={excluindoEntrega}
              onToggle={toggleEntrega}
              onReorder={reordenarEntregas}
              onDelete={excluirEntrega}
            />

            <button className="primary wide" onClick={calcularRota} disabled={calculandoRota || excluindoEntrega !== null} aria-busy={calculandoRota}>
              {calculandoRota ? 'Calculando...' : 'Calcular rota'}
            </button>
            {erroRota && <div className="route-error" role="alert">
              <strong>Não foi possível concluir o cálculo</strong>
              <p>{erroRota}</p>
            </div>}

          </section>



          <section className="map-area">

            <div className="stats">

              <div>

                <span>Distância</span>

                <strong>{rota ? `${rota.distancia_km} km` : '—'}</strong>

              </div>

              <div>

                <span>Tempo estimado</span>

                <strong>{rota ? `${rota.duracao_minutos} min` : '—'}</strong>

              </div>

              <div>

                <span>Paradas</span>

                <strong>{selecionadas.length}</strong>

              </div>

            </div>



            <RouteMap points={pontosSelecionados} origin={empresaEndereco} route={rota} onAvulsaCreated={incluirAvulsa} />

            <DistanceMatrix

              key={JSON.stringify([selecionadas, pontosSelecionados, empresaEndereco])}

              entregaIds={selecionadas}

            />

          </section>

        </main>

      )}



      {aba === 'clientes' && (

        <main className="single-column">

          <section className="panel">

            <h2>{clienteEditando ? 'Editar cliente' : 'Novo cliente'}</h2>

            <form onSubmit={salvarCliente} className="form-grid">

              <label>

                Nome

                <input

                  required

                  value={clienteForm.nome}

                  onChange={(e) =>

                    setClienteForm({ ...clienteForm, nome: e.target.value })

                  }

                />

              </label>



              <label>

                Telefone

                <input

                  value={clienteForm.telefone}

                  onChange={(e) =>

                    setClienteForm({ ...clienteForm, telefone: e.target.value })

                  }

                />

              </label>



              {['logradouro', 'numero', 'bairro', 'cidade', 'estado', 'cep'].map((campo) => (

                <label key={campo}>

                  {campo.charAt(0).toUpperCase() + campo.slice(1)}

                  <input

                    required={['logradouro', 'cidade', 'estado'].includes(campo)}

                    value={clienteForm.endereco[campo] || ''}

                    onChange={(e) =>

                      setClienteForm({

                        ...clienteForm,

                        endereco: {

                          ...clienteForm.endereco,

                          [campo]: e.target.value,

                        },

                      })

                    }

                  />

                </label>

              ))}



              <div className="coordinates">

                Latitude: {clienteForm.endereco.latitude ?? '—'} · Longitude:{' '}

                {clienteForm.endereco.longitude ?? '—'}

              </div>



              <div className="actions">

                {clienteEditando && (

                  <button type="button" onClick={cancelarEdicaoCliente}>

                    Cancelar

                  </button>

                )}

                <button type="button" onClick={geocodificar}>

                  Localizar endereço

                </button>

                <button className="primary" type="submit">

                  {clienteEditando ? 'Atualizar cliente' : 'Salvar cliente'}

                </button>

              </div>

            </form>

          </section>



          <section className="panel">

            <h2>Clientes cadastrados</h2>

            <div className="table table-clientes">

              <div className="table-header">

                <strong>Nome</strong>

                <strong>Telefone</strong>

                <strong>Endereço</strong>

                <strong>Ações</strong>

              </div>

              {clientes.map((cliente) => (

                <div className="table-row" key={cliente.id}>

                  <strong>{cliente.nome}</strong>

                  <span>{cliente.telefone || '—'}</span>

                  <span>{cliente.enderecos?.[0]?.logradouro || '—'}</span>

                  <div className="row-actions">

                    <button type="button" onClick={() => editarCliente(cliente)}>

                      Editar

                    </button>

                    <button type="button" className="danger" onClick={() => excluirCliente(cliente)}>

                      Excluir

                    </button>

                  </div>

                </div>

              ))}

              {clientes.length === 0 && <div className="empty">Nenhum cliente cadastrado.</div>}

            </div>

          </section>

        </main>

      )}



      {aba === 'entregas' && (

        <main className="single-column">

          <section className="panel">

            <h2>{avulsaForm ? 'Editar entrega avulsa' : entregaEditando ? 'Editar entrega' : 'Nova entrega'}</h2>



            <form onSubmit={salvarEntrega} className="form-grid">

              {avulsaForm ? <>

                <label>Destinatário / identificação<input required maxLength={150} value={avulsaForm.nome} onChange={e => setAvulsaForm({...avulsaForm, nome: e.target.value})} /></label>

                <label>Endereço / referência<input required maxLength={500} value={avulsaForm.endereco} onChange={e => setAvulsaForm({...avulsaForm, endereco: e.target.value})} /></label>

                <label>Latitude<input type="number" step="any" min="-90" max="90" required value={avulsaForm.latitude} onChange={e => setAvulsaForm({...avulsaForm, latitude: e.target.value})} /></label>

                <label>Longitude<input type="number" step="any" min="-180" max="180" required value={avulsaForm.longitude} onChange={e => setAvulsaForm({...avulsaForm, longitude: e.target.value})} /></label>

              </> : <label>

                Cliente

                <select

                  required

                  value={entregaForm.cliente_id}

                  onChange={(e) => escolherCliente(e.target.value)}

                >

                  <option value="">Selecione...</option>

                  {clientes.map((c) => (

                    <option key={c.id} value={c.id}>

                      {c.nome}

                    </option>

                  ))}

                </select>

              </label>}



              <label>

                Data prevista

                <input

                  type="date"

                  required

                  value={entregaForm.data_prevista}

                  onChange={(e) =>

                    setEntregaForm({

                      ...entregaForm,

                      data_prevista: e.target.value,

                    })

                  }

                />

              </label>



              <label className="full">

                Observações

                <textarea

                  rows="3"

                  value={entregaForm.observacoes}

                  onChange={(e) =>

                    setEntregaForm({

                      ...entregaForm,

                      observacoes: e.target.value,

                    })

                  }

                />

              </label>



              <div className="actions">

                {entregaEditando && (

                  <button type="button" onClick={cancelarEdicaoEntrega}>

                    Cancelar

                  </button>

                )}

                <button className="primary" type="submit">

                  {entregaEditando ? 'Atualizar entrega' : 'Cadastrar entrega'}

                </button>

              </div>

            </form>

          </section>



          <section className="panel">

            <h2>Entregas cadastradas</h2>

            <div className="table">

              <div className="table-header">

                <strong>ID</strong>

                <strong>Cliente</strong>

                <strong>Data</strong>

                <strong>Status</strong>

                <strong>Ações</strong>

              </div>

              {entregas.map((e) => (

                <div className="table-row" key={e.id}>

                  <strong>{e.id}</strong>

                  <span>{e.cliente_nome}{e.avulsa && <span className="avulsa-badge">Avulsa</span>}</span>

                  <span>{e.data_prevista.split('-').reverse().join('/')}</span>

                  <span className="status">{e.status}</span>

                  <div className="row-actions">

                    <button type="button" onClick={() => editarEntrega(e)}>

                      Editar

                    </button>

                    <button type="button" className="danger" onClick={() => excluirEntrega(e)}>

                      Excluir

                    </button>

                  </div>

                </div>

              ))}

              {entregas.length === 0 && <div className="empty">Nenhuma entrega cadastrada.</div>}

            </div>

          </section>

        </main>

      )}



      {aba === 'ajuda' && (

        <main className="single-column help-page">

          <section className="panel help-intro">

            <span className="eyebrow">Guia rápido</span>

            <h1>Como usar o MVP - Arquitetura de Software</h1>

            <p>

              Configure a empresa, cadastre clientes e organize as entregas para

              calcular rotas, consultar pontos no mapa e comparar distâncias entre as paradas.

            </p>

          </section>



          <div className="help-grid">

            <section className="panel">

              <h2>1. Configure a empresa</h2>

              <p>O endereço da empresa é o ponto de partida de todas as rotas.</p>

              <ol>

                <li>Preencha o endereço da empresa.</li>

                <li>Clique em <strong>Localizar endereço</strong>.</li>

                <li>Salve depois que as coordenadas aparecerem.</li>

              </ol>

            </section>



            <section className="panel">

              <h2>2. Cadastre clientes</h2>

              <p>Cada cliente precisa de um endereço localizado no mapa.</p>

              <ol>

                <li>Informe nome e endereço.</li>

                <li>Localize o endereço.</li>

                <li>Salve o cliente.</li>

              </ol>

            </section>



            <section className="panel">

              <h2>3. Crie entregas</h2>

              <p>Escolha um cliente e informe a data prevista da entrega.</p>

              <ol>

                <li>Selecione o cliente.</li>

                <li>Confira a data.</li>

                <li>Cadastre a entrega.</li>

              </ol>

            </section>



            <section className="panel">

              <h2>4. Organize e calcule uma rota</h2>

              <p>As rotas sempre começam na empresa e seguem a ordem dos cards selecionados na lista.</p>

              <ol>

                <li>Abra <strong>Rotas</strong>.</li>

                <li>Selecione uma ou mais entregas.</li>
                <li>Arraste pela alça à esquerda do card, com o mouse ou por toque, para ajustar a ordem das paradas. No teclado, pressione Tab até a alça e use as setas para cima e para baixo.</li>
                <li>Confira os números dos cards marcados: eles indicam a sequência após a saída da empresa. Cards desmarcados não entram no percurso.</li>

                <li>Clique em <strong>Calcular rota</strong>.</li>

              </ol>

            </section>

            <section className="panel">
              <h2>5. Exclua uma entrega da lista</h2>
              <ol>
                <li>Em <strong>Entregas de hoje</strong>, clique na lixeira à direita do card.</li>
                <li>Confira a entrega na mensagem e confirme a exclusão, ou cancele para mantê-la.</li>
                <li>Após excluir, confira a numeração das paradas restantes e calcule novamente a rota.</li>
              </ol>
              <p>A lixeira funciona para entregas de clientes e avulsas. Ela exclui a entrega e as rotas vinculadas, preservando o cadastro do cliente e seu endereço.</p>
              <p>Para apenas retirar uma parada do cálculo, desmarque sua caixa. Isso mantém a entrega cadastrada.</p>
            </section>

            <section className="panel">

              <h2>6. Insira uma entrega avulsa pelo mapa</h2>

              <p>Use o alvo no canto inferior direito para criar uma entrega sem cadastrar um cliente.</p>

              <ol>

                <li>Na aba <strong>Rotas</strong>, arraste o alvo até o local desejado e solte.</li>

                <li>O popup abre e consulta automaticamente o endereço próximo.</li>

                <li>Confira o endereço e informe identificação, data e observações.</li>

                <li>Clique em <strong>Inserir entrega avulsa</strong>.</li>

              </ol>

              <p>Entregas de hoje entram selecionadas na lista. Para outra data, consulte a aba Entregas. Você também pode clicar no alvo e depois no mapa; para ajustar o ponto, arraste o marcador.</p>

            </section>



            <section className="panel">

              <h2>7. Compare as paradas</h2>

              <p>Veja a distância e o tempo entre a empresa e cada entrega.</p>

              <ol>

                <li>Selecione de 1 a 24 entregas na aba <strong>Rotas</strong>.</li>

                <li>Abaixo do mapa, clique em <strong>Comparar paradas</strong>.</li>

                <li>Leia a tabela: a linha indica a origem e a coluna, o destino.</li>

              </ol>

              <p>Os valores são exibidos em km e minutos. “Sem trajeto” indica que não foi encontrada uma conexão entre os pontos.</p>

            </section>

          </div>



          <section className="panel help-rules">

            <h2>Regras importantes</h2>

            <ul>

              <li>Entregas de clientes usam o endereço cadastrado. Entregas avulsas usam o ponto exato do alvo e uma referência conferida por você.</li>

              <li>Clientes com entregas vinculadas não podem ser excluídos.</li>

              <li>Excluir uma entrega também remove as rotas que dependem dela.</li>

              <li>É possível editar clientes e entregas pelas tabelas respectivas. Avulsas têm identificação própria e podem ser editadas ou excluídas em Entregas.</li>

              <li>A lista de Rotas mostra as entregas previstas para hoje. A sequência do percurso segue a posição dos cards marcados, e não a ordem em que você marcou as caixas.</li>
              <li>A ordem ajustada fica na tela enquanto a aplicação permanece aberta. Se atualizar a página, ajuste a ordem novamente. Calcular a rota salva a sequência daquela rota.</li>
              <li>Ao mudar a ordem ou a seleção, o trajeto anterior sai do mapa. Clique em Calcular rota para exibir o novo percurso.</li>
              <li>Durante o cálculo, aguarde para selecionar, arrastar ou excluir entregas. Durante uma exclusão, aguarde antes de alterar a lista ou calcular.</li>

              <li>A comparação não salva uma rota e não muda a ordem das entregas. Ao mudar a seleção ou a ordem dos cards, compare novamente.</li>

              <li>Para calcular e salvar o trajeto, use <strong>Calcular rota</strong>.</li>

              <li>As consultas de endereço, os trajetos e o carregamento do mapa precisam de internet.</li>

            </ul>

          </section>

          <section className="panel help-rules">

            <h2>Se algo não funcionar</h2>

            <ul>

              <li><strong>Endereço não localizado:</strong> no popup, informe manualmente um endereço ou referência, ou arraste o alvo para outro ponto.</li>

              <li><strong>Sem conexão com a API:</strong> confira se o Docker e os containers estão em execução.</li>

              <li><strong>Trajeto não encontrado:</strong> confira os pontos, ajuste a localização ou retire uma parada por vez.</li>
              <li><strong>Ponto sem via próxima:</strong> ajuste a origem ou a entrega para uma rua acessível no mapa.</li>
              <li><strong>Demora ou serviço indisponível:</strong> aguarde e tente novamente; para consultas grandes, selecione menos entregas.</li>
              <li><strong>Falha ao salvar:</strong> o trajeto foi calculado, mas houve um problema na gravação. Se persistir, informe o responsável pelo sistema.</li>

              <li><strong>Não consigo arrastar:</strong> use a alça de pontinhos à esquerda, não o texto do endereço. Aguarde se houver cálculo ou exclusão em andamento.</li>
              <li><strong>Erro ao excluir:</strong> a entrega permanece na lista. Confira a mensagem, atualize a lista e verifique se ela ainda está cadastrada antes de tentar novamente.</li>
              <li><strong>Erro no cálculo:</strong> leia o motivo e a orientação exibidos abaixo do botão. Corrija os pontos ou aguarde, conforme a mensagem, e clique novamente em Calcular rota.</li>
              <li><strong>Comparação indisponível:</strong> selecione entre 1 e 24 entregas com coordenadas.</li>

            </ul>

            <p>Para conhecer os endpoints e testar as integrações, abra a documentação.</p>

            <button type="button" onClick={() => setAba('documentacao')}>Abrir documentação</button>

          </section>

        </main>

      )}



      {aba === 'documentacao' && <Documentation />}



      {aba === 'sobre' && (

        <main className="single-column help-page">

          <section className="panel help-intro">

            <span className="eyebrow">MVP - Arquitetura de Software · Projeto acadêmico</span>

            <h1>Sobre o MVP</h1>

            <p>MVP Arquitetura de Software.</p>

            <p>Aplicação para planejamento de coletas e entregas, com localização de endereços, cálculo de rotas e comparação de distâncias.</p>

          </section>

          <div className="help-grid">

            <section className="panel">

              <h2>Desenvolvedor</h2>

              <p>Marcio Almeida da Silva</p>

            </section>

            <section className="panel">

              <h2>Curso</h2>

              <p>Pós-Graduação em Engenharia de Software</p>

            </section>

            <section className="panel">

              <h2>Instituição</h2>

              <p>PUC-Rio</p>

            </section>

            <section className="panel">

              <h2>Sprint</h2>

              <p>Arquitetura de Software</p>

            </section>

          </div>

        </main>

      )}





      <footer>

        Dados do mapa © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors (ODbL)</a> • Rotas por <a href="https://project-osrm.org/" target="_blank" rel="noreferrer">OSRM</a> • MVP acadêmico

      </footer>

    </div>

  )

}
