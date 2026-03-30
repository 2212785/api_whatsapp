require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, get, onValue } = require("firebase/database");

// ===============================
// 🛡️ VERIFICAÇÃO DE AMBIENTE
// ===============================
console.log("--------------------------------------------------");
console.log("🔑 STATUS DO TOKEN:", process.env.META_TOKEN ? "✅ OK (DEFINIDO)" : "❌ NÃO DEFINIDO");
console.log("--------------------------------------------------");

const app = express();
app.use(express.json());

const META_TOKEN = process.env.META_TOKEN; 

if (!META_TOKEN) {
    console.error("❌ ERRO CRÍTICO: META_TOKEN não definido!");
    process.exit(1); 
}

const PHONE_ID = '1090608227463192'; 
const VERIFY_TOKEN = 'meu_token_elite'; 

const firebaseConfig = {
    apiKey: "AIzaSyANz1gbAi3PIGwS1-RzOIXF6SUZvS2U0mU",
    databaseURL: "https://agenda-album-de-formatura-default-rtdb.firebaseio.com"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

let projId = "";
let escolaGlobal = "";

const mensagensProcessadas = new Set();

// ===============================
// 📚 CENTRAL DE RESPOSTAS ELITE
// ===============================
const respostasElite = {
    formando: (nome) => `Maravilha, ${nome}! 😊 Como você é o formando, as fotos já estão separadas para você conhecer.\n\nEste atendimento é automatizado.\n\n👇 *CLIQUE AQUI PARA AGENDAR SUA VISITA!* \nhttps://2212785.github.io/Agendamentos`,
    
    responsavel: (nome) => `Entendido! 😊 Como você é o responsável pelo(a) ${nome}, informamos que o material já está pronto.\n\nEste é um contato automático (Atendemos até as 20:30h).\n\n👇 *CLIQUE AQUI PARA AGENDAR SUA VISITA!* \nhttps://2212785.github.io/Agendamentos`,
    
    duvida_quem: (escola) => `Olá 😊\n\nSomos da equipe responsável pelo atendimento automatizado das fotos de formatura da Escola ${escola}.\n\nEste primeiro contato é automático para identificação.\n\nCaso tenha interesse, um representante poderá esclarecer todos os detalhes pessoalmente durante a visita.`,
    
    duvida_motivo: (escola) => `Estamos entrando em contato referente às fotos de formatura da Escola ${escola} 📸\n\nEste é um atendimento inicial automatizado para identificação.\n\nApós sua confirmação, um representante poderá apresentar todos os detalhes pessoalmente durante a visita.`,
    
    duvida_preco: () => `Os valores e condições são apresentados diretamente pelo representante durante a visita 😊\n\nEste atendimento inicial é automatizado apenas para identificação e direcionamento.`,
    
    duvida_agendamento: () => `Este atendimento é automatizado.\n\n👇 *CLIQUE AQUI PARA AGENDAR SUA VISITA!* \nhttps://2212785.github.io/Agendamentos`,
    
    duvida_local: () => `As informações completas sobre local e funcionamento são apresentadas pelo representante no momento da visita 😊\n\nEste primeiro contato é apenas automatizado para identificação.`,
    
    duvida_obrigatorio: () => `Sim 😊\n\nEsta resposta ajuda a identificarmos corretamente se falamos com a pessoa ou responsável.\n\nApós isso, um representante poderá dar continuidade com mais informações durante a visita.`,
    
    duvida_identificacao: (nome) => `Para prosseguirmos 😊\n\nPor favor, responda uma das opções abaixo:\n\n1. Sou o(a) ${nome}\n2. Sou o responsável\n3. Não conheço\n\nEste atendimento é automatizado e servirá apenas para identificação inicial.`,
    
    desculpas: () => `Obrigado pelo retorno 👍\n\nVamos registrar e corrigir nosso contato.\n\nPedimos desculpas pelo inconveniente e agradecemos sua atenção 😊`,
    
    // RESPOSTA DE ENCERRAMENTO (MELHORADA)
    remover: () => `Entendido 👍\n\nVamos registrar seu desinteresse e remover seu número da nossa lista de contatos.\n\nPedimos desculpas pelo incômodo e agradecemos sua atenção 😊`,
    
    depois: () => `Sem problemas 😊\n\nFique à vontade para responder quando puder.\n\nEstamos disponíveis e, após sua resposta, um representante poderá te atender pessoalmente na visita.`,
    
    humano: () => `Este primeiro atendimento é realizado de forma automatizada 😊\n\nApós sua confirmação, um representante entrará em contato e poderá te atender pessoalmente durante a visita para esclarecer todas as dúvidas.`,
    
    seguranca: (escola) => `Sim, é confiável! 😊\n\nEste é um atendimento referente às fotos de formatura da Escola ${escola}.\n\nO primeiro contato é automatizado para organização das respostas.\n\nO representante responsável fará o atendimento completo e presencial durante a visita.`,

    audio: () => `Olá! 🤖 Como este atendimento é 100% automatizado, eu **não consigo ouvir áudios**.\n\nPor favor, utilize o link para agendar sua visita:\n👉 https://2212785.github.io/Agendamentos`,

    fallback: () => `Olá! 😊 Para seguirmos com o atendimento das fotos, por favor, responda com uma das opções:\n\n1️⃣ Sim, sou o formando.\n2️⃣ Sim, sou o responsável.\n3️⃣ Não conheço.\n\nOu agende sua visita direto aqui:\n👉 https://2212785.github.io/Agendamentos`
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
            const nomeFinal = conteudo.nome || "Cliente";
            const escolaFinal = conteudo.escola || escolaGlobal || "sua escola";
            textoParaFirebase = `[TEMPLATE: inicio_contato] Olá ${nomeFinal}, fotos da escola ${escolaFinal} prontas.`;
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
        await axios.post(`https://agenda-album-de-formatura-default-rtdb.firebaseio.com/respostas/${numeroLimpo}.json`, {
            mensagem: textoParaFirebase, tipo: "BOT", data: new Date().toLocaleString('pt-BR')
        });

    } catch (err) {
        console.error(`❌ ERRO AO ENVIAR PARA ${to}:`, err.message);
    }
}

