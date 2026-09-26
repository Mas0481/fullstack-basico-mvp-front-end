export function apiErrorMessage(error, fallback = 'Não foi possível concluir a operação.') {
  const detail = error.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (detail && typeof detail === 'object' && !Array.isArray(detail) && typeof detail.mensagem === 'string') {
    return [detail.mensagem, typeof detail.orientacao === 'string' ? detail.orientacao : ''].filter(Boolean).join(' ')
  }
  if (Array.isArray(detail)) return 'Os dados enviados são inválidos. Confira a seleção e as coordenadas das entregas.'
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return 'A operação demorou demais para responder. Aguarde um pouco e tente novamente.'
  if (!error.response) return 'Não foi possível conectar à API. Verifique se o Docker está em execução e tente novamente.'
  if (error.response.status >= 500) return 'Ocorreu uma falha no sistema ao processar a solicitação. Tente novamente; se persistir, informe o responsável pelo sistema.'
  return fallback
}
