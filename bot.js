require('dotenv').config(); 
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, get, onValue, update, set } = require("firebase/database");

// ===============================
// 🛡️ VERIFICAÇÃO DE AMBIENTE
// ===============================
console.log("--------------------------------------------------");
console.log("🔑 STATUS DO TOKEN:", process.env.META_TOKEN ? "✅ OK (DEFINIDO)" : "❌ NÃO DEFINIDO");
console.log("--------------------------------------------------");

const app = express();
app.use(express.json());
app.use(cors());

const META_TOKEN = process.env.META_TOKEN; 

if (!META_TOKEN) {
    console.error("❌ ERRO CRÍTICO: META_TOKEN não definido nas variáveis de ambiente!");
}

const PHONE_ID = '1090608227463192'; 
const VERIFY_TOKEN = 'meu_token_elite'; 

const firebaseConfig = {
    apiKey: "AIzaSyANz1gbAi3PIGwS1-RzOIXF6SUZvS2U0mU",
    databaseURL: "https://agenda-album-de-formatura-default-rtdb.firebaseio.com"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

const mensagensProcessadas = new Set();

// ===============================
// 📚 CENTRAL DE RESPOSTAS ELITE
// ===============================
// Função que gera o link dinâmico baseado no projeto em que o aluno foi cadastrado
const obterLink = (idProjeto) => {
    // CORREÇÃO: Se não houver ID específico, usamos o ID global do banco como última opção
    // O ID "guaratingueta" foi removido como backup fixo para evitar erros
    const idLimpo = (idProjeto && idProjeto !== 'geral') ? idProjeto : 'guaratingueta-guilherme'; 
    return `\n\n👇 *CLIQUE NO LINK E AGENDE SUA VISITA (SEM COMPROMISSO):* \nhttps://2212785.github.io/Agendamentos/?id=${idLimpo}`;
};

const avisoTempo = "\n\n⚠️ *AVISO:* Nossa equipe estará na cidade por um *breve período*!";

const respostasElite = {
    formando: (criança, id) => `Maravilha, ${criança}! 😊 Informamos que as fotos de sua formatura ficaram lindas e já estão disponíveis para você conhecer pessoalmente.` + avisoTempo + obterLink(id),
    responsavel: (criança, id) => `Entendido! 😊 Como você é o responsável pelo(a) ${criança}, informamos que o material fotográfico da formatura já está disponível e ficou maravilhoso.` + avisoTempo + obterLink(id),
    parente_proximo: (criança, id) => `Entendido! 😊 Informamos que o material fotográfico da formatura da(o) ${criança} já está disponível e ficou maravilhoso.` + avisoTempo + obterLink(id),
    duvida_quem: (escola, id) => `Olá 😊 Somos da equipe oficial de fotografia da Escola ${escola}.` + avisoTempo + obterLink(id),
    duvida_motivo: (escola, id) => `Estamos entrando em contato para apresentar o material pronto da Escola ${escola}.` + avisoTempo + obterLink(id),
    duvida_preco: (id) => `Fique tranquilo! Os valores são acessíveis e o representante explicará tudo na visita.` + avisoTempo + obterLink(id),
    duvida_financeiro: (id) => `Temos condições especiais para todos. Agende sem compromisso!` + avisoTempo + obterLink(id),
    duvida_nome_sujo: (id) => `Restrição de SPC não é impedimento. Daremos um jeito!` + avisoTempo + obterLink(id),
    duvida_limite_cartao: (id) => `Falta de cartão ou limite não impede você de ver as fotos.` + avisoTempo + obterLink(id),
    duvida_entrada: (id) => `Não ter valor para entrada não é impedimento.` + avisoTempo + obterLink(id),
    duvida_avulsa: (id) => `Sobre fotos avulsas, apresentaremos as opções pessoalmente.` + avisoTempo + obterLink(id),
    duvida_viajando: (id) => `Sem problemas! Algum parente poderia receber o material por você?` + avisoTempo + obterLink(id),
    duvida_tempo: (id) => `Temos horários flexíveis. Escolha no link:` + avisoTempo + obterLink(id),
    duvida_nao_comprar: (id) => `Sem compromisso! Se não houver interesse, as fotos são destruídas.` + avisoTempo + obterLink(id),
    duvida_origem_fone: (id) => `Dados fornecidos via ficha de cadastro autorizada pela escola.` + avisoTempo + obterLink(id),
    conhece_mas_nao_responsavel: (id) => `Poderia encaminhar esta mensagem para o responsável?` + avisoTempo + obterLink(id),
    duvida_agendamento: (id) => `Basta escolher o melhor horário no link abaixo.` + obterLink(id),
    duvida_local: (id) => `O representante vai até o endereço informado.` + obterLink(id),
    seguranca: (esc, id) => `Sim! Somos a equipe oficial da Escola ${esc}.` + avisoTempo + obterLink(id),
    duvida_qualidade_digital: (id) => `Leva o álbum físico para você ver a alta resolução.` + avisoTempo + obterLink(id),
    duvida_local_reuniao: (id) => `Pode ser em casa, trabalho ou local público.` + avisoTempo + obterLink(id),
    ja_tem_fotos: (esc, id) => `Este material da Escola ${esc} é exclusivo e você ainda não viu.` + avisoTempo + obterLink(id),
    duvida_decisao_hora: (id) => `Fique tranquilo, você decide com calma após ver o material.` + avisoTempo + obterLink(id),
    audio: (id) => `Olá! 🤖 Não ouço áudios. Use o link para agendar:` + obterLink(id),
    remover: (id) => `Entendido. Vamos excluir seus dados imediatamente.` + obterLink(id),
    desculpas: () => `Obrigado pelo retorno. Vamos corrigir nosso cadastro.`,
    fallback: (id) => `Olá! 😊 Todos os detalhes serão esclarecidos durante a visita.` + avisoTempo + obterLink(id)
};

// ===============================
// 📤 FUNÇÃO DE ENVIO
// ===============================
async function enviarMensagemMeta(to, conteudo, tipo = "text") {
    try {
        let data;
        let textoParaFirebase = "";

        if (tipo === "text") {
            data = { messaging_product: "whatsapp", to: to, type: "text", text: { body: conteudo } };
            textoParaFirebase = conteudo;
        } else if (tipo === "template") {
            const nomeFinal = conteudo.criança || "Cliente";
            const escolaFinal = conteudo.escola || "sua escola";
            textoParaFirebase = `[TEMPLATE] Olá ${nomeFinal}, fotos prontas.`;
            data = {
                messaging_product: "whatsapp", to: to, type: "template",
                template: {
                    name: "inicio_contato", language: { code: "pt_BR" },
                    components: [{ type: "body", parameters: [{ type: "text", text: String(nomeFinal) }, { type: "text", text: String(escolaFinal) }] }]
                }
            };
        }

        await axios.post(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, data, {
            headers: { 'Authorization': `Bearer ${META_TOKEN}`, 'Content-Type': 'application/json' }
        });

        const numeroLimpo = to.replace(/\D/g, "");
        await set(ref(db, `respostas/${numeroLimpo}/${Date.now()}`), {
            mensagem: textoParaFirebase, tipo: "BOT", data: new Date().toLocaleString('pt-BR')
        });
    } catch (err) { 
        console.error(`❌ ERRO:`, err.message); 
    }
}

// ===============================
// 🚀 ROTA DE DISPARO (CORREÇÃO DE LINK)
// ===============================
app.post('/disparar-template', async (req, res) => {
    const { telefone, nome_formando, escola, projeto_id, usuario } = req.body;
    if (!telefone || !nome_formando) return res.status(400).send({ error: "Dados incompletos" });

    try {
        await enviarMensagemMeta(telefone, { criança: nome_formando, escola: escola }, "template");
        
        const numeroDestino = telefone.replace(/\D/g, "");
        // CORREÇÃO: Salva qual usuário enviou para saber qual projeto buscar depois
        await set(ref(db, `vinculo_projeto/${numeroDestino}`), {
            projeto_id: projeto_id || "geral",
            nome: nome_formando,
            escola: escola,
            remetente: usuario || "Evanio",
            data_disparo: Date.now()
        });

        res.status(200).send({ success: true });
    } catch (error) { 
        res.status(500).send({ error: "Erro" }); 
    }
});

// ===============================
// 🤖 PROCESSAR RESPOSTAS
// ===============================
async function processarMensagemRecebida(from, texto, msgType = "text") {
    const txt = (texto || "").toLowerCase().trim();
    const numeroLimpo = from.replace(/\D/g, "");
    
    let nomeCriança = "Formando"; 
    let escolaCliente = "Escola";
    let idProjetoCerto = "";

    try {
        const snapshot = await get(ref(db, `vinculo_projeto/${numeroLimpo}`));
        if (snapshot.exists()) {
            const vinculo = snapshot.val();
            nomeCriança = vinculo.nome || "Formando";
            escolaCliente = vinculo.escola || "Escola";
            
            // LÓGICA DE BUSCA PELO ÚLTIMO PROJETO DO USUÁRIO QUE DISPAROU
            const remetente = vinculo.remetente || "Evanio";
            const snapUltimo = await get(ref(db, `config/ultimo_projeto_usuario/${remetente}`));
            
            // Se o usuário mudou de projeto no painel, o Bot acompanha!
            idProjetoCerto = snapUltimo.exists() ? snapUltimo.val() : vinculo.projeto_id;
        } else {
            // Se não houver vínculo, tenta o projeto ativo global
            const snapGlobal = await get(ref(db, "config/projeto_ativo"));
            idProjetoCerto = snapGlobal.exists() ? snapGlobal.val() : "guaratingueta-guilherme";
        }
    } catch (e) { console.error("Erro leitura"); }

    let respostaFinal = "";
    if (msgType === "audio") {
        respostaFinal = respostasElite.audio(idProjetoCerto);
    } else {
        if (txt.includes("não quero") || txt.includes("nao quero") || txt.includes("remover")) {
            respostaFinal = respostasElite.remover(idProjetoCerto);
        } else if (txt === "1" || txt.includes("sou eu")) {
            respostaFinal = respostasElite.formando(nomeCriança, idProjetoCerto);
        } else if (txt === "2" || txt.includes("responsavel")) {
            respostaFinal = respostasElite.responsavel(nomeCriança, idProjetoCerto);
        } else if (txt === "quem" || txt.includes("empresa")) {
            respostaFinal = respostasElite.duvida_quem(escolaCliente, idProjetoCerto);
        } else if (txt.includes("preço") || txt.includes("valor")) {
            respostaFinal = respostasElite.duvida_preco(idProjetoCerto);
        } else if (txt.includes("seguro") || txt.includes("confiavel")) {
            respostaFinal = respostasElite.seguranca(escolaCliente, idProjetoCerto);
        } else {
            respostaFinal = respostasElite.fallback(idProjetoCerto);
        }
    }

    await set(ref(db, `respostas/${numeroLimpo}/${Date.now()}`), {
        mensagem: msgType === "audio" ? "[ÁUDIO]" : texto, tipo: "CLIENTE", data: new Date().toLocaleString('pt-BR')
    });

    await enviarMensagemMeta(from, respostaFinal);
}

// ===============================
// 🌐 WEBHOOK & HEARTBEAT
// ===============================
app.get('/webhook', (req, res) => {
    if (req.query['hub.verify_token'] === VERIFY_TOKEN) { res.status(200).send(req.query['hub.challenge']); } else { res.sendStatus(403); }
});

app.post('/webhook', async (req, res) => {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    const msg = changes?.messages?.[0];
    if (msg && !mensagensProcessadas.has(msg.id)) {
        mensagensProcessadas.add(msg.id);
        await processarMensagemRecebida(msg.from, msg.text?.body, msg.type);
    }
    res.sendStatus(200);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Bot Elite Online`));