// ===============================
// 🤖 PROCESSAR RESPOSTAS
// ===============================
async function processarMensagemRecebida(from, texto, msgType = "text") {
    const txt = (texto || "").toLowerCase().trim();
    const numeroLimpo = from.replace(/\D/g, "");

    let nomeCliente = "Mariana Maria"; 
    let escolaCliente = escolaGlobal || "Conselheiro Rodrigues Alves";

    try {
        const snapshot = await get(ref(db, "enviados"));
        if (snapshot.exists()) {
            const lista = snapshot.val();
            const encontrado = Object.values(lista).find(item => item.telefone.includes(numeroLimpo));
            if (encontrado) {
                nomeCliente = encontrado.nome;
                escolaCliente = encontrado.escola || escolaCliente;
            }
        }
    } catch (e) {}

    let respostaFinal = "";

    if (msgType === "audio") {
        respostaFinal = respostasElite.audio();
    } else {
        // --- PRIORIDADE 1: RECUSA / DESINTERESSE ---
        if (txt.includes("não quero") || txt.includes("nao quero") || txt.includes("sem interesse") || txt.includes("não tenho interesse") || txt.includes("nao tenho interesse") || txt.includes("já recebi") || txt.includes("ja recebi") || txt.includes("pare") || txt.includes("não me chame")) {
            respostaFinal = respostasElite.remover();
        } 
        // --- PRIORIDADE 2: IDENTIFICAÇÃO DIRETA ---
        else if (txt === "1" || txt.includes("sou eu") || txt === "1️⃣") {
            respostaFinal = respostasElite.formando(nomeCliente);
        } else if (txt === "2" || txt.includes("responsavel") || txt.includes("responsável") || txt === "2️⃣") {
            respostaFinal = respostasElite.responsavel(nomeCliente);
        } else if (txt === "3" || txt.includes("não conheço") || txt.includes("não conheco") || txt === "3️⃣" || txt.includes("errado")) {
            respostaFinal = respostasElite.desculpas();
        } 
        // --- PRIORIDADE 3: DÚVIDAS ESPECÍFICAS ---
        else if (txt.includes("quem") || (txt.includes("onde") && txt.includes("são")) || txt.includes("falando")) {
            respostaFinal = respostasElite.duvida_quem(escolaCliente);
        } else if (txt.includes("trata") || txt.includes("que fotos") || txt.includes("chamando") || txt.includes("entendi")) {
            respostaFinal = respostasElite.duvida_motivo(escolaCliente);
        } else if (txt.includes("quanto") || txt.includes("preço") || txt.includes("valor") || txt.includes("custa")) {
            respostaFinal = respostasElite.duvida_preco();
        } else if (txt.includes("agendar") || txt.includes("agendo") || txt.includes("marcar")) {
            respostaFinal = respostasElite.duvida_agendamento();
        } else if (txt.includes("local") || txt.includes("endereço") || txt.includes("onde será")) {
            respostaFinal = respostasElite.duvida_local();
        } else if (txt.includes("preciso") || txt.includes("obrigatorio")) {
            respostaFinal = respostasElite.duvida_obrigatorio();
        } else if (txt.includes("humano") || txt.includes("atendente") || txt.includes("telefone")) {
            respostaFinal = respostasElite.humano();
        } else if (txt.includes("confiavel") || txt.includes("golpe") || txt.includes("oficial")) {
            respostaFinal = respostasElite.seguranca(escolaCliente);
        } else if (txt.includes("depois") || txt.includes("posso") || txt.includes("tarde")) {
            respostaFinal = respostasElite.depois();
        }
        // --- FALLBACK: CASO NÃO IDENTIFIQUE NADA ---
        else {
            respostaFinal = respostasElite.duvida_identificacao(nomeCliente);
        }
    }

    await axios.post(`https://agenda-album-de-formatura-default-rtdb.firebaseio.com/respostas/${numeroLimpo}.json`, {
        mensagem: msgType === "audio" ? "[ÁUDIO ENVIADO]" : texto,
        tipo: "CLIENTE",
        data: new Date().toLocaleString('pt-BR')
    });

    return enviarMensagemMeta(from, respostaFinal);
}

