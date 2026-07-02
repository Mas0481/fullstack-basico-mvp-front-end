(function () {
    const API_BASE_URL = (window.API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');

    const endpoints = {
        root: `${API_BASE_URL}/`,
        funcionarios: `${API_BASE_URL}/funcionarios`,
        funcionarioById: (id) => `${API_BASE_URL}/funcionarios/${id}`,
    };

    const DEPARTAMENTOS = [
        'Tecnologia da Informação',
        'Recursos Humanos',
        'Financeiro',
        'Comercial/Vendas',
    ];

    const DIAS_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

    let funcionariosCache = [];
    let cadastroFormApi = null;
    let edicaoFormApi = null;
    let cpfContinuationAction = null;

    function normalizeText(value) {
        return String(value || '').trim();
    }

    function toNullableValue(value) {
        const text = normalizeText(value);
        return text === '' ? null : text;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function showToast(message, type) {
        const toastType = type || 'success';
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toastEl = document.createElement('div');
        toastEl.className = `toast align-items-center text-bg-${toastType} border-0`;
        toastEl.setAttribute('role', 'alert');
        toastEl.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${escapeHtml(message)}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
            </div>
        `;

        container.appendChild(toastEl);
        const toast = getBootstrapToastInstance(toastEl);
        if (!toast) {
            return;
        }

        toast.show();
        toastEl.addEventListener('hidden.bs.toast', function () {
            toastEl.remove();
        });
    }

    function getBootstrapToastInstance(toastEl) {
        const bootstrapApi = window.bootstrap;
        if (!bootstrapApi || !bootstrapApi.Toast) {
            return null;
        }

        if (typeof bootstrapApi.Toast.getOrCreateInstance === 'function') {
            return bootstrapApi.Toast.getOrCreateInstance(toastEl, { delay: 4000 });
        }

        if (typeof bootstrapApi.Toast.getInstance === 'function') {
            return bootstrapApi.Toast.getInstance(toastEl) || new bootstrapApi.Toast(toastEl, { delay: 4000 });
        }

        return new bootstrapApi.Toast(toastEl, { delay: 4000 });
    }

    function generateTestCpf() {
        const digits = [];
        while (digits.length < 9) {
            digits.push(Math.floor(Math.random() * 10));
        }

        if (digits.every(function (digit) { return digit === digits[0]; })) {
            digits[8] = (digits[8] + 1) % 10;
        }

        const firstSum = digits.reduce(function (total, digit, index) {
            return total + digit * (10 - index);
        }, 0);
        const firstDigit = ((firstSum * 10) % 11) % 10;
        digits.push(firstDigit);

        const secondSum = digits.reduce(function (total, digit, index) {
            return total + digit * (11 - index);
        }, 0);
        const secondDigit = ((secondSum * 10) % 11) % 10;
        digits.push(secondDigit);

        return digits.join('');
    }

    function formatCpfForDisplay(cpfDigits) {
        const digits = String(cpfDigits || '').replace(/\D/g, '').slice(0, 11);
        if (digits.length !== 11) {
            return digits;
        }

        return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    function isCpfRelatedError(error) {
        const body = error && error.body && typeof error.body === 'object' ? error.body : null;
        if (!body) return false;

        const message = String(body.mensagem || error.message || '').toLowerCase();
        if (message.includes('cpf')) {
            return true;
        }

        const detalhes = Array.isArray(body.detalhes) ? body.detalhes : [];
        return detalhes.some(function (detalhe) {
            const campo = String(detalhe && detalhe.campo ? detalhe.campo : '').toLowerCase();
            const detalheMensagem = String((detalhe && (detalhe.mensagem || detalhe.msg)) || '').toLowerCase();
            return campo === 'cpf' || detalheMensagem.includes('cpf');
        });
    }

    function setCpfContinuationAction(action) {
        cpfContinuationAction = action;
    }

    function getBootstrapModalInstance(modalEl) {
        const bootstrapApi = window.bootstrap;
        if (!bootstrapApi || !bootstrapApi.Modal) {
            return null;
        }

        if (typeof bootstrapApi.Modal.getOrCreateInstance === 'function') {
            return bootstrapApi.Modal.getOrCreateInstance(modalEl);
        }

        if (typeof bootstrapApi.Modal.getInstance === 'function') {
            return bootstrapApi.Modal.getInstance(modalEl) || new bootstrapApi.Modal(modalEl);
        }

        return new bootstrapApi.Modal(modalEl);
    }

    function openCpfContinuationModal(error) {
        const modalEl = document.getElementById('cpf-continuation-modal');
        if (!modalEl) return;

        const messageEl = modalEl.querySelector('.js-cpf-continuation-message');
        if (messageEl) {
            messageEl.textContent = error && error.message ? error.message : 'Erro de CPF detectado.';
        }

        const modal = getBootstrapModalInstance(modalEl);
        if (!modal) {
            return;
        }

        modal.show();
    }

    function updateCpfField(form, prefix, cpf) {
        const field = document.getElementById(`${prefix}cpf`);
        if (field) {
            field.value = formatCpfForDisplay(cpf);
        }

        if (form) {
            form.classList.add('was-validated');
        }
    }

    function getFieldIdMap() {
        return {
            nome: 'nome',
            data_nascimento: 'dataNascimento',
            genero: 'genero',
            cpf: 'cpf',
            email: 'email',
            telefone: 'telefone',
            cargo: 'cargo',
            departamento: 'departamento',
            data_admissao: 'dataAdmissao',
            salario: 'salario',
            tipo_contrato: 'tipoContrato',
            horario_entrada: 'entrada',
            horario_saida_almoco: 'saidaAlmoco',
            horario_retorno_almoco: 'retornoAlmoco',
            horario_saida: 'saida',
            dias_trabalho: 'diasTrabalho',
        };
    }

    function getFormPrefix(form) {
        const hiddenField = form && form.querySelector('input[type="hidden"]');
        if (!hiddenField || !hiddenField.id) {
            return '';
        }

        return hiddenField.id.replace(/id$/, '');
    }

    function clearFormErrors(form) {
        if (!form) return;

        form.querySelectorAll('.is-invalid').forEach(function (field) {
            field.classList.remove('is-invalid');
        });

        form.querySelectorAll('.js-api-field-error').forEach(function (node) {
            node.remove();
        });

        const summary = form.querySelector('.js-form-api-error');
        if (summary) {
            summary.classList.add('d-none');
            summary.innerHTML = '';
        }
    }

    function renderFormErrors(form, error) {
        if (!form) return;

        clearFormErrors(form);

        const body = error && error.body && typeof error.body === 'object' ? error.body : null;
        const prefix = getFormPrefix(form);
        const fieldMap = getFieldIdMap();
        const mensagens = [];

        if (body && body.mensagem) {
            mensagens.push(body.mensagem);
        } else if (error && error.message) {
            mensagens.push(error.message);
        }

        const detalhes = body && Array.isArray(body.detalhes) ? body.detalhes : [];
        const detalhesPorCampo = {};

        detalhes.forEach(function (detalhe) {
            const campo = detalhe && detalhe.campo ? String(detalhe.campo) : '';
            const mensagem = detalhe && (detalhe.mensagem || detalhe.msg) ? String(detalhe.mensagem || detalhe.msg) : 'Valor inválido.';

            if (campo) {
                detalhesPorCampo[campo] = detalhesPorCampo[campo] || [];
                detalhesPorCampo[campo].push(mensagem);
            } else {
                mensagens.push(mensagem);
            }
        });

        Object.keys(detalhesPorCampo).forEach(function (campo) {
            const fieldId = fieldMap[campo] || campo;
            const field = document.getElementById(`${prefix}${fieldId}`);
            if (!field) {
                mensagens.push(`${campo}: ${detalhesPorCampo[campo].join(', ')}`);
                return;
            }

            field.classList.add('is-invalid');

            const fieldContainer = field.closest('.col-md-6, .col-md-4, .col-md-3, .col-12') || field.parentElement;
            if (!fieldContainer) return;

            const feedback = document.createElement('div');
            feedback.className = 'invalid-feedback d-block js-api-field-error';
            feedback.textContent = detalhesPorCampo[campo].join(' ');
            fieldContainer.appendChild(feedback);
        });

        const summary = form.querySelector('.js-form-api-error');
        if (summary && mensagens.length > 0) {
            summary.innerHTML = `
                <strong>Não foi possível salvar o funcionário.</strong>
                <div class="mt-2">
                    <ul class="mb-0 ps-3">
                        ${mensagens.map(function (mensagem) {
                            return `<li>${escapeHtml(mensagem)}</li>`;
                        }).join('')}
                    </ul>
                </div>
            `;
            summary.classList.remove('d-none');
            summary.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function applyCpfMask(input) {
        input.addEventListener('input', function () {
            let value = input.value.replace(/\D/g, '').slice(0, 11);
            if (value.length > 9) {
                value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
            } else if (value.length > 6) {
                value = value.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
            } else if (value.length > 3) {
                value = value.replace(/(\d{3})(\d{0,3})/, '$1.$2');
            }
            input.value = value;
        });
    }

    function applyPhoneMask(input) {
        input.addEventListener('input', function () {
            let value = input.value.replace(/\D/g, '').slice(0, 11);
            if (value.length > 10) {
                value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
            } else if (value.length > 6) {
                value = value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
            } else if (value.length > 2) {
                value = value.replace(/(\d{2})(\d{0,5})/, '($1) $2');
            } else if (value.length > 0) {
                value = value.replace(/(\d{0,2})/, '($1');
            }
            input.value = value.trim();
        });
    }

    function buildDepartamentoOptions(selectedValue) {
        return DEPARTAMENTOS.map(function (departamento) {
            const selected = departamento === selectedValue ? ' selected' : '';
            return `<option${selected}>${escapeHtml(departamento)}</option>`;
        }).join('');
    }

    function buildDiasCheckboxes(prefix, selectedDays) {
        const dias = selectedDays || [];
        return DIAS_SEMANA.map(function (dia) {
            const label = dia.charAt(0).toUpperCase() + dia.slice(1);
            const checked = dias.includes(label) || dias.includes(dia) ? ' checked' : '';
            return `
                <div class="form-check form-check-inline">
                    <input class="form-check-input" type="checkbox" id="${prefix}${dia}" name="${prefix}${dia}"${checked}>
                    <label class="form-check-label" for="${prefix}${dia}">${label === 'Sab' ? 'Sáb' : label}</label>
                </div>
            `;
        }).join('');
    }

    function buildFuncionarioForm(config) {
        const prefix = config.prefix || '';
        const defaults = config.defaults || {};
        const formId = config.formId;
        const submitLabel = config.submitLabel || 'Salvar';
        const showReset = config.showReset !== false;
        const showCancel = config.showCancel === true;
        const hiddenId = config.hiddenId ? `<input type="hidden" id="${prefix}id" value="${escapeHtml(defaults.id || '')}">` : '';

        const html = `
            <form id="${formId}" class="shadow-sm p-4 bg-white rounded funcionario-form">
                ${hiddenId}
                <div class="alert alert-danger d-none js-form-api-error" role="alert"></div>
                <div class="secao-form mb-4">
                    <h5 class="titulo-secao">1. Dados Pessoais</h5>
                    <hr>
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label for="${prefix}nome" class="form-label">Nome Completo</label>
                            <input type="text" class="form-control" id="${prefix}nome" value="${escapeHtml(defaults.nome || '')}" required>
                        </div>
                        <div class="col-md-3">
                            <label for="${prefix}dataNascimento" class="form-label">Data de Nascimento</label>
                            <input type="date" class="form-control" id="${prefix}dataNascimento" value="${escapeHtml(defaults.data_nascimento || '')}" required>
                        </div>
                        <div class="col-md-3">
                            <label for="${prefix}genero" class="form-label">Gênero</label>
                            <select id="${prefix}genero" class="form-select">
                                <option value="" ${!defaults.genero ? 'selected' : ''} disabled>Selecione...</option>
                                <option ${defaults.genero === 'Masculino' ? 'selected' : ''}>Masculino</option>
                                <option ${defaults.genero === 'Feminino' ? 'selected' : ''}>Feminino</option>
                                <option ${defaults.genero === 'Não informar' ? 'selected' : ''}>Não informar</option>
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label for="${prefix}cpf" class="form-label">CPF</label>
                            <div class="input-group">
                                <input type="text" class="form-control js-cpf-mask" id="${prefix}cpf" value="${escapeHtml(defaults.cpf || '')}" placeholder="000.000.000-00" required>
                                <button type="button" class="btn btn-outline-secondary js-generate-cpf" data-target="${prefix}cpf">Gerar</button>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <label for="${prefix}email" class="form-label">E-mail Pessoal</label>
                            <input type="email" class="form-control" id="${prefix}email" value="${escapeHtml(defaults.email || '')}" placeholder="joao@email.com">
                        </div>
                        <div class="col-md-4">
                            <label for="${prefix}telefone" class="form-label">Telefone/Celular</label>
                            <input type="tel" class="form-control js-phone-mask" id="${prefix}telefone" value="${escapeHtml(defaults.telefone || '')}" placeholder="(11) 99999-9999">
                        </div>
                    </div>
                </div>

                <div class="secao-form mb-4">
                    <h5 class="titulo-secao">2. Dados da Admissão e Cargo</h5>
                    <hr>
                    <div class="row g-3">
                        <div class="col-md-4">
                            <label for="${prefix}cargo" class="form-label">Cargo</label>
                            <input type="text" class="form-control" id="${prefix}cargo" value="${escapeHtml(defaults.cargo || '')}" required>
                        </div>
                        <div class="col-md-4">
                            <label for="${prefix}departamento" class="form-label">Departamento</label>
                            <select id="${prefix}departamento" class="form-select" required>
                                <option value="" disabled ${!defaults.departamento ? 'selected' : ''}>Escolha o setor...</option>
                                ${buildDepartamentoOptions(defaults.departamento)}
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label for="${prefix}dataAdmissao" class="form-label">Data de Admissão</label>
                            <input type="date" class="form-control" id="${prefix}dataAdmissao" value="${escapeHtml(defaults.data_admissao || '')}" required>
                        </div>
                        <div class="col-md-4">
                            <label for="${prefix}salario" class="form-label">Salário Inicial (R$)</label>
                            <input type="number" step="0.01" class="form-control" id="${prefix}salario" value="${defaults.salario ?? ''}">
                        </div>
                        <div class="col-md-4">
                            <label for="${prefix}tipoContrato" class="form-label">Tipo de Contrato</label>
                            <select id="${prefix}tipoContrato" class="form-select">
                                <option ${(!defaults.tipo_contrato || defaults.tipo_contrato === 'CLT') ? 'selected' : ''}>CLT</option>
                                <option ${defaults.tipo_contrato === 'PJ' ? 'selected' : ''}>PJ</option>
                                <option ${defaults.tipo_contrato === 'Estágio' ? 'selected' : ''}>Estágio</option>
                                <option ${defaults.tipo_contrato === 'Temporário' ? 'selected' : ''}>Temporário</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="secao-form mb-4">
                    <h5 class="titulo-secao">3. Horário de Trabalho</h5>
                    <hr>
                    <div class="row g-3">
                        <div class="col-md-3">
                            <label for="${prefix}entrada" class="form-label">Horário de Entrada</label>
                            <input type="time" class="form-control" id="${prefix}entrada" value="${escapeHtml(defaults.horario_entrada || '08:00')}">
                        </div>
                        <div class="col-md-3">
                            <label for="${prefix}saidaAlmoco" class="form-label">Saída para Almoço</label>
                            <input type="time" class="form-control" id="${prefix}saidaAlmoco" value="${escapeHtml(defaults.horario_saida_almoco || '12:00')}">
                        </div>
                        <div class="col-md-3">
                            <label for="${prefix}retornoAlmoco" class="form-label">Retorno do Almoço</label>
                            <input type="time" class="form-control" id="${prefix}retornoAlmoco" value="${escapeHtml(defaults.horario_retorno_almoco || '13:00')}">
                        </div>
                        <div class="col-md-3">
                            <label for="${prefix}saida" class="form-label">Horário de Saída</label>
                            <input type="time" class="form-control" id="${prefix}saida" value="${escapeHtml(defaults.horario_saida || '17:00')}">
                        </div>
                        <div class="col-12 mt-3">
                            <label class="form-label d-block">Dias de Trabalho</label>
                            ${buildDiasCheckboxes(prefix, parseDiasTrabalho(defaults.dias_trabalho))}
                        </div>
                    </div>
                </div>

                <div class="d-flex justify-content-end gap-2 mt-4">
                    ${showCancel ? `<button type="button" id="${prefix}btn-cancelar" class="btn btn-light-custom">Cancelar</button>` : ''}
                    ${showReset ? `<button type="reset" class="btn btn-light-custom">Limpar Campos</button>` : ''}
                    <button type="submit" class="btn btn-primary-custom">${escapeHtml(submitLabel)}</button>
                </div>
            </form>
        `;

        return html;
    }

    function mountForm(containerId, config) {
        const container = document.getElementById(containerId);
        if (!container) return null;

        container.innerHTML = buildFuncionarioForm(config);
        container.querySelectorAll('.js-cpf-mask').forEach(applyCpfMask);
        container.querySelectorAll('.js-phone-mask').forEach(applyPhoneMask);
        container.querySelectorAll('.js-generate-cpf').forEach(function (button) {
            button.addEventListener('click', function () {
                const targetId = button.getAttribute('data-target');
                const cpfField = targetId ? document.getElementById(targetId) : null;
                if (!cpfField) return;

                cpfField.value = generateTestCpf();
                cpfField.dispatchEvent(new Event('input', { bubbles: true }));
                cpfField.focus();
            });
        });

        const form = document.getElementById(config.formId);
        return {
            form: form,
            prefix: config.prefix || '',
            hiddenId: config.hiddenId,
        };
    }

    function parseDiasTrabalho(valor) {
        if (!valor) return [];
        return String(valor)
            .split(',')
            .map(function (item) {
                return item.trim();
            })
            .filter(Boolean);
    }

    function collectDiasTrabalho(prefix) {
        return DIAS_SEMANA.filter(function (dia) {
            const checkbox = document.getElementById(`${prefix}${dia}`);
            return checkbox && checkbox.checked;
        })
            .map(function (dia) {
                return dia.charAt(0).toUpperCase() + dia.slice(1);
            })
            .join(', ');
    }

    function criarPayload(prefix) {
        const salarioValue = document.getElementById(`${prefix}salario`).value;
        return {
            nome: normalizeText(document.getElementById(`${prefix}nome`).value),
            data_nascimento: document.getElementById(`${prefix}dataNascimento`).value,
            genero: toNullableValue(document.getElementById(`${prefix}genero`).value),
            cpf: normalizeText(document.getElementById(`${prefix}cpf`).value),
            email: toNullableValue(document.getElementById(`${prefix}email`).value),
            telefone: toNullableValue(document.getElementById(`${prefix}telefone`).value),
            cargo: normalizeText(document.getElementById(`${prefix}cargo`).value),
            departamento: document.getElementById(`${prefix}departamento`).value,
            data_admissao: document.getElementById(`${prefix}dataAdmissao`).value,
            salario: salarioValue ? parseFloat(salarioValue) : null,
            tipo_contrato: toNullableValue(document.getElementById(`${prefix}tipoContrato`).value) || 'CLT',
            horario_entrada: toNullableValue(document.getElementById(`${prefix}entrada`).value),
            horario_saida_almoco: toNullableValue(document.getElementById(`${prefix}saidaAlmoco`).value),
            horario_retorno_almoco: toNullableValue(document.getElementById(`${prefix}retornoAlmoco`).value),
            horario_saida: toNullableValue(document.getElementById(`${prefix}saida`).value),
            dias_trabalho: collectDiasTrabalho(prefix) || null,
        };
    }

    function setActiveSection(selector) {
        document.querySelectorAll('.managed-section').forEach(function (section) {
            section.classList.add('d-none');
        });

        const target = document.querySelector(selector);
        if (!target) return;

        target.classList.remove('d-none');
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function renderConsulta() {
        const ul = document.getElementById('lista-funcionarios');
        if (!ul) return;

        if (!Array.isArray(funcionariosCache) || funcionariosCache.length === 0) {
            ul.innerHTML = '<li class="list-group-item">Nenhum funcionário encontrado.</li>';
            return;
        }

        ul.innerHTML = funcionariosCache
            .map(function (funcionario) {
                return `
                    <li class="list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div>
                            <strong>${escapeHtml(funcionario.nome || 'Sem nome')}</strong>
                            <div class="small text-muted">
                                ${escapeHtml(funcionario.cargo || 'Sem cargo')} · ${escapeHtml(funcionario.departamento || 'Sem departamento')}
                            </div>
                        </div>
                        <span class="badge text-bg-light">ID ${escapeHtml(funcionario.id)}</span>
                    </li>
                `;
            })
            .join('');
    }

    function renderActionList(containerId, actionLabel, actionClass, onAction) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!Array.isArray(funcionariosCache) || funcionariosCache.length === 0) {
            container.innerHTML = '<div class="alert alert-light mb-0">Nenhum funcionário cadastrado.</div>';
            return;
        }

        container.innerHTML = '';
        const list = document.createElement('div');
        list.className = 'list-group';

        funcionariosCache.forEach(function (funcionario) {
            const item = document.createElement('div');
            item.className = 'list-group-item d-flex justify-content-between align-items-center gap-3 flex-wrap';
            item.innerHTML = `
                <div>
                    <strong>${escapeHtml(funcionario.nome || 'Sem nome')}</strong>
                    <div class="small text-muted">${escapeHtml(funcionario.cargo || '')} · ID ${escapeHtml(funcionario.id)}</div>
                </div>
            `;

            const button = document.createElement('button');
            button.type = 'button';
            button.className = `btn btn-sm ${actionClass}`;
            button.textContent = actionLabel;
            button.addEventListener('click', function () {
                onAction(funcionario);
            });

            item.appendChild(button);
            list.appendChild(item);
        });

        container.appendChild(list);
    }

    function renderEdicao() {
        renderActionList('edicao-list-container', 'Editar', 'btn-primary-custom', function (funcionario) {
            abrirFormularioEdicao(funcionario);
        });
    }

    function renderExclusao() {
        renderActionList('exclusao-list-container', 'Excluir', 'btn-danger', function (funcionario) {
            excluirFuncionario(funcionario.id, funcionario.nome || 'este funcionário');
        });
    }

    function abrirFormularioEdicao(funcionario) {
        const container = document.getElementById('edicao-form-container');
        if (!container) return;

        container.classList.remove('d-none');
        edicaoFormApi = mountForm('edicao-form-container', {
            formId: 'form-edicao',
            prefix: 'edicao-',
            hiddenId: true,
            defaults: funcionario,
            submitLabel: 'Salvar Alterações',
            showReset: false,
            showCancel: true,
        });

        bindEdicaoForm();
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function fecharFormularioEdicao() {
        const container = document.getElementById('edicao-form-container');
        if (container) {
            container.classList.add('d-none');
            container.innerHTML = '';
        }
        edicaoFormApi = null;
    }

    async function fetchJson(url, options) {
        const response = await fetch(url, options);
        const contentType = response.headers.get('content-type') || '';
        let data = null;

        if (contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (!response.ok) {
            let message = 'Erro na requisição.';
            if (data && typeof data === 'object') {
                if (data.mensagem) {
                    message = data.mensagem;
                }
                if (Array.isArray(data.detalhes) && data.detalhes.length > 0) {
                    const firstError = data.detalhes[0];
                    const detailMessage = firstError && (firstError.mensagem || firstError.msg);
                    if (detailMessage) {
                        message += ` (${detailMessage})`;
                    }
                }
            } else if (typeof data === 'string' && data) {
                message = data;
            }

            const error = new Error(message);
            error.status = response.status;
            error.body = data;
            throw error;
        }

        return data;
    }

    async function carregarFuncionarios() {
        const response = await fetchJson(endpoints.funcionarios, {
            method: 'GET',
            headers: { Accept: 'application/json' },
        });
        funcionariosCache = Array.isArray(response.data) ? response.data : [];
        return funcionariosCache;
    }

    async function atualizarTodasAsListas() {
        try {
            await carregarFuncionarios();
            renderConsulta();
            renderEdicao();
            renderExclusao();
        } catch (error) {
            funcionariosCache = [];
            const erroMensagem = error && error.message ? error.message : 'Erro ao carregar funcionários.';
            const lista = document.getElementById('lista-funcionarios');
            if (lista) lista.innerHTML = `<li class="list-group-item text-danger">${escapeHtml(erroMensagem)}</li>`;

            ['edicao-list-container', 'exclusao-list-container'].forEach(function (id) {
                const element = document.getElementById(id);
                if (element) {
                    element.innerHTML = `<div class="alert alert-danger mb-0">${escapeHtml(erroMensagem)}</div>`;
                }
            });
        }
    }

    async function carregarStatusInicial() {
        try {
            await fetchJson(endpoints.root, {
                method: 'GET',
                headers: { Accept: 'application/json' },
            });
        } catch (error) {
            console.error('Falha ao validar status da API:', error);
            showToast('Não foi possível conectar à API. Verifique se o servidor Flask está ativo.', 'danger');
        }
    }

    function bindNavigation() {
        document.querySelectorAll('.section-chip[data-target], .nav-section-link[data-target], .navbar-brand[data-target]').forEach(function (element) {
            element.style.cursor = 'pointer';
            element.addEventListener('click', function (event) {
                event.preventDefault();
                const targetSelector = element.getAttribute('data-target');
                setActiveSection(targetSelector);
                if (targetSelector === '#consulta' || targetSelector === '#edicao' || targetSelector === '#exclusao') {
                    atualizarTodasAsListas();
                }
            });
        });
    }

    function bindCadastroForm() {
        cadastroFormApi = mountForm('cadastro-form-container', {
            formId: 'form-cadastro',
            prefix: '',
            submitLabel: 'Salvar Cadastro',
            showReset: true,
            showCancel: false,
            defaults: { dias_trabalho: 'Seg, Ter, Qua, Qui, Sex' },
        });

        if (!cadastroFormApi || !cadastroFormApi.form) return;

        cadastroFormApi.form.addEventListener('submit', async function (event) {
            event.preventDefault();
            clearFormErrors(cadastroFormApi.form);

            const payload = criarPayload('');

            try {
                const response = await fetchJson(endpoints.funcionarios, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                showToast(response.mensagem || 'Funcionário cadastrado com sucesso!');
                cadastroFormApi.form.reset();
                await atualizarTodasAsListas();
                setActiveSection('#consulta');
            } catch (error) {
                renderFormErrors(cadastroFormApi.form, error);
                if (isCpfRelatedError(error)) {
                    setCpfContinuationAction(async function () {
                        const cpfTeste = generateTestCpf();
                        updateCpfField(cadastroFormApi.form, '', cpfTeste);

                        try {
                            const retryResponse = await fetchJson(endpoints.funcionarios, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    Accept: 'application/json',
                                },
                                body: JSON.stringify(Object.assign({}, payload, { cpf: cpfTeste })),
                            });

                            showToast('CPF de teste gerado automaticamente para continuar a operação.', 'warning');
                            showToast(retryResponse.mensagem || 'Funcionário cadastrado com sucesso!');
                            cadastroFormApi.form.reset();
                            await atualizarTodasAsListas();
                            setActiveSection('#consulta');
                        } catch (retryError) {
                            renderFormErrors(cadastroFormApi.form, retryError);
                            showToast(retryError.message || 'Erro ao salvar funcionário.', 'danger');
                            console.error(retryError);
                        } finally {
                            setCpfContinuationAction(null);
                        }
                    });

                    openCpfContinuationModal(error);
                }

                showToast(error.message || 'Erro ao salvar funcionário.', 'danger');
                console.error(error);
            }
        });
    }

    function bindEdicaoForm() {
        if (!edicaoFormApi || !edicaoFormApi.form) return;

        edicaoFormApi.form.addEventListener('submit', async function (event) {
            event.preventDefault();
            clearFormErrors(edicaoFormApi.form);

            const funcionarioId = document.getElementById('edicao-id').value;
            if (!funcionarioId) {
                showToast('Selecione um funcionário para editar.', 'warning');
                return;
            }

            const payload = criarPayload('edicao-');

            try {
                const response = await fetchJson(endpoints.funcionarioById(funcionarioId), {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                showToast(response.mensagem || 'Funcionário atualizado com sucesso!');
                fecharFormularioEdicao();
                await atualizarTodasAsListas();
            } catch (error) {
                renderFormErrors(edicaoFormApi.form, error);
                if (isCpfRelatedError(error)) {
                    setCpfContinuationAction(async function () {
                        const cpfTeste = generateTestCpf();
                        updateCpfField(edicaoFormApi.form, 'edicao-', cpfTeste);

                        try {
                            const retryResponse = await fetchJson(endpoints.funcionarioById(funcionarioId), {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json',
                                    Accept: 'application/json',
                                },
                                body: JSON.stringify(Object.assign({}, payload, { cpf: cpfTeste })),
                            });

                            showToast('CPF de teste gerado automaticamente para continuar a operação.', 'warning');
                            showToast(retryResponse.mensagem || 'Funcionário atualizado com sucesso!');
                            fecharFormularioEdicao();
                            await atualizarTodasAsListas();
                        } catch (retryError) {
                            renderFormErrors(edicaoFormApi.form, retryError);
                            showToast(retryError.message || 'Erro ao atualizar funcionário.', 'danger');
                            console.error(retryError);
                        } finally {
                            setCpfContinuationAction(null);
                        }
                    });

                    openCpfContinuationModal(error);
                }

                showToast(error.message || 'Erro ao atualizar funcionário.', 'danger');
                console.error(error);
            }
        });

        const btnCancelar = document.getElementById('edicao-btn-cancelar');
        if (btnCancelar) {
            btnCancelar.addEventListener('click', fecharFormularioEdicao);
        }
    }

    async function excluirFuncionario(id, nome) {
        if (!id) return;
        if (!confirm(`Deseja excluir ${nome}?`)) return;

        try {
            const response = await fetchJson(endpoints.funcionarioById(id), {
                method: 'DELETE',
                headers: { Accept: 'application/json' },
            });

            showToast(response.mensagem || 'Funcionário excluído com sucesso!');
            await atualizarTodasAsListas();
        } catch (error) {
            showToast(error.message || 'Erro ao excluir funcionário.', 'danger');
            console.error(error);
        }
    }

    async function bootstrap() {
        const continueBtn = document.getElementById('cpf-continue-confirm');
        const cancelBtn = document.getElementById('cpf-continue-cancel');
        const modalEl = document.getElementById('cpf-continuation-modal');

        if (continueBtn) {
            continueBtn.addEventListener('click', async function () {
                const action = cpfContinuationAction;
                const modal = modalEl ? getBootstrapModalInstance(modalEl) : null;

                if (modal) {
                    modal.hide();
                }

                if (typeof action === 'function') {
                    await action();
                }
            });
        }

        if (cancelBtn && modalEl) {
            cancelBtn.addEventListener('click', function () {
                cpfContinuationAction = null;
                const modal = getBootstrapModalInstance(modalEl);
                if (modal) {
                    modal.hide();
                }
            });
        }

        if (modalEl) {
            modalEl.addEventListener('hidden.bs.modal', function () {
                cpfContinuationAction = null;
            });
        }

        bindNavigation();
        bindCadastroForm();
        await carregarStatusInicial();
        await atualizarTodasAsListas();
    }

    document.addEventListener('DOMContentLoaded', bootstrap);
})();