// ===============================
// 🌐 WEBHOOK E MONITORAMENTO (MANTIDOS)
// ===============================
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode && token === VERIFY_TOKEN) { res.status(200).send(challenge); } else { res.sendStatus(403); }
});

app.post('/webhook', async (req, res) => {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    const msg = changes?.messages?.[0];
    if (msg && !mensagensProcessadas.has(msg.id)) {
        mensagensProcessadas.add(msg.id);
        const msgType = msg.type;
        const texto = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title;
        await processarMensagemRecebida(msg.from, texto, msgType);
    }
    res.sendStatus(200);
});

onValue(ref(db, "config/projeto_ativo"), async (snap) => {
    projId = snap.val();
    if (projId) {
        const snapEscola = await get(ref(db, `projetos/${projId}/escola`));
        escolaGlobal = snapEscola.val() || "Conselheiro Rodrigues Alves";
        console.log(`🔄 Monitorando: ${projId} | Escola: ${escolaGlobal}`);
    }
});

app.post('/disparar-template', async (req, res) => {
    const { telefone, nome_formando, escola } = req.body;
    try {
        await enviarMensagemMeta(telefone, { nome: nome_formando, escola: escola }, "template");
        res.status(200).send({ success: true });
    } catch (e) { res.status(500).send({ error: "Erro disparo" }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Elite Bot Rodando na porta ${PORT}`));